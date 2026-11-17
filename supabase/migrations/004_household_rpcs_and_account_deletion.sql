-- Migration 004: working households, server-owned timestamps, and account deletion.
--
-- Fixes (see IMPLEMENTATION_PLAN.md B5, B6, A1):
--   * households could not be created, joined or read: their RLS policies required membership
--     before the first member row existed, referenced each other recursively (42P17), read
--     auth.users (permission denied), and compared an unqualified household_id to itself.
--   * invitees had no way to join, and only inventory/ingredients were visible to members.
--   * "delete account" deleted nothing: users had no DELETE policy and the auth user remained.
--   * updated_at was written by each device's clock, so sync could skip rows.
--
-- Membership changes now go through SECURITY DEFINER functions; tables only expose reads.
-- Written to apply to projects created from either migrations 001-003 (TEXT user ids) or the
-- former SUPABASE_SETUP.md (UUID user ids): every comparison casts user ids to text.
-- Idempotent: safe to run more than once. Runs in one transaction, so a failure changes nothing.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables this migration relies on (no-ops where they already exist)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  display_name  TEXT,
  avatar_url    TEXT,
  preferences   JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (id::text = auth.uid()::text);
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (id::text = auth.uid()::text);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (id::text = auth.uid()::text);

CREATE TABLE IF NOT EXISTS public.households (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  owner_id   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'member',
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.household_invitations (
  id            TEXT PRIMARY KEY,
  household_id  TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_at    TIMESTAMPTZ DEFAULT NOW(),
  status        TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_invitations_email ON public.household_invitations(lower(invited_email));
-- The app supports one household per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_household_members_one_household ON public.household_members(user_id);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;

-- Columns the app syncs that projects created from the former SUPABASE_SETUP.md lack.
-- Sync uploads every local column, so one missing column rejects that table's whole push,
-- and the pull filters on updated_at.
DO $$
BEGIN
  IF to_regclass('public.ingredients') IS NOT NULL THEN
    ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS barcode TEXT;
    ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS sugar_g REAL;
  END IF;
  IF to_regclass('public.recipe_ingredients') IS NOT NULL THEN
    ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS created_at TEXT;
    ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS updated_at TEXT;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Membership helpers. SECURITY DEFINER so policies can call them without
-- re-entering household_members' own RLS (which caused infinite recursion).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_household_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid()::text LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_household_member(p_household_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id AND user_id = auth.uid()::text
  )
$$;

CREATE OR REPLACE FUNCTION public.shares_household_with(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.household_members mine
    JOIN public.household_members theirs ON theirs.household_id = mine.household_id
    WHERE mine.user_id = auth.uid()::text AND theirs.user_id = p_user_id
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Household policies: replace whatever exists (names differ between setups).
-- Reads only; every write goes through the functions below.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('households', 'household_members', 'household_invitations')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "Members read their household" ON public.households
  FOR SELECT USING (public.is_household_member(id));

CREATE POLICY "Owner renames household" ON public.households
  FOR UPDATE USING (owner_id = auth.uid()::text) WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Members read household members" ON public.household_members
  FOR SELECT USING (public.is_household_member(household_id));

CREATE POLICY "Invitees and members read invitations" ON public.household_invitations
  FOR SELECT USING (
    lower(invited_email) = lower(auth.jwt() ->> 'email')
    OR public.is_household_member(household_invitations.household_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Household functions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_household(p_name text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_name text := btrim(coalesce(p_name, ''));
  v_id text := gen_random_uuid()::text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  IF v_name = '' OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'Household name must be 1-100 characters' USING ERRCODE = '22023';
  END IF;
  IF public.current_household_id() IS NOT NULL THEN
    RAISE EXCEPTION 'You already belong to a household' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.households (id, name, owner_id) VALUES (v_id, v_name, v_uid);
  INSERT INTO public.household_members (household_id, user_id, role) VALUES (v_id, v_uid, 'owner');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.invite_household_member(p_email text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_household text := public.current_household_id();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_existing text;
  v_id text := gen_random_uuid()::text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  IF v_household IS NULL THEN RAISE EXCEPTION 'You are not in a household' USING ERRCODE = '42501'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.household_members hm JOIN auth.users u ON u.id::text = hm.user_id
    WHERE hm.household_id = v_household AND lower(u.email) = v_email
  ) THEN
    RAISE EXCEPTION 'That person is already a member' USING ERRCODE = '23505';
  END IF;

  SELECT id INTO v_existing FROM public.household_invitations
  WHERE household_id = v_household AND lower(invited_email) = v_email AND status = 'pending';
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.household_invitations (id, household_id, invited_email) VALUES (v_id, v_household, v_email);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.my_pending_invitations()
RETURNS TABLE (id text, household_id text, household_name text, invited_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT i.id, i.household_id, h.name, i.invited_at
  FROM public.household_invitations i
  JOIN public.households h ON h.id = i.household_id
  WHERE i.status = 'pending' AND lower(i.invited_email) = lower(auth.jwt() ->> 'email')
  ORDER BY i.invited_at
$$;

CREATE OR REPLACE FUNCTION public.accept_household_invitation(p_invitation_id text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_household text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;

  SELECT household_id INTO v_household FROM public.household_invitations
  WHERE id = p_invitation_id AND status = 'pending' AND lower(invited_email) = lower(auth.jwt() ->> 'email')
  FOR UPDATE;
  IF v_household IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or already used' USING ERRCODE = 'P0002';
  END IF;
  IF public.current_household_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Leave your current household before joining another' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.household_members (household_id, user_id, role) VALUES (v_household, v_uid, 'member');
  UPDATE public.household_invitations SET status = 'accepted' WHERE id = p_invitation_id;
  RETURN v_household;
END $$;

CREATE OR REPLACE FUNCTION public.decline_household_invitation(p_invitation_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  UPDATE public.household_invitations SET status = 'declined'
  WHERE id = p_invitation_id AND status = 'pending' AND lower(invited_email) = lower(auth.jwt() ->> 'email');
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found or already used' USING ERRCODE = 'P0002'; END IF;
END $$;

-- Members of the caller's household, with emails, which members cannot read from auth.users directly.
CREATE OR REPLACE FUNCTION public.household_member_details()
RETURNS TABLE (user_id text, email text, display_name text, role text, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT hm.user_id, u.email, p.display_name, hm.role, hm.joined_at
  FROM public.household_members hm
  LEFT JOIN auth.users u ON u.id::text = hm.user_id
  LEFT JOIN public.users p ON p.id::text = hm.user_id
  WHERE hm.household_id = public.current_household_id()
  ORDER BY hm.joined_at
$$;

-- Leaving: an owner hands ownership to the longest-standing member, or deletes an empty household.
CREATE OR REPLACE FUNCTION public.leave_household() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_household text := public.current_household_id();
  v_successor text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  IF v_household IS NULL THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.households WHERE id = v_household AND owner_id = v_uid) THEN
    SELECT user_id INTO v_successor FROM public.household_members
    WHERE household_id = v_household AND user_id <> v_uid
    ORDER BY joined_at, user_id LIMIT 1;

    IF v_successor IS NULL THEN
      DELETE FROM public.households WHERE id = v_household;
      RETURN;
    END IF;
    UPDATE public.households SET owner_id = v_successor, updated_at = now() WHERE id = v_household;
    UPDATE public.household_members SET role = 'owner' WHERE household_id = v_household AND user_id = v_successor;
  END IF;

  DELETE FROM public.household_members WHERE household_id = v_household AND user_id = v_uid;
END $$;

CREATE OR REPLACE FUNCTION public.remove_household_member(p_user_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_household text := public.current_household_id();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  IF p_user_id = v_uid THEN
    PERFORM public.leave_household();
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.households WHERE id = v_household AND owner_id = v_uid) THEN
    RAISE EXCEPTION 'Only the household owner can remove other members' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.household_members WHERE household_id = v_household AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That person is not a member' USING ERRCODE = 'P0002'; END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read access to household members' data. Writes stay owner-only until rows carry
-- a household_id (plan item A2).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ingredient_categories', 'ingredients', 'inventory', 'recipes', 'meal_plans'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Household shared ' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Household members read ' || t, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (public.shares_household_with(user_id::text))',
        'Household members read ' || t, t);
    END IF;
  END LOOP;

  IF to_regclass('public.recipe_ingredients') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Household members read recipe_ingredients" ON public.recipe_ingredients';
    EXECUTE $p$
      CREATE POLICY "Household members read recipe_ingredients" ON public.recipe_ingredients
      FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.recipes r
        WHERE r.id = recipe_ingredients.recipe_id AND public.shares_household_with(r.user_id::text)
      ))
    $p$;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Server-owned updated_at. Stored in the same ISO-8601 UTC form the app writes
-- ("2026-01-01T00:00:00.000Z"), which also casts cleanly into TIMESTAMPTZ columns.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_server_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW := jsonb_populate_record(NEW, jsonb_build_object(
    'updated_at', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ));
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ingredient_categories', 'ingredients', 'inventory', 'recipes', 'recipe_ingredients',
                           'meal_plans', 'nutrition_logs', 'nutrition_goals'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS set_server_updated_at ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER set_server_updated_at BEFORE INSERT OR UPDATE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at()', t);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Account deletion: removes every row the user owns, their household membership
-- (handing over or deleting an owned household), and the auth account itself.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_my_account() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  t text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  PERFORM public.leave_household();
  IF v_email IS NOT NULL THEN
    DELETE FROM public.household_invitations WHERE lower(invited_email) = lower(v_email);
  END IF;

  IF to_regclass('public.recipe_ingredients') IS NOT NULL AND to_regclass('public.recipes') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.recipe_ingredients ri USING public.recipes r
             WHERE r.id = ri.recipe_id AND r.user_id::text = $1' USING v_uid::text;
  END IF;

  FOREACH t IN ARRAY ARRAY['meal_plans', 'nutrition_logs', 'nutrition_goals', 'inventory', 'recipes',
                           'ingredients', 'ingredient_categories', 'sync_log'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id') THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id::text = $1', t) USING v_uid::text;
    END IF;
  END LOOP;

  DELETE FROM public.users WHERE id::text = v_uid::text;
  DELETE FROM auth.users WHERE id = v_uid;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Function privileges: callable by signed-in users only.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'current_household_id()', 'is_household_member(text)', 'shares_household_with(text)',
    'create_household(text)', 'invite_household_member(text)', 'my_pending_invitations()',
    'accept_household_invitation(text)', 'decline_household_invitation(text)',
    'household_member_details()', 'leave_household()', 'remove_household_member(text)',
    'delete_my_account()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

COMMIT;
