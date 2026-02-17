-- PantryPal Supabase Schema
-- Run this in your Supabase SQL Editor to create all required tables.
-- All column names use snake_case to match PostgreSQL conventions.
-- The app's sync service converts camelCase local columns to snake_case automatically.

-- ────────────────────────────────────────────────────────────────────────────
-- INGREDIENT CATEGORIES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredient_categories (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  user_id     TEXT REFERENCES auth.users(id) ON DELETE CASCADE,
  version     INTEGER DEFAULT 1,
  is_deleted  INTEGER DEFAULT 0,
  created_at  TEXT,
  updated_at  TEXT
);

ALTER TABLE ingredient_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own categories"
  ON ingredient_categories FOR ALL
  USING (auth.uid()::text = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- INGREDIENTS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredients (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  category_id             TEXT,
  default_shelf_life_days INTEGER,
  notify_start_days       INTEGER,
  notify_repeat_days      INTEGER,
  barcode                 TEXT,
  nutrition_data          TEXT,
  energy_kcal             REAL,
  protein_g               REAL,
  carbs_g                 REAL,
  fat_g                   REAL,
  fiber_g                 REAL,
  sugar_g                 REAL,
  sodium_mg               REAL,
  user_id                 TEXT REFERENCES auth.users(id) ON DELETE CASCADE,
  version                 INTEGER DEFAULT 1,
  is_deleted              INTEGER DEFAULT 0,
  created_at              TEXT,
  updated_at              TEXT
);

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ingredients"
  ON ingredients FOR ALL
  USING (auth.uid()::text = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- INVENTORY
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id            TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL,
  quantity      REAL NOT NULL,
  unit          TEXT NOT NULL,
  min_restock   REAL NOT NULL DEFAULT 1,
  expiry        TEXT,
  location      TEXT,
  barcode       TEXT,
  user_id       TEXT REFERENCES auth.users(id) ON DELETE CASCADE,
  version       INTEGER DEFAULT 1,
  is_deleted    INTEGER DEFAULT 0,
  created_at    TEXT,
  updated_at    TEXT
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own inventory"
  ON inventory FOR ALL
  USING (auth.uid()::text = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- RECIPES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  steps       TEXT,
  source_url  TEXT,
  source_name TEXT,
  imported_at TEXT,
  image_url   TEXT,
  prep_time   INTEGER,
  cook_time   INTEGER,
  servings    INTEGER,
  notes       TEXT,
  user_id     TEXT REFERENCES auth.users(id) ON DELETE CASCADE,
  version     INTEGER DEFAULT 1,
  is_deleted  INTEGER DEFAULT 0,
  created_at  TEXT,
  updated_at  TEXT
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recipes"
  ON recipes FOR ALL
  USING (auth.uid()::text = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- RECIPE INGREDIENTS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id     TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity      REAL NOT NULL,
  unit          TEXT NOT NULL,
  version       INTEGER DEFAULT 1,
  is_deleted    INTEGER DEFAULT 0,
  created_at    TEXT,
  updated_at    TEXT,
  PRIMARY KEY (recipe_id, ingredient_id)
);

-- recipe_ingredients inherits ownership via recipe; no user_id column needed.
-- RLS: allow if the referenced recipe belongs to the current user.
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage ingredients of own recipes"
  ON recipe_ingredients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_id
        AND r.user_id = auth.uid()::text
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- MEAL PLANS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_plans (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,
  meal_type   TEXT NOT NULL,
  recipe_id   TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  servings    INTEGER DEFAULT 1,
  notes       TEXT,
  completed   INTEGER DEFAULT 0,
  user_id     TEXT REFERENCES auth.users(id) ON DELETE CASCADE,
  version     INTEGER DEFAULT 1,
  is_deleted  INTEGER DEFAULT 0,
  created_at  TEXT,
  updated_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON meal_plans(user_id, date);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own meal plans"
  ON meal_plans FOR ALL
  USING (auth.uid()::text = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- NUTRITION LOGS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  recipe_id     TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  meal_type     TEXT,
  servings      REAL DEFAULT 1,
  total_kcal    REAL,
  total_protein REAL,
  total_carbs   REAL,
  total_fat     REAL,
  total_fiber   REAL,
  total_sugar   REAL,
  total_sodium  REAL,
  notes         TEXT,
  user_id       TEXT REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TEXT,
  updated_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date ON nutrition_logs(user_id, date);

ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own nutrition logs"
  ON nutrition_logs FOR ALL
  USING (auth.uid()::text = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- NUTRITION GOALS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_goals (
  user_id          TEXT PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_kcal_goal  REAL,
  protein_goal     REAL,
  carbs_goal       REAL,
  fat_goal         REAL,
  fiber_goal       REAL,
  sugar_goal       REAL,
  sodium_goal      REAL,
  updated_at       TEXT
);

ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own nutrition goals"
  ON nutrition_goals FOR ALL
  USING (auth.uid()::text = user_id);
