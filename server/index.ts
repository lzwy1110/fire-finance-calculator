import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '10mb' }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 1. 健康檢查與 Supabase 連線狀態
app.get('/api/health', async (req: Request, res: Response) => {
  const configured = isSupabaseConfigured();
  let dbStatus = 'disconnected';
  let message = 'Supabase 憑證未配置或未設定 (運行為離線/本地模式)';

  if (configured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.from('fire_configs').select('sync_code').limit(1);
        if (!error) {
          dbStatus = 'connected';
          message = 'Supabase 資料庫連線正常！';
        } else {
          dbStatus = 'error';
          message = `Supabase 查詢測試異常: ${error.message}`;
        }
      } catch (err: any) {
        dbStatus = 'error';
        message = `Supabase 連線失敗: ${err.message || err}`;
      }
    }
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabase: {
      configured,
      dbStatus,
      message,
    },
  });
});

// 2. 取得指定 syncCode 的全量資料 (Full Backup Load)
app.get('/api/data', async (req: Request, res: Response) => {
  const syncCode = (req.query.syncCode as string) || 'FIRE-DEFAULT-2026';
  const supabase = getSupabaseClient();

  if (!supabase) {
    return res.json({
      success: false,
      mode: 'offline',
      message: 'Supabase 未配置，請於前端使用 LocalStorage 或填入憑證',
    });
  }

  try {
    // 併行查詢四張表
    const [txRes, catRes, configRes, presetRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('sync_code', syncCode).order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('sync_code', syncCode),
      supabase.from('fire_configs').select('*').eq('sync_code', syncCode).single(),
      supabase.from('quick_presets').select('*').eq('sync_code', syncCode),
    ]);

    // 格式轉換 (DB camel_case -> Frontend schema)
    const transactions = (txRes.data || []).map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      mainCategory: t.main_category,
      subCategory: t.sub_category,
      date: t.date,
      note: t.note,
      tags: t.tags || [],
      isQuickPreset: t.is_quick_preset,
    }));

    const categories = (catRes.data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
      subCategories: c.sub_categories || [],
    }));

    let fireConfig = null;
    if (configRes.data) {
      const cfg = configRes.data;
      fireConfig = {
        currentAge: Number(cfg.current_age),
        targetRetirementAge: Number(cfg.target_retirement_age),
        currentNetWorth: Number(cfg.current_net_worth),
        monthlyIncome: Number(cfg.monthly_income),
        monthlyExpenses: Number(cfg.monthly_expenses),
        monthlyTax: Number(cfg.monthly_tax),
        monthlyInvestment: Number(cfg.monthly_investment),
        targetAnnualExpensePostRetirement: Number(cfg.target_annual_expense_post_retirement),
        expectedInvestmentReturnRate: Number(cfg.expected_investment_return_rate),
        expectedInflationRate: Number(cfg.expected_inflation_rate),
        safeWithdrawalRate: Number(cfg.safe_withdrawal_rate),
        currencySymbol: cfg.currency_symbol,
        themeColor: cfg.theme_color,
      };
    }

    const quickPresets = (presetRes.data || []).map((p: any) => ({
      id: p.id,
      label: p.label,
      mainCategory: p.main_category,
      subCategory: p.sub_category,
      amount: Number(p.amount),
      icon: p.icon,
    }));

    return res.json({
      success: true,
      mode: 'supabase',
      syncCode,
      data: {
        transactions,
        categories: categories.length > 0 ? categories : null,
        fireConfig,
        quickPresets: quickPresets.length > 0 ? quickPresets : null,
      },
    });
  } catch (err: any) {
    console.error('[API /api/data Error]:', err);
    return res.status(500).json({ success: false, error: err.message || err });
  }
});

