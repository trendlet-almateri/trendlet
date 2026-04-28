-- Migration 01: Extensions
-- Enables: uuid generation, fuzzy text matching (for brand vendor matching),
-- case-insensitive text (emails, brand names).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";
