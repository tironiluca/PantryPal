# Supabase Setup Guide for PantryPal

This guide will walk you through setting up Supabase for PantryPal's multi-user authentication and cloud sync features.

## Prerequisites

- A Supabase account (free tier available)
- Basic understanding of SQL
- [Optional] PostgreSQL 15+ locally, to run the migration tests

## Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in the details:
   - **Name:** PantryPal
   - **Database Password:** Choose a strong password (save this!)
   - **Region:** Choose closest to your users
4. Click "Create new project"
5. Wait for the project to be provisioned (~2 minutes)

## Step 2: Get Your API Credentials

1. In your Supabase project dashboard, click "Settings" (gear icon)
2. Click "API" in the sidebar
3. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (under "Project API keys")

## Step 3: Configure PantryPal

1. Copy `.env.example` to `.env`.
2. Set `SUPABASE_URL` to your project URL and `SUPABASE_ANON_KEY` to the public anon/client key.
3. Run `npm start` for development or `npm run build` for a production build.

The Angular environment files are generated from these variables and are ignored by git. Do not commit credentials or add them to source files. Configure the same variables as protected build or deployment secrets in CI.

## Step 4: Apply the Database Migrations

The schema, row-level security policies and server functions live in `supabase/migrations/`. That folder is the single source of truth; earlier versions of this guide contained a different, incompatible schema.

In the Supabase dashboard, open **SQL Editor** and run each file in order, one query per file:

1. `001_initial_schema.sql` - data tables and owner-only policies. Safe to re-run; it no longer drops tables.
2. `002_family_sharing.sql` - household tables.
3. `003_fix_rls.sql` - **skip on new projects.** It needs a `public.users` table that no earlier migration creates, and its household policies recurse. 004 creates `users` and replaces those policies. Never run 003 after 004.
4. `004_household_rpcs_and_account_deletion.sql` - working household sharing, server-set `updated_at`, and the `delete_my_account()` function. Runs in one transaction and is safe to re-run.

**Existing projects** only need `004_household_rpcs_and_account_deletion.sql`. It applies on top of either the 001-003 schema (TEXT user ids) or the schema from the old version of this guide (UUID user ids).

Until 004 is applied, creating or joining a household and deleting an account fail with an error in the app.

### Verifying migrations locally

`scripts/test-supabase-sql.sh` applies the migrations to throwaway databases on any PostgreSQL 15+ server, using a small stand-in for Supabase's `auth` schema, and runs the behaviour tests in `supabase/tests/` as the `authenticated` role. CI runs it on every push.

```bash
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres ./scripts/test-supabase-sql.sh
```

### Recipe fetcher (optional, recommended)

`supabase/functions/recipe-proxy` fetches recipe pages server-side, so signed-in users' recipe URLs are not sent to third-party CORS proxies. It refuses private and local network targets, follows at most three validated redirects, and caps responses at 2 MB and 10 seconds. Deploy it with the Supabase CLI:

```bash
supabase functions deploy recipe-proxy --project-ref <your-project-ref>
```

Until it is deployed, the app falls back to the third-party proxies.

## Step 5: Configure URLs for Sign-In Redirects

In **Authentication -> URL Configuration**:

- **Site URL:** your production origin, for example `https://pantry-vibe-pal.vercel.app`
- **Redirect URLs:** add `https://<your-domain>/**`. This covers the OAuth return to `/home` and the password-reset link to `/auth/reset-password`. Add `http://localhost:4200/**` for local development.

## Step 6: Configure Authentication

1. In Supabase dashboard, go to "Authentication" → "Providers"
2. Enable the auth providers you want:
   - ✅ **Email** (enabled by default)
   - **Google** (optional - requires OAuth setup)
   - **GitHub** (optional - requires OAuth setup)
3. Configure email templates:
   - Go to "Authentication" → "Email Templates"
   - Customize "Confirm signup", "Magic Link", "Reset password" templates if desired

## Step 7: Set Up Realtime (Optional, for live sync)

1. Go to "Database" → "Replication"
2. Enable replication for these tables:
   - `inventory`
   - `ingredients`
   - `recipes`
   - `meal_plans`
3. This allows real-time sync across devices

## Step 8: Test Your Setup

1. Start the PantryPal dev server: `npm start`
2. Navigate to the login page
3. Try creating a new account
4. Check the Supabase dashboard → "Authentication" → "Users" to see your new user

## Troubleshooting

### "Invalid API key" error
- Double-check that you copied the **anon/public** key, not the service_role key
- Ensure there are no extra spaces or quotes in the environment files

### "Row Level Security policy violation" or "infinite recursion detected in policy" errors
- Apply `supabase/migrations/004_household_rpcs_and_account_deletion.sql`; the household policies from 002/003 recurse and block households entirely.
- Check that RLS is enabled on the affected table

### Authentication not working
- Verify your Supabase URL is correct (should include `https://` and `.supabase.co`)
- Check browser console for detailed error messages
- Ensure email provider is enabled in Authentication settings

### Data not syncing
- Check the Network tab in browser dev tools for failed API calls
- Verify RLS policies allow the current user to access the data
- Check the browser console: failed tables are logged as `Failed to push <table>` or `Failed to pull <table>`

## Next Steps

Once Supabase is configured:
1. ✅ Users can sign up and log in
2. ✅ Local data will be synced to the cloud
3. ✅ Multi-device sync will work
4. ✅ Data is isolated per user (RLS)

For development, you can use the free tier which includes:
- 500 MB database space
- 50,000 monthly active users
- 2 GB bandwidth
- Unlimited API requests

Happy cooking! 🍳
