-- Schema from the former SUPABASE_SETUP.md (UUID user ids with foreign keys).
-- Kept only to check that new migrations also apply to projects created from that guide.
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
