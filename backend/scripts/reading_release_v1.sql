-- Run once as the migration owner, with a separate login for the API/worker.
-- Additive migration. Existing single-reader data stays in its original schema.
BEGIN;
SELECT pg_advisory_xact_lock(731119, 1);
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reading_service') THEN
        CREATE ROLE reading_service NOLOGIN;
    END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS reading_control;
REVOKE ALL ON SCHEMA reading_control FROM PUBLIC;
DO $$ DECLARE client_role text; BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON SCHEMA reading_control FROM %I', client_role);
        END IF;
    END LOOP;
END $$;
CREATE TABLE IF NOT EXISTS reading_control.installation (
    singleton boolean PRIMARY KEY CHECK(singleton), database_id uuid NOT NULL DEFAULT gen_random_uuid(),
    schema_version integer NOT NULL
);
INSERT INTO reading_control.installation(singleton, schema_version) VALUES(true, 1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS reading_control.readers (account_id uuid PRIMARY KEY);
GRANT USAGE ON SCHEMA reading_control TO reading_service;
GRANT SELECT ON reading_control.installation, reading_control.readers TO reading_service;

CREATE OR REPLACE FUNCTION reading_control.provision(reader uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $provision$
DECLARE
    client_role text;
    target text := 'reader_' || replace(reader::text, '-', '');
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(target, 1));
    IF EXISTS (SELECT FROM reading_control.readers WHERE account_id = reader) THEN
        RETURN false;
    END IF;
    EXECUTE format('CREATE SCHEMA %I', target);
    EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC', target);
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON SCHEMA %I FROM %I', target, client_role);
        END IF;
    END LOOP;
    PERFORM set_config('search_path', format('%I, pg_catalog, pg_temp', target), true);
    CREATE TABLE books (
        id text PRIMARY KEY, title text NOT NULL, category text NOT NULL, created_at timestamptz NOT NULL
    );
    CREATE TABLE catalog_publications (
        book_id text PRIMARY KEY REFERENCES books ON DELETE CASCADE,
        author_name text NOT NULL, description text NOT NULL, license text NOT NULL,
        representative_name text NOT NULL, representative_sprite text NOT NULL,
        published_at timestamptz NOT NULL,
        added_at timestamptz,
        in_library boolean NOT NULL DEFAULT false
    );
    CREATE VIEW library_books AS
        SELECT b.* FROM books b LEFT JOIN catalog_publications p ON p.book_id = b.id
        WHERE p.book_id IS NULL OR p.in_library;
    CREATE TABLE passages (
        book_id text REFERENCES books ON DELETE CASCADE, ordinal integer,
        chapter integer NOT NULL, paragraph integer NOT NULL, title text NOT NULL, text text NOT NULL,
        PRIMARY KEY (book_id, ordinal), UNIQUE (book_id, chapter, paragraph)
    );
    CREATE TABLE reading_progress (
        book_id text PRIMARY KEY REFERENCES books ON DELETE CASCADE,
        current integer NOT NULL DEFAULT 0, confirmed integer NOT NULL DEFAULT -1, last_read_at timestamptz
    );
    CREATE TABLE questions (
        id text PRIMARY KEY, book_id text NOT NULL REFERENCES books ON DELETE CASCADE,
        ordinal integer NOT NULL, prompt text NOT NULL, answer text NOT NULL, aliases jsonb NOT NULL,
        FOREIGN KEY (book_id, ordinal) REFERENCES passages
    );
    CREATE TABLE book_analysis (
        book_id text PRIMARY KEY REFERENCES books ON DELETE CASCADE, result jsonb NOT NULL
    );
    CREATE TABLE question_choices (
        question_id text PRIMARY KEY REFERENCES questions ON DELETE CASCADE, options jsonb NOT NULL
    );
    CREATE TABLE quiz_sessions (
        id text PRIMARY KEY, book_id text NOT NULL REFERENCES books ON DELETE CASCADE,
        confirmed integer NOT NULL, mode text NOT NULL, started_at timestamptz NOT NULL, finished_at timestamptz
    );
    CREATE TABLE session_questions (
        session_id text REFERENCES quiz_sessions ON DELETE CASCADE,
        question_id text REFERENCES questions ON DELETE CASCADE, position integer NOT NULL,
        PRIMARY KEY (session_id, question_id)
    );
    CREATE TABLE quiz_attempts (
        session_id text, question_id text, response text NOT NULL, result text NOT NULL,
        PRIMARY KEY (session_id, question_id),
        FOREIGN KEY (session_id, question_id) REFERENCES session_questions ON DELETE CASCADE
    );
    CREATE TABLE memos (
        id text PRIMARY KEY, book_id text NOT NULL REFERENCES books ON DELETE CASCADE,
        ordinal integer NOT NULL, type text NOT NULL, content text NOT NULL, quote text NOT NULL,
        created_at timestamptz NOT NULL, evidence text, confidence integer, review_at integer,
        written_confirmed integer NOT NULL,
        FOREIGN KEY (book_id, ordinal) REFERENCES passages,
        FOREIGN KEY (book_id, review_at) REFERENCES passages
    );
    CREATE TABLE revisions (
        id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, memo_id text NOT NULL REFERENCES memos ON DELETE CASCADE,
        content text NOT NULL, created_at timestamptz NOT NULL
    );
    CREATE TABLE revision_evidence (
        revision_id bigint NOT NULL REFERENCES revisions ON DELETE CASCADE,
        book_id text NOT NULL, ordinal integer NOT NULL, stance text NOT NULL, quote text NOT NULL,
        PRIMARY KEY (revision_id, ordinal, stance, quote),
        FOREIGN KEY (book_id, ordinal) REFERENCES passages
    );
    CREATE TABLE preferences (key text PRIMARY KEY, value jsonb NOT NULL);
    CREATE TABLE collectibles (id text PRIMARY KEY, earned_at timestamptz NOT NULL);
    CREATE TABLE minigame_rewards (id text PRIMARY KEY REFERENCES collectibles ON DELETE CASCADE);
    CREATE TABLE clue_game_rewards (id text PRIMARY KEY REFERENCES collectibles ON DELETE CASCADE);
    CREATE TABLE revision_outcomes (
        revision_id bigint PRIMARY KEY REFERENCES revisions ON DELETE CASCADE, outcome text NOT NULL
    );


    CREATE TABLE game_requests (
        scope text, key text, digest text NOT NULL, resource text NOT NULL, PRIMARY KEY(scope, key)
    );
    CREATE TABLE character_cards (
        id text PRIMARY KEY REFERENCES collectibles ON DELETE CASCADE, name text NOT NULL, sprite text NOT NULL,
        book_id text NOT NULL, book_title text NOT NULL, is_public boolean NOT NULL DEFAULT false,
        x double precision, y double precision
    );
    CREATE TABLE genre_analysis_jobs (
        book_id text PRIMARY KEY REFERENCES books ON DELETE CASCADE,
        status text NOT NULL CHECK (status IN ('queued', 'running', 'ready', 'failed')),
        token text, updated_at timestamptz NOT NULL
    );
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO reading_service', target);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO reading_service', target);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO reading_service', target);
    INSERT INTO reading_control.readers VALUES(reader);
    RETURN true;
END
$provision$;
REVOKE ALL ON FUNCTION reading_control.provision(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reading_control.provision(uuid) TO reading_service;
COMMIT;
