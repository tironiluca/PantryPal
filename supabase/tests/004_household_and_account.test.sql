-- Behaviour tests for migration 004. Run by scripts/test-supabase-sql.sh after the shim and migrations.
-- Every check runs as the `authenticated` role, so RLS applies exactly as it does through the API.
-- A failed check raises an exception and stops the run (psql -v ON_ERROR_STOP=1).

\set QUIET on
\pset tuples_only on
SET client_min_messages = notice;

-- Accounts: owner Olive, member Mia, invitee Ivan, outsider Otto.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'olive@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'mia@example.test'),
  ('00000000-0000-0000-0000-00000000000c', 'ivan@example.test'),
  ('00000000-0000-0000-0000-00000000000d', 'otto@example.test');
-- Eve signed up with an address she has not confirmed.
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
  ('00000000-0000-0000-0000-00000000000e', 'eve@example.test', NULL);
INSERT INTO public.users (id, email, display_name) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'olive@example.test', 'Olive'),
  ('00000000-0000-0000-0000-00000000000b', 'mia@example.test', 'Mia'),
  ('00000000-0000-0000-0000-00000000000c', 'ivan@example.test', 'Ivan'),
  ('00000000-0000-0000-0000-00000000000d', 'otto@example.test', 'Otto'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@example.test', 'Eve');

CREATE OR REPLACE FUNCTION tests.expect(p_ok boolean, p_message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', p_message; END IF;
  RAISE NOTICE 'ok - %', p_message;
END $$;

-- Runs a statement and asserts it raises an error whose message contains p_fragment.
CREATE OR REPLACE FUNCTION tests.expect_error(p_sql text, p_fragment text, p_message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FAILED: % (no error raised)', p_message;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  IF position(lower(p_fragment) IN lower(SQLERRM)) = 0 THEN
    RAISE EXCEPTION 'FAILED: % (unexpected error: %)', p_message, SQLERRM;
  END IF;
  RAISE NOTICE 'ok - %', p_message;
END $$;
GRANT EXECUTE ON FUNCTION tests.expect(boolean, text), tests.expect_error(text, text, text) TO authenticated;

-- Seed one ingredient per user, inserted as the service owner (bypasses RLS).
INSERT INTO public.ingredients (id, name, user_id, updated_at)
SELECT gen_random_uuid(), 'Item of ' || email, id, '2000-01-01T00:00:00.000Z'
FROM auth.users;

SET ROLE authenticated;

-- ── Creating a household ───────────────────────────────────────────────────
SELECT tests.login('00000000-0000-0000-0000-00000000000a', 'olive@example.test');
SELECT tests.expect_error($$INSERT INTO public.households (id, name, owner_id) VALUES ('x', 'Direct', '00000000-0000-0000-0000-00000000000a')$$,
  'row-level security', 'households cannot be inserted directly');
SELECT tests.expect_error($$SELECT public.create_household('   ')$$, '1-100 characters', 'blank household names are rejected');
SELECT set_config('tests.household', public.create_household('Olive home'), false);
SELECT tests.expect((SELECT count(*) FROM public.households) = 1, 'owner reads the household she created');
SELECT tests.expect((SELECT role FROM public.household_members WHERE user_id = '00000000-0000-0000-0000-00000000000a') = 'owner',
  'creator is recorded as owner');
SELECT tests.expect_error($$SELECT public.create_household('Second home')$$, 'already belong', 'a user cannot create a second household');

-- ── Inviting ───────────────────────────────────────────────────────────────
SELECT tests.expect_error($$SELECT public.invite_household_member('not-an-email')$$, 'valid email', 'invalid invitation emails are rejected');
SELECT set_config('tests.invite_mia', public.invite_household_member(' Mia@Example.test '), false);
SELECT set_config('tests.invite_ivan', public.invite_household_member('ivan@example.test'), false);
SELECT tests.expect(public.invite_household_member('mia@example.test') = current_setting('tests.invite_mia'),
  're-inviting returns the existing pending invitation');
SELECT set_config('tests.invite_eve', public.invite_household_member('eve@example.test'), false);
SELECT tests.expect((SELECT count(*) FROM public.household_invitations) = 3, 'members read their household invitations');

-- Unconfirmed address: the invitation stays invisible and cannot be accepted.
SELECT tests.login('00000000-0000-0000-0000-00000000000e', 'eve@example.test');
SELECT tests.expect((SELECT count(*) FROM public.household_invitations) = 0, 'an unconfirmed email cannot read invitations sent to it');
SELECT tests.expect((SELECT count(*) FROM public.my_pending_invitations()) = 0, 'an unconfirmed email has no pending invitations');
SELECT tests.expect_error(format('SELECT public.accept_household_invitation(%L)', current_setting('tests.invite_eve')),
  'not found', 'an unconfirmed email cannot accept an invitation');

-- Outsider: sees nothing and cannot invite.
SELECT tests.login('00000000-0000-0000-0000-00000000000d', 'otto@example.test');
SELECT tests.expect((SELECT count(*) FROM public.households) = 0, 'outsider cannot read the household');
SELECT tests.expect((SELECT count(*) FROM public.household_members) = 0, 'outsider cannot read members');
SELECT tests.expect((SELECT count(*) FROM public.household_invitations) = 0, 'outsider cannot read other people''s invitations');
SELECT tests.expect((SELECT count(*) FROM public.my_pending_invitations()) = 0, 'outsider has no pending invitations');
SELECT tests.expect_error($$SELECT public.invite_household_member('otto2@example.test')$$, 'not in a household', 'non-members cannot invite');
SELECT tests.expect_error(format('SELECT public.accept_household_invitation(%L)', current_setting('tests.invite_mia')),
  'not found', 'an invitation cannot be accepted by someone else');
SELECT tests.expect_error($$INSERT INTO public.household_members (household_id, user_id) VALUES (current_setting('tests.household'), '00000000-0000-0000-0000-00000000000d')$$,
  'row-level security', 'membership rows cannot be inserted directly');

-- ── Accepting ──────────────────────────────────────────────────────────────
SELECT tests.login('00000000-0000-0000-0000-00000000000b', 'mia@example.test');
SELECT tests.expect((SELECT count(*) FROM public.household_invitations) = 1, 'invitee reads only her own invitation');
SELECT tests.expect((SELECT household_name FROM public.my_pending_invitations()) = 'Olive home', 'invitee sees the household name before joining');
SELECT tests.expect(public.accept_household_invitation(current_setting('tests.invite_mia')) = current_setting('tests.household'),
  'invitee accepts and joins');
SELECT tests.expect((SELECT count(*) FROM public.household_members) = 2, 'member reads both members');
SELECT tests.expect((SELECT count(*) FROM public.household_member_details() WHERE email = 'olive@example.test' AND display_name = 'Olive') = 1,
  'member details include other members'' emails and names');
SELECT tests.expect_error(format('SELECT public.accept_household_invitation(%L)', current_setting('tests.invite_mia')),
  'not found', 'an accepted invitation cannot be reused');

-- ── Shared reads, owner-only writes ────────────────────────────────────────
SELECT tests.expect((SELECT count(*) FROM public.ingredients) = 2, 'member reads her own and the owner''s ingredients, not others''');
UPDATE public.ingredients SET name = 'hijacked' WHERE user_id::text = '00000000-0000-0000-0000-00000000000a';
SELECT tests.expect((SELECT name FROM public.ingredients WHERE user_id::text = '00000000-0000-0000-0000-00000000000a') <> 'hijacked',
  'members cannot modify each other''s rows');
SELECT tests.expect_error($$SELECT public.remove_household_member('00000000-0000-0000-0000-00000000000a')$$,
  'only the household owner', 'members cannot remove others');

-- ── Server-owned updated_at ───────────────────────────────────────────────
UPDATE public.ingredients SET name = 'Renamed', updated_at = '1999-01-01T00:00:00.000Z'
WHERE user_id::text = '00000000-0000-0000-0000-00000000000b';
SELECT tests.expect((SELECT updated_at::text > '2020' AND updated_at::text NOT LIKE '1999%' FROM public.ingredients
                     WHERE user_id::text = '00000000-0000-0000-0000-00000000000b'),
  'updated_at is set by the server, not the client');

-- ── Declining, leaving and ownership hand-over ────────────────────────────
SELECT tests.login('00000000-0000-0000-0000-00000000000c', 'ivan@example.test');
SELECT public.decline_household_invitation(current_setting('tests.invite_ivan'));
SELECT tests.expect((SELECT count(*) FROM public.my_pending_invitations()) = 0, 'declined invitations disappear');

SELECT tests.login('00000000-0000-0000-0000-00000000000a', 'olive@example.test');
SELECT public.leave_household();
SELECT tests.login('00000000-0000-0000-0000-00000000000b', 'mia@example.test');
SELECT tests.expect((SELECT owner_id FROM public.households) = '00000000-0000-0000-0000-00000000000b',
  'when the owner leaves, the remaining member becomes owner');
SELECT tests.expect((SELECT count(*) FROM public.ingredients) = 1, 'a former member''s data is no longer shared');

-- ── Account deletion ──────────────────────────────────────────────────────
SELECT public.delete_my_account();
RESET ROLE;
SELECT tests.expect(NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000000b'), 'the auth account is deleted');
SELECT tests.expect(NOT EXISTS (SELECT 1 FROM public.users WHERE id::text = '00000000-0000-0000-0000-00000000000b'), 'the profile is deleted');
SELECT tests.expect(NOT EXISTS (SELECT 1 FROM public.ingredients WHERE user_id::text = '00000000-0000-0000-0000-00000000000b'), 'the user''s data is deleted');
SELECT tests.expect(NOT EXISTS (SELECT 1 FROM public.households), 'a household left empty is deleted');
SELECT tests.expect(EXISTS (SELECT 1 FROM public.ingredients WHERE user_id::text = '00000000-0000-0000-0000-00000000000a'),
  'other users'' data is untouched');

SET ROLE anon;
SELECT set_config('request.jwt.claims', '{}', false);
SELECT tests.expect_error($$SELECT public.delete_my_account()$$, 'permission denied', 'anonymous callers cannot use the account functions');
SELECT tests.expect((SELECT count(*) FROM public.households) = 0 AND (SELECT count(*) FROM public.household_invitations) = 0,
  'signed-out reads of household tables return nothing instead of an error');
SELECT tests.expect((SELECT count(*) FROM public.ingredients) = 0, 'signed-out reads of shared data tables return nothing instead of an error');
RESET ROLE;

\echo 'All migration 004 checks passed.'
