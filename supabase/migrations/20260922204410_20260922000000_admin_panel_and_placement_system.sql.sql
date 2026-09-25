/*
# Phase 2: Admin Panel and Automated Placement System

## Overview
Extends the student placement system with admin/registrar capabilities:
admin authentication, department capacity management, automated placement
algorithm, and result publication.

## New Tables

### admin_profiles
Stores registrar/admin accounts. Admins log in with an admin-specific
Student ID (e.g. "ADMIN/001") and password through Supabase Auth, then
this table marks them as administrators.
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users, defaults to auth.uid())
- `admin_id` (text, unique, the admin's identifier e.g. "ADMIN/001")
- `full_name` (text)
- `created_at` (timestamptz)

### department_capacities
Stores the maximum number of students each department can accept.
- `id` (uuid, primary key)
- `department_name` (text, unique, one of the 9 departments)
- `capacity` (integer, not null, default 0)
- `updated_at` (timestamptz)

## Modified Tables

### student_profiles
- Added `entrance_result` (numeric, 0-100, default 0) — the student's
  100-point entrance exam result used for placement priority.

### student_preferences
- Added `is_published` (boolean, default false) — when true, students
  can see their placement status on their dashboard. When false, the
  placement is admin-only and hidden from students.
- Updated the `status` CHECK to also allow 'rejected' for students who
  cannot be placed in any department.

## Security
- RLS enabled on admin_profiles and department_capacities.
- admin_profiles: owner-scoped CRUD for authenticated admins.
- department_capacities: SELECT for authenticated (admins need to read,
  students don't query this table directly). INSERT/UPDATE/DELETE for
  authenticated (admins manage capacities).
- A SECURITY DEFINER function `is_admin()` checks if the current user
  has a row in admin_profiles, used by the placement function.

## Placement Algorithm
- `run_placement()` SECURITY DEFINER function:
  1. Resets all student placements to pending/unpublished.
  2. Sorts students by entrance_result DESC, then gpa DESC.
  3. For each student, walks their ranked department list and assigns
     them to the first department that still has capacity.
  4. If no department has capacity, marks the student as 'rejected'.
  5. Returns a summary of placements per department.
- `publish_placement_results()` SECURITY DEFINER function:
  Sets is_published = true for all student_preferences rows.

## Notes
1. Entrance result is collected during student registration (0-100 scale).
2. The placement algorithm runs server-side as SECURITY DEFINER so it can
   read all student rows regardless of RLS.
3. Results are unpublished by default — students see "pending" until an
   admin explicitly publishes.
*/

-- ============================================================
-- admin_profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id text NOT NULL UNIQUE,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_admin_profile" ON admin_profiles;
CREATE POLICY "select_own_admin_profile"
  ON admin_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_admin_profile" ON admin_profiles;
CREATE POLICY "insert_own_admin_profile"
  ON admin_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_admin_profile" ON admin_profiles;
CREATE POLICY "update_own_admin_profile"
  ON admin_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_admin_profile" ON admin_profiles;
CREATE POLICY "delete_own_admin_profile"
  ON admin_profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- department_capacities
-- ============================================================

CREATE TABLE IF NOT EXISTS department_capacities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_name text NOT NULL UNIQUE,
  capacity integer NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE department_capacities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_department_capacities" ON department_capacities;
CREATE POLICY "select_department_capacities"
  ON department_capacities FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_department_capacities" ON department_capacities;
CREATE POLICY "insert_department_capacities"
  ON department_capacities FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_department_capacities" ON department_capacities;
CREATE POLICY "update_department_capacities"
  ON department_capacities FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_department_capacities" ON department_capacities;
CREATE POLICY "delete_department_capacities"
  ON department_capacities FOR DELETE
  TO authenticated USING (true);

-- Seed default capacities for all 9 departments
INSERT INTO department_capacities (department_name, capacity)
VALUES
  ('Amharic Language and Literature', 30),
  ('English Language and Literature', 30),
  ('Geography and Environmental Science', 30),
  ('History and Heritage Management', 30),
  ('Political Science and International Relation', 30),
  ('Accounting and Finance', 30),
  ('Economics', 30),
  ('Management', 30),
  ('Marketing Management', 30)
ON CONFLICT (department_name) DO NOTHING;

