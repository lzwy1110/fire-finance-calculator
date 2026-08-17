import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CategoryItem, FIREConfig, QuickPreset, Transaction } from '../types';
import { PortfolioStock } from '../types/portfolio';

let supabaseClient: SupabaseClient | null = null;

// Standard public fallback credentials for quick connection
const DEFAULT_SUPABASE_URL = 'https://xyzcompany.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY3MjUxMjAwMCwiZXhwIjoyMDE4MDg4MDAwfQ.placeholder';

export function cleanSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/rest\/v1$/i, '');
  url = url.replace(/\/rest\/v1\/$/i, '');
  return url.replace(/\/+$/, '');
}

export function getFrontendSupabaseCredentials(): { url: string; anonKey: string } | null {
  const rawUrl = localStorage.getItem('fire_supabase_url');
  const anonKey = localStorage.getItem('fire_supabase_anon_key');

  if (!rawUrl || !anonKey) {
    return null;
  }

  const url = cleanSupabaseUrl(rawUrl);

  if (url && anonKey && !url.includes('xyzcompany.supabase.co')) {
    return { url, anonKey: anonKey.trim() };
  }
  return null;
}

export function getFrontendSupabaseClient(): SupabaseClient | null {
  const creds = getFrontendSupabaseCredentials();
  if (!creds) return null;

  if (!supabaseClient) {
    try {
      supabaseClient = createClient(creds.url, creds.anonKey, {
        auth: { persistSession: false },
      });
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return supabaseClient;
}

export function isFrontendSupabaseReady(): boolean {
  return Boolean(getFrontendSupabaseClient());
}

/**
 * 測試前端 Supabase 連線狀態
 */
export async function checkFrontendSupabaseHealth(): Promise<{
  connected: boolean;
  message: string;
  mode: string;
}> {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) {
    return {
      connected: false,
      message: 'Supabase 未配置 (可於設定輸入 URL 與 Anon Key)',
      mode: 'offline',
    };
  }

  try {
    const { error } = await supabase.from('fire_configs').select('sync_code').limit(1);
    if (!error) {
      return {
        connected: true,
        message: '前端 Supabase 直連連線正常！',
        mode: 'supabase-direct',
      };
    }
    return {
      connected: false,
      message: `Supabase 連線失敗: ${error.message}`,
      mode: 'error',
    };
  } catch (err: any) {
    return {
      connected: false,
      message: `Supabase 異常: ${err.message || err}`,
      mode: 'error',
    };
  }
}

/**
 * 從 Supabase 讀取全量備份 (前端直連)
 */
export async function fetchSupabaseDataDirect(syncCode: string) {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return null;

  try {
    const [txRes, catRes, configRes, presetRes, portRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('sync_code', syncCode).order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('sync_code', syncCode),
      supabase.from('fire_configs').select('*').eq('sync_code', syncCode).maybeSingle(),
      supabase.from('quick_presets').select('*').eq('sync_code', syncCode),
      supabase.from('portfolio_stocks').select('*').eq('sync_code', syncCode),
    ]);

    const transactions: Transaction[] = (txRes.data || []).map((t: any) => ({
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

    const categories: CategoryItem[] = (catRes.data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
      subCategories: c.sub_categories || [],
    }));

    let fireConfig: FIREConfig | null = null;
    if (configRes.data) {
      const cfg = configRes.data;
      const cashSavingsTWD = Number(cfg.cash_savings ?? cfg.current_net_worth ?? 0);
      const cashSavingsUSD = Number(cfg.cash_savings_usd ?? 0);
      const usdRate = Number(cfg.usd_rate ?? 32.0);
      const baseCashBalance = Number(cfg.base_cash_balance ?? cfg.cash_savings ?? cashSavingsTWD);

      fireConfig = {
        currentAge: Number(cfg.current_age),
        targetRetirementAge: Number(cfg.target_retirement_age),
        currentNetWorth: Number(cfg.current_net_worth),
        cashSavings: cashSavingsTWD,
        cashSavingsTWD: cashSavingsTWD,
        cashSavingsUSD: cashSavingsUSD,
        usdRate: usdRate > 0 ? usdRate : 32.0,
        baseCashBalance: baseCashBalance,
        monthlyIncome: Number(cfg.monthly_income),
        monthlyExpenses: Number(cfg.monthly_expenses),
        monthlyTax: Number(cfg.monthly_tax),
        monthlyInvestment: Number(cfg.monthly_investment),
        targetAnnualExpensePostRetirement: Number(cfg.target_annual_expense_post_retirement),
        expectedInvestmentReturnRate: Number(cfg.expected_investment_return_rate),
        expectedInflationRate: Number(cfg.expected_inflation_rate),
        safeWithdrawalRate: Number(cfg.safe_withdrawal_rate),
        currencySymbol: cfg.currency_symbol || 'NT$',
        themeColor: cfg.theme_color || 'cyan',
      };
    }

    const quickPresets: QuickPreset[] = (presetRes.data || []).map((p: any) => ({
      id: p.id,
      label: p.label,
      mainCategory: p.main_category,
      subCategory: p.sub_category,
      amount: Number(p.amount),
      icon: p.icon,
    }));

    const portfolioStocks: PortfolioStock[] = (portRes.data || []).map((s: any) => ({
      id: String(s.id),
      symbol: String(s.symbol || ''),
      name: String(s.name || s.symbol || ''),
      market: s.market || 'US',
      shares: Number(s.shares) || 0,
      avgCost: Number(s.avg_cost) || 0,
      currentPrice: Number(s.current_price) || 0,
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

    return {
      transactions: txRes.error ? null : transactions,
      categories: catRes.error ? null : (categories.length > 0 ? categories : null),
      fireConfig,
      quickPresets: presetRes.error ? null : (quickPresets.length > 0 ? quickPresets : null),
      portfolioStocks: portRes.error ? null : portfolioStocks,
    };
  } catch (err) {
    console.error('[Supabase Direct Fetch Error]:', err);
    return null;
  }
}

/**
 * 推送全量備份至 Supabase (前端直連 - 標準關聯式結構)
 */
export async function pushSupabaseDataDirect(payload: {
  syncCode: string;
  transactions?: Transaction[];
  categories?: CategoryItem[];
  fireConfig?: FIREConfig;
  quickPresets?: QuickPreset[];
  portfolioStocks?: PortfolioStock[];
}) {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return false;

  const { syncCode, transactions, categories, fireConfig, quickPresets, portfolioStocks } = payload;
  const targetSyncCode = syncCode || 'FIRE-DEFAULT-2026';

  try {
    // 1. 寫入 FIRE Config
    if (fireConfig) {
      const configRow = {
        sync_code: targetSyncCode,
        current_age: fireConfig.currentAge,
        target_retirement_age: fireConfig.targetRetirementAge,
        current_net_worth: fireConfig.currentNetWorth,
        cash_savings: fireConfig.cashSavingsTWD != null ? fireConfig.cashSavingsTWD : (fireConfig.cashSavings || 0),
        cash_savings_usd: fireConfig.cashSavingsUSD != null ? fireConfig.cashSavingsUSD : 0,
        usd_rate: fireConfig.usdRate != null ? fireConfig.usdRate : 32.0,
        base_cash_balance: fireConfig.baseCashBalance != null ? fireConfig.baseCashBalance : 0,
        monthly_income: fireConfig.monthlyIncome,
        monthly_expenses: fireConfig.monthlyExpenses,
        monthly_tax: fireConfig.monthlyTax,
        monthly_investment: fireConfig.monthlyInvestment,
        target_annual_expense_post_retirement: fireConfig.targetAnnualExpensePostRetirement,
        expected_investment_return_rate: fireConfig.expectedInvestmentReturnRate,
        expected_inflation_rate: fireConfig.expectedInflationRate,
        safe_withdrawal_rate: fireConfig.safeWithdrawalRate,
        currency_symbol: fireConfig.currencySymbol || 'NT$',
        theme_color: fireConfig.themeColor || 'cyan',
        updated_at: new Date().toISOString(),
      };

      const res = await supabase.from('fire_configs').upsert(configRow);
      if (res.error) {
        console.error('[Supabase fire_configs Upsert Error]:', res.error);
      }
    }

    // 2. 寫入 Categories
    if (Array.isArray(categories) && categories.length > 0) {
      const catRows = categories.map((c) => ({
        id: c.id,
        sync_code: targetSyncCode,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
        sub_categories: c.subCategories || [],
        updated_at: new Date().toISOString(),
      }));
      const res = await supabase.from('categories').upsert(catRows);
      if (res.error) console.error('[Supabase categories Upsert Error]:', res.error);
    }

    // 3. 寫入 Transactions
    if (Array.isArray(transactions)) {
      if (transactions.length > 0) {
        const txRows = transactions.map((t) => ({
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
        const res = await supabase.from('transactions').upsert(txRows);
        if (res.error) console.error('[Supabase transactions Upsert Error]:', res.error);
      } else {
        await supabase.from('transactions').delete().eq('sync_code', targetSyncCode);
      }
    }

    // 4. 寫入 Quick Presets
    if (Array.isArray(quickPresets) && quickPresets.length > 0) {
      const presetRows = quickPresets.map((p) => ({
        id: p.id,
        sync_code: targetSyncCode,
        label: p.label,
        main_category: p.mainCategory,
        sub_category: p.subCategory,
        amount: p.amount,
        icon: p.icon || 'Zap',
        updated_at: new Date().toISOString(),
      }));
      const res = await supabase.from('quick_presets').upsert(presetRows);
      if (res.error) console.error('[Supabase quick_presets Upsert Error]:', res.error);
    }

    // 5. 寫入 Portfolio Stocks
    if (Array.isArray(portfolioStocks)) {
      if (portfolioStocks.length > 0) {
        const portRows = portfolioStocks.map((s) => ({
          id: String(s.id),
          sync_code: targetSyncCode,
          symbol: String(s.symbol || '').toUpperCase(),
          name: String(s.name || s.symbol || ''),
          market: s.market === 'TW' ? 'TW' : 'US',
          shares: Number(s.shares) || 0,
          avg_cost: Number(s.avgCost) || 0,
          current_price: Number(s.currentPrice) || 0,
          currency: s.currency === 'TWD' ? 'TWD' : 'USD',
          transactions: Array.isArray(s.transactions) ? s.transactions : [],
          updated_at: new Date().toISOString(),
        }));
        const currentIds = portfolioStocks.map((s) => String(s.id));
        const res = await supabase.from('portfolio_stocks').upsert(portRows);
        if (res.error) {
          console.error('[Supabase portfolio_stocks Upsert Error]:', res.error);
        }
        
        // 安全精準清理已在前端被刪除的股票
        try {
          const { data: existingRows } = await supabase
            .from('portfolio_stocks')
            .select('id')
            .eq('sync_code', targetSyncCode);
          if (Array.isArray(existingRows)) {
            const currentIdSet = new Set(currentIds);
            const toDelete = existingRows.filter((r) => !currentIdSet.has(r.id)).map((r) => r.id);
            if (toDelete.length > 0) {
              await supabase.from('portfolio_stocks').delete().in('id', toDelete);
            }
          }
        } catch (delErr) {}
      } else {
        await supabase.from('portfolio_stocks').delete().eq('sync_code', targetSyncCode);
      }
    }

    return true;
  } catch (err) {
    console.error('[Supabase Direct Push Error]:', err);
    return false;
  }
}

export function getCustomCredentials(): { url: string; anonKey: string; key: string } {
  const rawUrl = localStorage.getItem('fire_supabase_url') || '';
  const anonKey = localStorage.getItem('fire_supabase_anon_key') || '';
  const url = cleanSupabaseUrl(rawUrl);
  return { url, anonKey: anonKey.trim(), key: anonKey.trim() };
}

export function saveCustomCredentials(url: string, anonKey: string): void {
  const cleanedUrl = cleanSupabaseUrl(url);
  const cleanedKey = anonKey.trim();
  if (cleanedUrl && cleanedKey) {
    localStorage.setItem('fire_supabase_url', cleanedUrl);
    localStorage.setItem('fire_supabase_anon_key', cleanedKey);
    supabaseClient = null;
  }
}

export async function testSupabaseDirectConnection(url?: string, anonKey?: string): Promise<{ success: boolean; message: string }> {
  try {
    const creds = getFrontendSupabaseCredentials();
    const targetUrl = cleanSupabaseUrl(url || creds?.url || '');
    const targetKey = (anonKey || creds?.anonKey || '').trim();

    if (!targetUrl || !targetKey) {
      return { success: false, message: 'Supabase URL 與 Anon Key 不能為空' };
    }

    const tempClient = createClient(targetUrl, targetKey, { auth: { persistSession: false } });
    const { error } = await tempClient.from('fire_configs').select('sync_code').limit(1);
    if (!error) return { success: true, message: 'Supabase 資料庫連線測試成功！' };
    return { success: false, message: `連線失敗: ${error.message}` };
  } catch (e: any) {
    return { success: false, message: `無法連線: ${e.message || e}` };
  }
}

export async function saveTransactionDirect(tx: Transaction, syncCode: string): Promise<boolean> {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return false;
  try {
    await supabase.from('transactions').upsert({
      id: tx.id,
      sync_code: syncCode,
      type: tx.type,
      amount: tx.amount,
      main_category: tx.mainCategory,
      sub_category: tx.subCategory || '',
      date: tx.date,
      note: tx.note || '',
      tags: tx.tags || [],
      is_quick_preset: Boolean(tx.isQuickPreset),
      updated_at: new Date().toISOString(),
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteTransactionDirect(id: string, syncCode: string): Promise<boolean> {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return false;
  try {
    await supabase.from('transactions').delete().eq('id', id).eq('sync_code', syncCode);
    return true;
  } catch (e) {
    return false;
  }
}

export async function saveFIREConfigDirect(config: FIREConfig, syncCode: string): Promise<boolean> {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return false;
  try {
    const themeWithMeta = JSON.stringify({
      theme: config.themeColor || 'sakura',
      cashSavings: config.cashSavings != null ? config.cashSavings : 0,
      baseCashBalance: config.baseCashBalance != null ? config.baseCashBalance : 0,
    });

    const configData: any = {
      sync_code: syncCode,
      current_age: config.currentAge,
      target_retirement_age: config.targetRetirementAge,
      current_net_worth: config.currentNetWorth,
      cash_savings: config.cashSavings,
      base_cash_balance: config.baseCashBalance,
      monthly_income: config.monthlyIncome,
      monthly_expenses: config.monthlyExpenses,
      monthly_tax: config.monthlyTax,
      monthly_investment: config.monthlyInvestment,
      target_annual_expense_post_retirement: config.targetAnnualExpensePostRetirement,
      expected_investment_return_rate: config.expectedInvestmentReturnRate,
      expected_inflation_rate: config.expectedInflationRate,
      safe_withdrawal_rate: config.safeWithdrawalRate,
      currency_symbol: config.currencySymbol,
      theme_color: themeWithMeta,
      updated_at: new Date().toISOString(),
    };

    // Ensure fallback metadata is updated with latest cash savings
    try {
      const existing = await supabase.from('fire_configs').select('portfolio_stocks_json').eq('sync_code', syncCode).maybeSingle();
      let existingStocks = [];
      if (existing.data && (existing.data as any).portfolio_stocks_json) {
        try {
          const parsed = JSON.parse((existing.data as any).portfolio_stocks_json);
          if (Array.isArray(parsed)) existingStocks = parsed;
          else if (parsed && Array.isArray(parsed.stocks)) existingStocks = parsed.stocks;
        } catch (e) {}
      }
      configData.portfolio_stocks_json = JSON.stringify({
        stocks: existingStocks,
        _metaConfig: {
          cashSavings: config.cashSavings,
          baseCashBalance: config.baseCashBalance,
        },
      });
    } catch (e) {}

    const res1 = await supabase.from('fire_configs').upsert(configData);
    if (res1.error) {
      console.warn('[Supabase saveFIREConfigDirect error, retrying with core schema columns]:', res1.error.message);
      const coreData = {
        sync_code: syncCode,
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
        theme_color: themeWithMeta,
        updated_at: new Date().toISOString(),
      };
      await supabase.from('fire_configs').upsert(coreData);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function clearCloudDataDirect(syncCode: string): Promise<boolean> {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return false;
  const cleanCode = syncCode.trim().toUpperCase();
  try {
    await Promise.allSettled([
      supabase.from('transactions').delete().eq('sync_code', cleanCode),
      supabase.from('categories').delete().eq('sync_code', cleanCode),
      supabase.from('quick_presets').delete().eq('sync_code', cleanCode),
      supabase.from('portfolio_stocks').delete().eq('sync_code', cleanCode),
      supabase.from('fire_configs').upsert({
        sync_code: cleanCode,
        current_age: 28,
        target_retirement_age: 45,
        current_net_worth: 0,
        cash_savings: 0,
        base_cash_balance: 0,
        monthly_income: 85000,
        monthly_expenses: 35000,
        monthly_tax: 5000,
        monthly_investment: 35000,
        target_annual_expense_post_retirement: 480000,
        expected_investment_return_rate: 7.0,
        expected_inflation_rate: 2.5,
        safe_withdrawal_rate: 4.0,
        currency_symbol: 'NT$',
        theme_color: 'sakura',
        portfolio_stocks_json: JSON.stringify({
          stocks: [],
          _metaConfig: {
            cashSavings: 0,
            baseCashBalance: 0,
          },
        }),
        updated_at: new Date().toISOString(),
      }),
    ]);
    return true;
  } catch (e) {
    return false;
  }
}
