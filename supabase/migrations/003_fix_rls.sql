-- Migration 003: Fix Row Level Security policies
-- Addresses SEC-06 (household_members over-permissive policy) and SEC-10 (users table missing RLS)
-- Run this migration in the Supabase SQL editor after 002_family_sharing.sql

-- ============================================================
-- SEC-10: Enable RLS on the users table and add per-user policies
-- users.id is uuid type; auth.uid() returns uuid — compare without ::text cast
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT
  WITH CHECK (id = auth.uid());


-- ============================================================
-- SEC-06: Replace the overly-permissive household_members policy
--         with role-aware policies so only the owner can remove others
-- household_members.user_id is text; use ::text cast on auth.uid()
-- ============================================================

-- Drop the existing catch-all policy added in migration 002
DROP POLICY IF EXISTS "Users manage own household memberships" ON household_members;

-- Any member (or owner) can read rows in their own household
DROP POLICY IF EXISTS "Members can read household" ON household_members;
CREATE POLICY "Members can read household" ON household_members
  FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()::text
    )
    OR household_id IN (
      SELECT hm.household_id FROM household_members hm WHERE hm.user_id = auth.uid()::text
    )
  );

-- Only the household owner can insert/update/delete any member row
DROP POLICY IF EXISTS "Owners can manage members" ON household_members;
CREATE POLICY "Owners can manage members" ON household_members
  FOR ALL
  USING (
    household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()::text
    )
  );

-- Any member can delete their own row (to leave the household)
DROP POLICY IF EXISTS "Members can remove themselves" ON household_members;
CREATE POLICY "Members can remove themselves" ON household_members
  FOR DELETE
  USING (user_id = auth.uid()::text);