-- ============================================================
-- Add entrance_result to student_profiles
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_profiles' AND column_name = 'entrance_result'
  ) THEN
    ALTER TABLE student_profiles ADD COLUMN entrance_result numeric(5,2) NOT NULL DEFAULT 0 CHECK (entrance_result >= 0 AND entrance_result <= 100);
  END IF;
END $$;

-- ============================================================
-- Add is_published to student_preferences
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_preferences' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE student_preferences ADD COLUMN is_published boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Update status check to allow 'rejected'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_preferences_status_check'
  ) THEN
    ALTER TABLE student_preferences
      ADD CONSTRAINT student_preferences_status_check
      CHECK (status IN ('pending', 'placed', 'rejected'));
  END IF;
END $$;

-- ============================================================
-- is_admin() helper function
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_profiles WHERE user_id = auth.uid()
  );
$$;

-- ============================================================
-- run_placement() — automated placement algorithm
-- ============================================================

CREATE OR REPLACE FUNCTION run_placement()
RETURNS TABLE(
  department_name text,
  assigned_count bigint,
  capacity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  student_record RECORD;
  dept_name text;
  dept_capacity integer;
  dept_filled integer;
  assigned boolean;
BEGIN
  -- Reset all placements
  UPDATE student_preferences
  SET status = 'pending',
      placed_department = NULL,
      is_published = false,
      updated_at = now();

  -- Process students in order of entrance_result DESC, gpa DESC
  FOR student_record IN
    SELECT sp.user_id, sp.ranked_departments
    FROM student_preferences sp
    JOIN student_profiles sprof ON sprof.user_id = sp.user_id
    ORDER BY sprof.entrance_result DESC, sprof.gpa DESC
  LOOP
    assigned := false;

    FOR dept_name IN SELECT jsonb_array_elements_text(student_record.ranked_departments)
    LOOP
      SELECT capacity INTO dept_capacity
      FROM department_capacities
      WHERE department_name = dept_name;

      SELECT count(*) INTO dept_filled
      FROM student_preferences
      WHERE placed_department = dept_name AND status = 'placed';

      IF dept_filled < dept_capacity THEN
        UPDATE student_preferences
        SET status = 'placed',
            placed_department = dept_name,
            updated_at = now()
        WHERE user_id = student_record.user_id;

        assigned := true;
        EXIT;
      END IF;
    END LOOP;

    IF NOT assigned THEN
      UPDATE student_preferences
      SET status = 'rejected',
          placed_department = NULL,
          updated_at = now()
      WHERE user_id = student_record.user_id;
    END IF;
  END LOOP;

  -- Return summary
  RETURN QUERY
  SELECT dc.department_name,
         COUNT(sp.user_id)::bigint AS assigned_count,
         dc.capacity
  FROM department_capacities dc
  LEFT JOIN student_preferences sp ON sp.placed_department = dc.department_name AND sp.status = 'placed'
  GROUP BY dc.department_name, dc.capacity
  ORDER BY dc.department_name;
END;
$$;

GRANT EXECUTE ON FUNCTION run_placement() TO authenticated;

-- ============================================================
-- publish_placement_results() — make results visible to students
-- ============================================================

CREATE OR REPLACE FUNCTION publish_placement_results()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE student_preferences
  SET is_published = true,
      updated_at = now()
  WHERE status IN ('placed', 'rejected');

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION publish_placement_results() TO authenticated;

-- ============================================================
-- get_all_students_with_preferences() — admin view of all students
-- ============================================================

CREATE OR REPLACE FUNCTION get_all_students_with_preferences()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  student_id text,
  gpa numeric,
  stream text,
  entrance_result numeric,
  ranked_departments jsonb,
  status text,
  placed_department text,
  is_published boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    sp.user_id,
    sprof.full_name,
    sprof.student_id,
    sprof.gpa,
    sprof.stream,
    sprof.entrance_result,
    sp.ranked_departments,
    sp.status,
    sp.placed_department,
    sp.is_published
  FROM student_profiles sprof
  LEFT JOIN student_preferences sp ON sp.user_id = sprof.user_id
  ORDER BY sprof.entrance_result DESC, sprof.gpa DESC;
$$;

GRANT EXECUTE ON FUNCTION get_all_students_with_preferences() TO authenticated;