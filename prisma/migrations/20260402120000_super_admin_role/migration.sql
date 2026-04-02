-- Existing admins become super admins so they keep full access including new role management.
UPDATE "User" SET role = 'SUPER_ADMIN' WHERE role = 'ADMIN';
