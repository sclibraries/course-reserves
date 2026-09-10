-- Local Docker development seed: creates a default admin user
-- This runs after 01-dump.sql so it inserts safely after the schema is ready.
-- Credentials: username=devadmin, password is not used (JWT bypass in authorize-local.php)

USE reserves;

INSERT INTO users (username, full_name, email, role, department, institution, approved, created_at)
VALUES (
    'devadmin',
    'Dev Admin',
    'devadmin@localhost.dev',
    'admin',
    'Library Systems',
    'SM',
    1,
    NOW()
)
ON DUPLICATE KEY UPDATE
    full_name  = VALUES(full_name),
    role       = VALUES(role),
    approved   = VALUES(approved);
