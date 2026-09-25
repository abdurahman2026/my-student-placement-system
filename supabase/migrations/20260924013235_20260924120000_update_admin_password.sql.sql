/*
# Update ADMIN/001 password to abdu06941134++

Updates the default admin account's password so the demo credentials
work out-of-the-box. Uses auth.users encrypted_password column which
is set via the crypt() function with bf (blowfish) hashing.

## Notes
1. This updates the password for the existing ADMIN/001 auth user
   (email: admin/001@mau.edu.et) to "abdu06941134++".
2. This is a one-time fix so the provided demo credentials work.
*/

UPDATE auth.users
SET encrypted_password = crypt('abdu06941134++', gen_salt('bf'))
WHERE email = 'admin/001@mau.edu.et';