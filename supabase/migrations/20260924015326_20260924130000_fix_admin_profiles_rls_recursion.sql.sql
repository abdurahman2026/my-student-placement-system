/*
# Fix recursive RLS on admin_profiles

## Problem
The `select_all_admins` SELECT policy uses:
  EXISTS (SELECT 1 FROM admin_profiles ap WHERE ap.user_id = auth.uid())
This is recursive — the subquery on admin_profiles goes through RLS,
which requires the same EXISTS check, creating infinite recursion.
The result: the policy returns no rows, so admin sign-in fails
because the onAuthStateChange handler can't load the admin profile.

## Fix
Revert the SELECT policy to a simple owner-scoped check:
  auth.uid() = user_id
This allows each admin to read their own row (which is all that's
needed for the auth flow). The Admin Management panel lists all
admins via the edge function, which uses the service role key and
bypasses RLS entirely.

## Security
- SELECT: owner-scoped (auth.uid() = user_id)
- INSERT/UPDATE/DELETE: unchanged (owner-scoped)
- Listing all admins: handled by edge function with service role key
*/

DROP POLICY IF EXISTS "select_all_admins" ON admin_profiles;
DROP POLICY IF EXISTS "select_own_admin_profile" ON admin_profiles;

CREATE POLICY "select_own_admin_profile"
  ON admin_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);