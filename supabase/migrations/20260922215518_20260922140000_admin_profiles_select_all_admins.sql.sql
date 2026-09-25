/*
# Update admin_profiles RLS: allow admins to see all admin rows

## Overview
The admin management feature requires existing admins to see a list of
all admin accounts. Currently, the SELECT policy on admin_profiles is
owner-scoped (auth.uid() = user_id), so an admin can only see their own
row. We update the SELECT policy to allow any authenticated user who has
a row in admin_profiles to see all admin rows.

INSERT, UPDATE, and DELETE remain owner-scoped — the edge function
handles creating/editing/deleting other admins using the service role
key, so those policies don't need to change.

## Security
- SELECT: any authenticated admin can see all admin_profiles rows.
  Predicate: EXISTS (SELECT 1 FROM admin_profiles ap WHERE ap.user_id = auth.uid())
  This ensures only verified admins can list other admins.
- INSERT/UPDATE/DELETE: unchanged (owner-scoped, used for self-service).
*/

-- Update SELECT policy to allow admins to see all admins
DROP POLICY IF EXISTS "select_own_admin_profile" ON admin_profiles;
DROP POLICY IF EXISTS "select_all_admins" ON admin_profiles;

CREATE POLICY "select_all_admins"
  ON admin_profiles FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM admin_profiles ap WHERE ap.user_id = auth.uid()
    )
  );

-- Keep INSERT owner-scoped (self-registration, now only used by edge function)
DROP POLICY IF EXISTS "insert_own_admin_profile" ON admin_profiles;
CREATE POLICY "insert_own_admin_profile"
  ON admin_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Keep UPDATE owner-scoped
DROP POLICY IF EXISTS "update_own_admin_profile" ON admin_profiles;
CREATE POLICY "update_own_admin_profile"
  ON admin_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Keep DELETE owner-scoped
DROP POLICY IF EXISTS "delete_own_admin_profile" ON admin_profiles;
CREATE POLICY "delete_own_admin_profile"
  ON admin_profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);