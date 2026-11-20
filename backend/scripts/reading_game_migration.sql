-- Existing single-reader PostgreSQL installations used for development and offline imports.
BEGIN;
SET LOCAL search_path TO reading, pg_catalog;
CREATE TABLE IF NOT EXISTS game_requests (
    scope text, key text, digest text NOT NULL, resource text NOT NULL, PRIMARY KEY(scope, key)
);
CREATE TABLE IF NOT EXISTS character_cards (
    id text PRIMARY KEY REFERENCES collectibles ON DELETE CASCADE, name text NOT NULL, sprite text NOT NULL,
    book_id text NOT NULL, book_title text NOT NULL, is_public boolean NOT NULL DEFAULT false,
    x double precision, y double precision
);
REVOKE ALL ON character_cards, game_requests FROM PUBLIC, anon, authenticated;
COMMIT;
