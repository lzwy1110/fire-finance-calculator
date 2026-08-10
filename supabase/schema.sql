-- ==============================================================================
-- FIRE 財務與退休進度計算器 - Supabase 資料庫建表與初始化 SQL
-- ==============================================================================

-- 1. 記帳交易明細表 (Transactions)
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    sync_code TEXT NOT NULL DEFAULT 'FIRE-DEFAULT-2026',
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'investment', 'tax')),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    main_category TEXT NOT NULL,
    sub_category TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL, -- YYYY-MM-DD
    note TEXT DEFAULT '',
    tags JSONB DEFAULT '[]'::jsonb,
    is_quick_preset BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引加速同同步碼與日期查詢
CREATE INDEX IF NOT EXISTS idx_transactions_sync_code ON public.transactions(sync_code);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);

-- 2. 分類與細項設定表 (Categories)
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    sync_code TEXT NOT NULL DEFAULT 'FIRE-DEFAULT-2026',
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'investment', 'tax')),
    icon TEXT NOT NULL DEFAULT 'Tag',
    color TEXT NOT NULL DEFAULT '#10b981',
    sub_categories JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_sync_code ON public.categories(sync_code);

-- 3. FIRE 退休財務規劃參數表 (FIRE Configs)
CREATE TABLE IF NOT EXISTS public.fire_configs (
    sync_code TEXT PRIMARY KEY,
    current_age INT NOT NULL DEFAULT 30,
    target_retirement_age INT NOT NULL DEFAULT 50,
    current_net_worth NUMERIC(15, 2) NOT NULL DEFAULT 3500000,
    monthly_income NUMERIC(15, 2) NOT NULL DEFAULT 85000,
    monthly_expenses NUMERIC(15, 2) NOT NULL DEFAULT 35000,
    monthly_tax NUMERIC(15, 2) NOT NULL DEFAULT 4500,
    monthly_investment NUMERIC(15, 2) NOT NULL DEFAULT 30000,
    target_annual_expense_post_retirement NUMERIC(15, 2) NOT NULL DEFAULT 480000,
    expected_investment_return_rate NUMERIC(5, 2) NOT NULL DEFAULT 7.0,
    expected_inflation_rate NUMERIC(5, 2) NOT NULL DEFAULT 2.5,
    safe_withdrawal_rate NUMERIC(5, 2) NOT NULL DEFAULT 4.0,
    currency_symbol TEXT NOT NULL DEFAULT 'NT$',
    theme_color TEXT NOT NULL DEFAULT 'cyan',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 桌面與快捷記帳預設表 (Quick Presets)
CREATE TABLE IF NOT EXISTS public.quick_presets (
    id TEXT PRIMARY KEY,
    sync_code TEXT NOT NULL DEFAULT 'FIRE-DEFAULT-2026',
    label TEXT NOT NULL,
    main_category TEXT NOT NULL,
    sub_category TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    icon TEXT DEFAULT 'Zap',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quick_presets_sync_code ON public.quick_presets(sync_code);

-- 啟用 Row Level Security (RLS) 並允許公開 API KEY (Anon) 讀寫
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fire_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_presets ENABLE ROW LEVEL SECURITY;

-- 建立通用讀寫 Policy (允許所有具備 anon/authenticated 權限之請求)
DROP POLICY IF EXISTS "Allow public access to transactions" ON public.transactions;
CREATE POLICY "Allow public access to transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to categories" ON public.categories;
CREATE POLICY "Allow public access to categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to fire_configs" ON public.fire_configs;
CREATE POLICY "Allow public access to fire_configs" ON public.fire_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to quick_presets" ON public.quick_presets;
CREATE POLICY "Allow public access to quick_presets" ON public.quick_presets FOR ALL USING (true) WITH CHECK (true);
