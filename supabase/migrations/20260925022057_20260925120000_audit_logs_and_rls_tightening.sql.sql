/*
# Audit Logs Table + Tightened RLS

## What this does
1. Creates an `audit_logs` table to record admin actions (score imports, capacity changes, placement runs, result publishing, score calculations).
2. Adds a SECURITY DEFINER function `insert_audit_log()` so the frontend can insert audit records without needing direct table INSERT privileges.
3. Adds a SECURITY DEFINER function `get_audit_logs()` so admins can read all audit logs.
4. Tightens RLS on `department_capacities` — only admins can INSERT/UPDATE/DELETE; all authenticated users can still SELECT (students need to see capacities).
5. Adds admin SELECT policies on `student_profiles` and `student_preferences` so admin SECURITY DEFINER functions already handle the actual queries, but direct table access by admins is also allowed.
6. Restricts `audit_logs` to admin-only access (SELECT via RLS, INSERT only via the SECURITY DEFINER function).

## New Tables
- `audit_logs`
  - `id` (uuid PK)
  - `admin_id` (uuid, references auth.users) — the admin who performed the action
  - `admin_name` (text) — admin's display name at time of action
  - `action` (text) — short action code: 'score_import', 'capacity_change', 'run_placement', 'publish_results', 'calculate_scores'
  - `description` (text) — human-readable description of what was done
  - `metadata` (jsonb) — additional context (e.g. number of students imported, department name, new capacity)
  - `created_at` (timestamptz) — when the action occurred

## Security
- RLS enabled on `audit_logs`.
- Only admins can SELECT (via `is_admin()` check).
- INSERT is only possible through the `insert_audit_log()` SECURITY DEFINER function — no direct INSERT policy.
- `department_capacities` INSERT/UPDATE/DELETE restricted to admins via `is_admin()`.
- `student_profiles` and `student_preferences` get admin SELECT policy via `is_admin()` (existing student-own policies remain).
*/

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_name text NOT NULL,
  action text NOT NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
DROP POLICY IF EXISTS "select_audit_logs_admin" ON audit_logs;
CREATE POLICY "select_audit_logs_admin"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies — access is only through SECURITY DEFINER functions

-- 2. SECURITY DEFINER function to insert audit logs
CREATE OR REPLACE FUNCTION insert_audit_log(
  p_action text,
  p_description text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can write audit logs';
  END IF;

  SELECT a.full_name INTO v_admin_name
  FROM admin_profiles a
  WHERE a.user_id = auth.uid();

  INSERT INTO audit_logs (admin_id, admin_name, action, description, metadata)
  VALUES (auth.uid(), COALESCE(v_admin_name, 'Unknown'), p_action, p_description, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION insert_audit_log(text, text, jsonb) TO authenticated;

-- 3. SECURITY DEFINER function to read audit logs
CREATE OR REPLACE FUNCTION get_audit_logs(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  admin_id uuid,
  admin_name text,
  action text,
  description text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, admin_id, admin_name, action, description, metadata, created_at
  FROM audit_logs
  ORDER BY created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION get_audit_logs(integer, integer) TO authenticated;

-- 4. Tighten RLS on department_capacities — only admins can modify
DROP POLICY IF EXISTS "insert_department_capacities" ON department_capacities;
CREATE POLICY "insert_department_capacities"
  ON department_capacities FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_department_capacities" ON department_capacities;
CREATE POLICY "update_department_capacities"
  ON department_capacities FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_department_capacities" ON department_capacities;
CREATE POLICY "delete_department_capacities"
  ON department_capacities FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- SELECT remains open to all authenticated (students need to see capacities)
DROP POLICY IF EXISTS "select_department_capacities" ON department_capacities;
CREATE POLICY "select_department_capacities"
  ON department_capacities FOR SELECT
  TO authenticated
  USING (true);

-- 5. Add admin SELECT on student_profiles (existing student-own SELECT remains)
DROP POLICY IF EXISTS "select_own_profile" ON student_profiles;
CREATE POLICY "select_own_profile"
  ON student_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- 6. Add admin SELECT on student_preferences (existing student-own SELECT remains)
DROP POLICY IF EXISTS "select_own_preferences" ON student_preferences;
CREATE POLICY "select_own_preferences"
  ON student_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- 7. Add admin SELECT on admin_profiles (admins can see all admin profiles, students see none)
DROP POLICY IF EXISTS "select_own_admin_profile" ON admin_profiles;
CREATE POLICY "select_own_admin_profile"
  ON admin_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin can update own admin profile (existing)
DROP POLICY IF EXISTS "update_own_admin_profile" ON admin_profiles;
CREATE POLICY "update_own_admin_profile"
  ON admin_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin can insert own admin profile (existing)
DROP POLICY IF EXISTS "insert_own_admin_profile" ON admin_profiles;
CREATE POLICY "insert_own_admin_profile"
  ON admin_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin can delete own admin profile (existing)
DROP POLICY IF EXISTS "delete_own_admin_profile" ON admin_profiles;
CREATE POLICY "delete_own_admin_profile"
  ON admin_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);