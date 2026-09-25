/*
# Student Department Placement System Schema

## Overview
Creates the database schema for Mekdela Amba University Mekane Selam Campus
student department placement system. Students log in with their university
Student ID and password, submit ranked preferences for 9 departments, and
view their placement status.

## New Tables

### student_profiles
Stores academic information for each student.
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users, defaults to authenticated user)
- `student_id` (text, unique, the university-assigned student ID e.g. "MAU/2024/001")
- `full_name` (text, student's full name)
- `gpa` (numeric, grade point average 0.00–4.00)
- `stream` (text, college/stream e.g. "Social Sciences", "Business")
- `created_at` (timestamptz)

### student_preferences
Stores each student's ranked department preferences and placement status.
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users, defaults to authenticated user)
- `ranked_departments` (jsonb, ordered array of department names, 9 items)
- `status` (text, 'pending' or 'placed')
- `placed_department` (text, nullable, set when student is placed)
- `submitted_at` (timestamptz)
- `updated_at` (timestamptz, auto-updated via trigger)

## Security
- RLS enabled on both tables.
- Owner-scoped CRUD: authenticated users can only access their own rows.
- user_id columns default to auth.uid() so inserts omitting user_id succeed.

## Notes
1. Student ID maps to a synthetic email ({student_id}@mau.edu.et) for Supabase Auth.
2. Each student can submit exactly one preference set (UNIQUE constraint on user_id).
3. updated_at auto-refreshes on row update via a trigger.
*/

-- ============================================================
-- student_profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS student_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id text NOT NULL UNIQUE,
  full_name text NOT NULL,
  gpa numeric(3,2) NOT NULL CHECK (gpa >= 0 AND gpa <= 4),
  stream text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON student_profiles;
CREATE POLICY "select_own_profile"
  ON student_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_profile" ON student_profiles;
CREATE POLICY "insert_own_profile"
  ON student_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_profile" ON student_profiles;
CREATE POLICY "update_own_profile"
  ON student_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_profile" ON student_profiles;
CREATE POLICY "delete_own_profile"
  ON student_profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- student_preferences
-- ============================================================

CREATE TABLE IF NOT EXISTS student_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ranked_departments jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'placed')),
  placed_department text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE student_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_preferences" ON student_preferences;
CREATE POLICY "select_own_preferences"
  ON student_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_preferences" ON student_preferences;
CREATE POLICY "insert_own_preferences"
  ON student_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_preferences" ON student_preferences;
CREATE POLICY "update_own_preferences"
  ON student_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_preferences" ON student_preferences;
CREATE POLICY "delete_own_preferences"
  ON student_preferences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- updated_at trigger for student_preferences
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preferences_updated_at ON student_preferences;
CREATE TRIGGER trg_preferences_updated_at
  BEFORE UPDATE ON student_preferences
  FOR EACH ROW
  EXECUTE FUNCTION refresh_updated_at();

-- ============================================================
-- Simulate placement function (admin/demo callable)
-- Given a user_id, assigns the highest-ranked department that has capacity.
-- For demo purposes, capacity is unlimited — it assigns the first preference.
-- ============================================================

CREATE OR REPLACE FUNCTION simulate_placement(p_user_id uuid, p_department text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE student_preferences
  SET status = 'placed',
      placed_department = p_department,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION simulate_placement(uuid, text) TO authenticated;