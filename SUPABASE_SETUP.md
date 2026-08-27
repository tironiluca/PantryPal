# Supabase Setup Guide for PantryPal

This guide will walk you through setting up Supabase for PantryPal's multi-user authentication and cloud sync features.

## Prerequisites

- A Supabase account (free tier available)
- Basic understanding of SQL

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

## Step 4: Set Up Database Tables

The app will create local SQLite tables, but you need to set up Supabase tables for cloud sync.

### Create Tables via SQL Editor

1. In Supabase dashboard, go to "SQL Editor"
2. Click "New query"
3. Paste and run the following SQL:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synchronized with auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ingredient Categories
CREATE TABLE public.ingredient_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE,
  version INTEGER DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ingredients
CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.ingredient_categories(id) ON DELETE SET NULL,
  default_shelf_life_days INTEGER,
  notify_start_days INTEGER,
  notify_repeat_days INTEGER,
  nutrition_data JSONB,
  energy_kcal REAL,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  fiber_g REAL,
  sodium_mg REAL,
  image_url TEXT,
  synced_at TIMESTAMP WITH TIME ZONE,
  version INTEGER DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  min_restock REAL NOT NULL DEFAULT 0,
  expiry TIMESTAMP WITH TIME ZONE,
  location TEXT,
  barcode TEXT,
  synced_at TIMESTAMP WITH TIME ZONE,
  version INTEGER DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recipes
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  steps TEXT,
  source_url TEXT,
  source_name TEXT,
  imported_at TIMESTAMP WITH TIME ZONE,
  image_url TEXT,
  prep_time INTEGER,
  cook_time INTEGER,
  servings INTEGER,
  notes TEXT,
  synced_at TIMESTAMP WITH TIME ZONE,
  version INTEGER DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recipe Ingredients
CREATE TABLE public.recipe_ingredients (
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE,
  version INTEGER DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (recipe_id, ingredient_id)
);

-- Meal Plans
CREATE TABLE public.meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  servings INTEGER DEFAULT 1,
  notes TEXT,
  completed BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP WITH TIME ZONE,
  version INTEGER DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nutrition Logs
CREATE TABLE public.nutrition_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  servings REAL,
  total_kcal REAL,
  total_protein REAL,
  total_carbs REAL,
  total_fat REAL,
  synced_at TIMESTAMP WITH TIME ZONE,
  version INTEGER DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nutrition Goals
CREATE TABLE public.nutrition_goals (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  daily_kcal_goal REAL,
  protein_goal REAL,
  carbs_goal REAL,
  fat_goal REAL,
  synced_at TIMESTAMP WITH TIME ZONE,
  version INTEGER DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync Log
CREATE TABLE public.sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('push', 'pull', 'conflict')),
  record_id UUID,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN,
  error_message TEXT
);

-- Create indexes for better query performance
CREATE INDEX idx_ingredient_categories_user ON public.ingredient_categories(user_id);
CREATE INDEX idx_ingredients_user ON public.ingredients(user_id);
CREATE INDEX idx_inventory_user ON public.inventory(user_id);
CREATE INDEX idx_recipes_user ON public.recipes(user_id);
CREATE INDEX idx_meal_plans_user_date ON public.meal_plans(user_id, date);
CREATE INDEX idx_nutrition_logs_user_date ON public.nutrition_logs(user_id, date);
CREATE INDEX idx_inventory_barcode ON public.inventory(barcode) WHERE barcode IS NOT NULL;
```

4. Click "Run" to execute the SQL

## Step 5: Set Up Row Level Security (RLS)

Row Level Security ensures users can only access their own data.

### Enable RLS

Run this SQL to enable RLS on all tables:

```sql
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
```

### Create RLS Policies

Run this SQL to create policies that allow users to only access their own data:

```sql
-- Users table policies
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Ingredient categories policies
CREATE POLICY "Users can view own categories"
  ON public.ingredient_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own categories"
  ON public.ingredient_categories FOR ALL
  USING (auth.uid() = user_id);

-- Ingredients policies
CREATE POLICY "Users can view own ingredients"
  ON public.ingredients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own ingredients"
  ON public.ingredients FOR ALL
  USING (auth.uid() = user_id);

-- Inventory policies
CREATE POLICY "Users can view own inventory"
  ON public.inventory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own inventory"
  ON public.inventory FOR ALL
  USING (auth.uid() = user_id);

-- Recipes policies
CREATE POLICY "Users can view own recipes"
  ON public.recipes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own recipes"
  ON public.recipes FOR ALL
  USING (auth.uid() = user_id);

-- Recipe ingredients policies
CREATE POLICY "Users can view recipe ingredients"
  ON public.recipe_ingredients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.recipes
    WHERE recipes.id = recipe_ingredients.recipe_id
    AND recipes.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage recipe ingredients"
  ON public.recipe_ingredients FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.recipes
    WHERE recipes.id = recipe_ingredients.recipe_id
    AND recipes.user_id = auth.uid()
  ));

-- Meal plans policies
CREATE POLICY "Users can view own meal plans"
  ON public.meal_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own meal plans"
  ON public.meal_plans FOR ALL
  USING (auth.uid() = user_id);

-- Nutrition logs policies
CREATE POLICY "Users can view own nutrition logs"
  ON public.nutrition_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own nutrition logs"
  ON public.nutrition_logs FOR ALL
  USING (auth.uid() = user_id);

-- Nutrition goals policies
CREATE POLICY "Users can view own nutrition goals"
  ON public.nutrition_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own nutrition goals"
  ON public.nutrition_goals FOR ALL
  USING (auth.uid() = user_id);

-- Sync log policies
CREATE POLICY "Users can view own sync logs"
  ON public.sync_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync logs"
  ON public.sync_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

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

### "Row Level Security policy violation" error
- Make sure you ran all the RLS policy SQL statements
- Check that RLS is enabled on the affected table

### Authentication not working
- Verify your Supabase URL is correct (should include `https://` and `.supabase.co`)
- Check browser console for detailed error messages
- Ensure email provider is enabled in Authentication settings

### Data not syncing
- Check the Network tab in browser dev tools for failed API calls
- Verify RLS policies allow the current user to access the data
- Check the `sync_log` table in Supabase for error messages

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
