BEGIN;
CREATE TABLE IF NOT EXISTS reading.genre_analysis_jobs (
    book_id text PRIMARY KEY REFERENCES reading.books ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('queued', 'running', 'ready', 'failed')),
    token text,
    updated_at timestamptz NOT NULL
);
REVOKE ALL ON reading.genre_analysis_jobs FROM PUBLIC, anon, authenticated;
-- Genre payloads are stored in the existing book_analysis.result JSONB column.
COMMIT;
