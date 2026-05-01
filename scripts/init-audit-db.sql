-- Create audit database
CREATE DATABASE control_plane_audit;

-- Connect to audit database
\c control_plane_audit;

-- Create audit user with INSERT-only privileges
CREATE USER audit_writer WITH PASSWORD 'audit_writer_password';

-- Grant connect privilege
GRANT CONNECT ON DATABASE control_plane_audit TO audit_writer;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO audit_writer;

-- Grant CREATE on schema so migrations can create tables
GRANT CREATE ON SCHEMA public TO audit_writer;

-- We'll grant INSERT privilege on tables after they're created by migration