import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/api/health', async (req: Request, res: Response) => {
  const configured = isSupabaseConfigured();
  let dbStatus = 'disconnected';
  let message = 'Supabase 憑證未配置 (可於前端輸入憑證或在 .env 中設定)';

  if (configured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.from('fire_configs').select('sync_code').limit(1);
        if (!error) {
          dbStatus = 'connected';
          message = 'Supabase PostgreSQL 資料庫連線正常！';
        } else {
          dbStatus = 'error';
          message = `Supabase 測試查詢失敗: ${error.message}`;
        }
      } catch (err: any) {
        dbStatus = 'error';
        message = `Supabase 連線異常: ${err.message || err}`;
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

app.get('/api/data', async (req: Request, res: Response) => {
  const syncCode = (req.query.syncCode as string) || 'FIRE-DEFAULT-2026';
  const supabase = getSupabaseClient();

  if (!supabase) {
    return res.json({
      success: false,
      mode: 'offline',
      message: 'Supabase 未連線，使用本地 LocalStorage 數據',
    });
  }

  try {
    const [txRes, catRes, configRes, presetRes, portRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('sync_code', syncCode).order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('sync_code', syncCode),
      supabase.from('fire_configs').select('*').eq('sync_code', syncCode).maybeSingle(),
      supabase.from('quick_presets').select('*').eq('sync_code', syncCode),
      supabase.from('portfolio_stocks').select('*').eq('sync_code', syncCode),
    ]);

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

    let portfolioStocks = (portRes.data || []).map((s: any) => ({
      id: s.id,
      symbol: s.symbol,
      name: s.name,
      market: s.market || 'US',
      shares: Number(s.shares),
      avgCost: Number(s.avg_cost),
      currentPrice: Number(s.current_price),
      currency: s.currency || 'USD',
      transactions: Array.isArray(s.transactions)
        ? s.transactions
        : typeof s.transactions === 'string'
        ? (() => {
            try {
              return JSON.parse(s.transactions);
            } catch (e) {
              return [];
            }
          })()
        : [],
    }));

    if (portfolioStocks.length === 0 && configRes.data && configRes.data.portfolio_stocks_json) {
      try {
        const parsedFallback = JSON.parse(configRes.data.portfolio_stocks_json);
        if (Array.isArray(parsedFallback)) {
          portfolioStocks = parsedFallback;
        }
      } catch (e) {}
    }

    return res.json({
      success: true,
      mode: 'supabase',
      syncCode,
      data: {
        transactions,
        categories: categories.length > 0 ? categories : null,
        fireConfig,
        quickPresets: quickPresets.length > 0 ? quickPresets : null,
        portfolioStocks,
      },
    });
  } catch (err: any) {
    console.error('[API /api/data Error]:', err);
    return res.status(500).json({ success: false, error: err.message || err });
  }
});

app.post('/api/data/sync', async (req: Request, res: Response) => {
  const { syncCode, transactions, categories, fireConfig, quickPresets, portfolioStocks } = req.body;
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
        portfolio_stocks_json: JSON.stringify(portfolioStocks || []),
        updated_at: new Date().toISOString(),
      });
    }

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

    if (Array.isArray(transactions)) {
      if (transactions.length > 0) {
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
      } else {
        await supabase.from('transactions').delete().eq('sync_code', targetSyncCode);
      }
    }

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

    if (Array.isArray(portfolioStocks)) {
      if (portfolioStocks.length > 0) {
        const portRows = portfolioStocks.map((s: any) => ({
          id: s.id,
          sync_code: targetSyncCode,
          symbol: s.symbol,
          name: s.name,
          market: s.market,
          shares: s.shares,
          avg_cost: s.avgCost,
          current_price: s.currentPrice,
          currency: s.currency,
          transactions: s.transactions || [],
          updated_at: new Date().toISOString(),
        }));
        try {
          await supabase.from('portfolio_stocks').upsert(portRows);
        } catch (e) {}
      } else {
        try {
          await supabase.from('portfolio_stocks').delete().eq('sync_code', targetSyncCode);
        } catch (e) {}
      }
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

const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
