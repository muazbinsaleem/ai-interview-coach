-- =============================================================================
-- schema.sql  —  AI Interview Coach
-- Drops all tables and recreates them from scratch.
-- Run this in the Supabase SQL editor.
-- =============================================================================

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- DROP existing tables (in reverse FK order to avoid constraint errors)
-- =============================================================================
DROP TABLE IF EXISTS answers  CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS resumes  CASCADE;
DROP TABLE IF EXISTS users    CASCADE;

-- =============================================================================
-- Table: users
-- Stores all registered user accounts.
-- =============================================================================
CREATE TABLE users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- =============================================================================
-- Table: resumes
-- Stores uploaded resume data and AI-extracted skills per user.
-- =============================================================================
CREATE TABLE resumes (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  extracted_text TEXT,
  skills         JSONB        DEFAULT '[]',
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_resumes_user_id ON resumes(user_id);

-- =============================================================================
-- Table: sessions
-- One row per completed interview session.
-- =============================================================================
CREATE TABLE sessions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(50)  NOT NULL,
  difficulty    VARCHAR(50)  NOT NULL,
  voice_mode    BOOLEAN      DEFAULT FALSE,
  status        VARCHAR(20)  DEFAULT 'complete',
  overall_score FLOAT        DEFAULT 0,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- =============================================================================
-- Table: answers
-- One row per question answered within a session.
-- =============================================================================
CREATE TABLE answers (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id      VARCHAR(255) NOT NULL,
  question_text    TEXT         NOT NULL,
  question_topic   VARCHAR(255) NOT NULL,
  answer_text      TEXT         NOT NULL,
  score            INTEGER      DEFAULT 0,
  strengths        JSONB        DEFAULT '[]',
  weaknesses       JSONB        DEFAULT '[]',
  suggested_answer TEXT         NOT NULL,
  summary          TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_answers_session_id ON answers(session_id);

-- =============================================================================
-- Disable Row Level Security on all tables
-- (backend uses service-role key — RLS is not needed)
-- =============================================================================
ALTER TABLE users    DISABLE ROW LEVEL SECURITY;
ALTER TABLE resumes  DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE answers  DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Grant full access to anon + authenticated roles
-- (needed if you are using the anon key instead of service_role key)
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;


-- Drop the problematic unique constraint
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS unique_user_session;

-- Create a primary key on id only (which is already unique)
-- This allows multiple sessions per user, even at the same timestamp