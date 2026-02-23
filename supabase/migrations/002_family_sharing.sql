-- Family/Household Sharing
-- Run this migration in your Supabase SQL editor or via the Supabase CLI

-- Households table
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Household members
CREATE TABLE IF NOT EXISTS household_members (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (household_id, user_id)
);

-- Household invitations
CREATE TABLE IF NOT EXISTS household_invitations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' -- 'pending' | 'accepted' | 'declined'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_invitations_email ON household_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_household_invitations_household ON household_invitations(household_id);

-- Enable Row Level Security
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invitations ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see/manage households they belong to
DROP POLICY IF EXISTS "Users manage own households" ON households;
CREATE POLICY "Users manage own households"
  ON households FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users manage own household memberships" ON household_members;
CREATE POLICY "Users manage own household memberships"
  ON household_members FOR ALL
  USING (
    household_members.user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM household_members hm2
      WHERE hm2.household_id = household_members.household_id
        AND hm2.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users manage own invitations" ON household_invitations;
CREATE POLICY "Users manage own invitations"
  ON household_invitations FOR ALL
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_id
        AND hm.user_id = auth.uid()::text
    )
  );

-- Update existing table RLS to allow household members to see shared data
-- Example for inventory: allow access if user is in the same household
-- Apply similar updates to ingredients, recipes, meal_plans

-- Note: The existing `user_id = auth.uid()` policies must be extended.
-- Run these updates after the tables already have RLS enabled.

-- Inventory: allow household sharing
DROP POLICY IF EXISTS "Household shared inventory" ON inventory;
CREATE POLICY "Household shared inventory"
  ON inventory FOR SELECT
  USING (
    inventory.user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM household_members hm1
      JOIN household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid()::text
        AND hm2.user_id = inventory.user_id
    )
  );

-- Ingredients: allow household sharing
DROP POLICY IF EXISTS "Household shared ingredients" ON ingredients;
CREATE POLICY "Household shared ingredients"
  ON ingredients FOR SELECT
  USING (
    ingredients.user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM household_members hm1
      JOIN household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid()::text
        AND hm2.user_id = ingredients.user_id
    )
  );