// 3. 全量備份同步 (Full Backup Push to Supabase)
app.post('/api/data/sync', async (req: Request, res: Response) => {
  const { syncCode, transactions, categories, fireConfig, quickPresets } = req.body;
  const targetSyncCode = syncCode || 'FIRE-DEFAULT-2026';
  const supabase = getSupabaseClient();

  if (!supabase) {
    return res.json({
      success: false,
      mode: 'offline',
      message: 'Supabase 未連線，數據已保持於本地儲存',
    });
  }

  try {
    // 1. 同步 FIRE Config
    if (fireConfig) {
      await supabase.from('fire_configs').upsert({
        sync_code: targetSyncCode,
        current_age: fireConfig.currentAge,
        target_retirement_age: fireConfig.targetRetirementAge,
        current_net_worth: fireConfig.currentNetWorth,
        monthly_income: fireConfig.monthlyIncome,
        monthly_expenses: fireConfig.monthlyExpenses,
        monthly_tax: fireConfig.monthlyTax,
        monthly_investment: fireConfig.monthlyInvestment,
        target_annual_expense_post_retirement: fireConfig.targetAnnualExpensePostRetirement,
        expected_investment_return_rate: fireConfig.expectedInvestmentReturnRate,
        expected_inflation_rate: fireConfig.expectedInflationRate,
        safe_withdrawal_rate: fireConfig.safeWithdrawalRate,
        currency_symbol: fireConfig.currencySymbol,
        theme_color: fireConfig.themeColor || 'cyan',
        updated_at: new Date().toISOString(),
      });
    }

    // 2. 同步 Categories
    if (Array.isArray(categories) && categories.length > 0) {
      const catRows = categories.map((c: any) => ({
        id: c.id,
        sync_code: targetSyncCode,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
        sub_categories: c.subCategories || [],
        updated_at: new Date().toISOString(),
      }));
      await supabase.from('categories').upsert(catRows);
    }

    // 3. 同步 Transactions
    if (Array.isArray(transactions) && transactions.length > 0) {
      const txRows = transactions.map((t: any) => ({
        id: t.id,
        sync_code: targetSyncCode,
        type: t.type,
        amount: t.amount,
        main_category: t.mainCategory,
        sub_category: t.subCategory || '',
        date: t.date,
        note: t.note || '',
        tags: t.tags || [],
        is_quick_preset: Boolean(t.isQuickPreset),
        updated_at: new Date().toISOString(),
      }));
      await supabase.from('transactions').upsert(txRows);
    }

    // 4. 同步 Quick Presets
    if (Array.isArray(quickPresets) && quickPresets.length > 0) {
      const presetRows = quickPresets.map((p: any) => ({
        id: p.id,
        sync_code: targetSyncCode,
        label: p.label,
        main_category: p.mainCategory,
        sub_category: p.subCategory,
        amount: p.amount,
        icon: p.icon || 'Zap',
        updated_at: new Date().toISOString(),
      }));
      await supabase.from('quick_presets').upsert(presetRows);
    }

    return res.json({
      success: true,
      mode: 'supabase',
      lastSyncedAt: new Date().toISOString(),
      message: '全量數據已成功備份與同步至 Supabase！',
    });
  } catch (err: any) {
    console.error('[API /api/data/sync Error]:', err);
    return res.status(500).json({ success: false, error: err.message || err });
  }
});

// 4. 單筆/批次 交易 CRUD
app.post('/api/transactions', async (req: Request, res: Response) => {
  const { syncCode, transaction } = req.body;
  const targetSyncCode = syncCode || 'FIRE-DEFAULT-2026';
  const supabase = getSupabaseClient();

  if (!supabase) {
    return res.json({ success: false, mode: 'offline' });
  }

  try {
    const row = {
      id: transaction.id,
      sync_code: targetSyncCode,
      type: transaction.type,
      amount: transaction.amount,
      main_category: transaction.mainCategory,
      sub_category: transaction.subCategory || '',
      date: transaction.date,
      note: transaction.note || '',
      tags: transaction.tags || [],
      is_quick_preset: Boolean(transaction.isQuickPreset),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('transactions').upsert(row);
    if (error) throw error;

    return res.json({ success: true, mode: 'supabase' });
  } catch (err: any) {
    console.error('[API /api/transactions Error]:', err);
    return res.status(500).json({ success: false, error: err.message || err });
  }
});

app.delete('/api/transactions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const syncCode = (req.query.syncCode as string) || 'FIRE-DEFAULT-2026';
  const supabase = getSupabaseClient();

  if (!supabase) {
    return res.json({ success: false, mode: 'offline' });
  }

  try {
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('sync_code', syncCode);
    if (error) throw error;

    return res.json({ success: true, mode: 'supabase' });
  } catch (err: any) {
    console.error('[API /api/transactions delete Error]:', err);
    return res.status(500).json({ success: false, error: err.message || err });
  }
});

// 5. 單獨儲存 FIRE Config
app.post('/api/config', async (req: Request, res: Response) => {
  const { syncCode, config } = req.body;
  const targetSyncCode = syncCode || 'FIRE-DEFAULT-2026';
  const supabase = getSupabaseClient();

  if (!supabase) {
    return res.json({ success: false, mode: 'offline' });
  }

  try {
    const { error } = await supabase.from('fire_configs').upsert({
      sync_code: targetSyncCode,
      current_age: config.currentAge,
      target_retirement_age: config.targetRetirementAge,
      current_net_worth: config.currentNetWorth,
      monthly_income: config.monthlyIncome,
      monthly_expenses: config.monthlyExpenses,
      monthly_tax: config.monthlyTax,
      monthly_investment: config.monthlyInvestment,
      target_annual_expense_post_retirement: config.targetAnnualExpensePostRetirement,
      expected_investment_return_rate: config.expectedInvestmentReturnRate,
      expected_inflation_rate: config.expectedInflationRate,
      safe_withdrawal_rate: config.safeWithdrawalRate,
      currency_symbol: config.currencySymbol,
      theme_color: config.themeColor || 'cyan',
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
    return res.json({ success: true, mode: 'supabase' });
  } catch (err: any) {
    console.error('[API /api/config Error]:', err);
    return res.status(500).json({ success: false, error: err.message || err });
  }
});

// 啟動 Express HTTP 伺服器
app.listen(PORT, () => {
  console.log(`🚀 FIRE Flow Full-Stack Backend API Server is running on http://localhost:${PORT}`);
  console.log(`📡 Supabase database status: ${isSupabaseConfigured() ? '✅ Configured' : '⚠️ Offline/Local Mode'}`);
});
