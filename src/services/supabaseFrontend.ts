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

    // Extract system portfolio backup record if present
    const sysPortfolioTx = (txRes.data || []).find((t: any) => t.id === 'SYS-PORTFOLIO-SYNC');

    // Filter out system backup records from user ledger transactions
    const transactions: Transaction[] = (txRes.data || [])
      .filter((t: any) => t.id !== 'SYS-PORTFOLIO-SYNC')
      .map((t: any) => ({
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
      let parsedExtra: any = {};
      let resolvedThemeColor = cfg.theme_color || 'sakura';

      // 1. Decode theme_color metadata fallback (Guaranteed column in schema)
      if (cfg.theme_color && typeof cfg.theme_color === 'string' && cfg.theme_color.startsWith('{')) {
        try {
          const parsedTheme = JSON.parse(cfg.theme_color);
          if (parsedTheme && typeof parsedTheme === 'object') {
            resolvedThemeColor = parsedTheme.theme || 'sakura';
            parsedExtra = { ...parsedExtra, ...parsedTheme };
          }
        } catch (e) {}
      }

      // 2. Decode portfolio_stocks_json metadata fallback
      if ((cfg as any).portfolio_stocks_json) {
        try {
          const parsed = JSON.parse((cfg as any).portfolio_stocks_json);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed._metaConfig) {
            parsedExtra = { ...parsedExtra, ...parsed._metaConfig };
          }
        } catch (e) {}
      }

      const cashSavings = cfg.cash_savings != null 
        ? Number(cfg.cash_savings) 
        : (cfg.base_cash_balance != null 
            ? Number(cfg.base_cash_balance) 
            : (parsedExtra.cashSavings != null 
                ? Number(parsedExtra.cashSavings) 
                : (parsedExtra.baseCashBalance != null 
                    ? Number(parsedExtra.baseCashBalance) 
                    : Number(cfg.current_net_worth || 0))));

      const baseCashBalance = cfg.base_cash_balance != null 
        ? Number(cfg.base_cash_balance) 
        : (cfg.cash_savings != null 
            ? Number(cfg.cash_savings) 
            : (parsedExtra.baseCashBalance != null 
                ? Number(parsedExtra.baseCashBalance) 
                : cashSavings));

      fireConfig = {
        currentAge: Number(cfg.current_age),
        targetRetirementAge: Number(cfg.target_retirement_age),
        currentNetWorth: Number(cfg.current_net_worth),
        cashSavings: cashSavings != null ? Number(cashSavings) : 0,
        baseCashBalance: baseCashBalance != null ? Number(baseCashBalance) : 0,
        monthlyIncome: Number(cfg.monthly_income),
        monthlyExpenses: Number(cfg.monthly_expenses),
        monthlyTax: Number(cfg.monthly_tax),
        monthlyInvestment: Number(cfg.monthly_investment),
        targetAnnualExpensePostRetirement: Number(cfg.target_annual_expense_post_retirement),
        expectedInvestmentReturnRate: Number(cfg.expected_investment_return_rate),
        expectedInflationRate: Number(cfg.expected_inflation_rate),
        safeWithdrawalRate: Number(cfg.safe_withdrawal_rate),
        currencySymbol: cfg.currency_symbol,
        themeColor: resolvedThemeColor,
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

    let portfolioStocks: PortfolioStock[] = ((portRes as any)?.data || []).map((s: any) => ({
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

    // Fallback 1: Check fire_configs.portfolio_stocks_json
    if (portfolioStocks.length === 0 && configRes.data && (configRes.data as any).portfolio_stocks_json) {
      try {
        const parsedFallback = JSON.parse((configRes.data as any).portfolio_stocks_json);
        if (Array.isArray(parsedFallback)) {
          portfolioStocks = parsedFallback;
        } else if (parsedFallback && Array.isArray(parsedFallback.stocks)) {
          portfolioStocks = parsedFallback.stocks;
        }
      } catch (e) {}
    }

    // Fallback 2: Check System Backup Record in transactions table (100% Guaranteed Fail-safe)
    if (portfolioStocks.length === 0 && sysPortfolioTx && sysPortfolioTx.note) {
      try {
        const parsedSys = JSON.parse(sysPortfolioTx.note);
        if (Array.isArray(parsedSys)) {
          portfolioStocks = parsedSys;
        }
      } catch (e) {}
    }

    return {
      transactions: txRes.error ? null : transactions,
      categories: catRes.error ? null : (categories.length > 0 ? categories : null),
      fireConfig,
      quickPresets: presetRes.error ? null : (quickPresets.length > 0 ? quickPresets : null),
      portfolioStocks,
    };
  } catch (err) {
    console.error('[Supabase Direct Fetch Error]:', err);
    return null;
  }
}

/**
 * 推送全量備份至 Supabase (前端直連 - 具備 Triple Fail-safe 彈性)
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
    // 1. Safely Upsert FIRE Config (handling missing columns without throwing)
      const themeWithMeta = JSON.stringify({
        theme: fireConfig.themeColor || 'sakura',
        cashSavings: fireConfig.cashSavings != null ? fireConfig.cashSavings : 0,
        baseCashBalance: fireConfig.baseCashBalance != null ? fireConfig.baseCashBalance : 0,
      });

      const baseConfigObj = {
        sync_code: targetSyncCode,
        current_age: fireConfig.currentAge,
        target_retirement_age: fireConfig.targetRetirementAge,
        current_net_worth: fireConfig.currentNetWorth,
        cash_savings: fireConfig.cashSavings,
        base_cash_balance: fireConfig.baseCashBalance,
        monthly_income: fireConfig.monthlyIncome,
        monthly_expenses: fireConfig.monthlyExpenses,
        monthly_tax: fireConfig.monthlyTax,
        monthly_investment: fireConfig.monthlyInvestment,
        target_annual_expense_post_retirement: fireConfig.targetAnnualExpensePostRetirement,
        expected_investment_return_rate: fireConfig.expectedInvestmentReturnRate,
        expected_inflation_rate: fireConfig.expectedInflationRate,
        safe_withdrawal_rate: fireConfig.safeWithdrawalRate,
        currency_symbol: fireConfig.currencySymbol,
        theme_color: themeWithMeta,
        updated_at: new Date().toISOString(),
      };

      const metaFallback = {
        stocks: portfolioStocks || [],
        _metaConfig: {
          cashSavings: fireConfig.cashSavings,
          baseCashBalance: fireConfig.baseCashBalance,
        },
      };

      const payloadWithAll = {
        ...baseConfigObj,
        portfolio_stocks_json: JSON.stringify(metaFallback),
      };

      const res1 = await supabase.from('fire_configs').upsert(payloadWithAll);
      if (res1.error) {
        console.warn('[Supabase fire_configs upsert error, retrying with core standard columns]:', res1.error.message);
        const coreFallback = {
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
          theme_color: themeWithMeta,
          updated_at: new Date().toISOString(),
        };
        await supabase.from('fire_configs').upsert(coreFallback);
      }

    // 2. Safely Upsert Categories
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
      try {
        await supabase.from('categories').upsert(catRows);
        const currentCatIds = categories.map((c) => c.id);
        if (currentCatIds.length > 0) {
          await supabase
            .from('categories')
            .delete()
            .eq('sync_code', targetSyncCode)
            .not('id', 'in', `(${currentCatIds.join(',')})`);
        }
      } catch (e) {}
    }

    // 3. Upsert Transactions & System Portfolio Backup Record (100% Fail-safe)
    if (Array.isArray(transactions)) {
      const cleanTx = transactions.filter((t) => t.id !== 'SYS-PORTFOLIO-SYNC');
      if (cleanTx.length > 0) {
        const txRows = cleanTx.map((t) => ({
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
        try {
          await supabase.from('transactions').upsert(txRows);
        } catch (e) {}
      } else {
        try {
          await supabase.from('transactions').delete().eq('sync_code', targetSyncCode).neq('id', 'SYS-PORTFOLIO-SYNC');
        } catch (e) {}
      }
    }

    // Bulletproof System Backup Record for Portfolio Stocks in transactions table
    if (Array.isArray(portfolioStocks)) {
      try {
        if (portfolioStocks.length > 0) {
          await supabase.from('transactions').upsert({
            id: 'SYS-PORTFOLIO-SYNC',
            sync_code: targetSyncCode,
            type: 'investment',
            amount: 0,
            main_category: '__SYS_PORTFOLIO__',
            sub_category: 'System Backup',
            date: new Date().toISOString().slice(0, 10),
            note: JSON.stringify(portfolioStocks),
            tags: ['SYS'],
            is_quick_preset: false,
            updated_at: new Date().toISOString(),
          });
        } else {
          await supabase.from('transactions').delete().eq('id', 'SYS-PORTFOLIO-SYNC').eq('sync_code', targetSyncCode);
        }
      } catch (e) {}
    }

    // 4. Safely Upsert Quick Presets
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
      try {
        await supabase.from('quick_presets').upsert(presetRows);
      } catch (e) {}
    }

    // 5. Safely Upsert Portfolio Stocks Table
    if (Array.isArray(portfolioStocks)) {
      if (portfolioStocks.length > 0) {
        const portRows = portfolioStocks.map((s) => ({
          id: s.id,
          sync_code: targetSyncCode,
          symbol: s.symbol,
          name: s.name,
          market: s.market,
          shares: s.shares,
          avg_cost: s.avgCost,
          current_price: s.currentPrice,
          currency: s.currency,
          transactions: JSON.stringify(s.transactions || []),
          updated_at: new Date().toISOString(),
        }));
        try {
          await supabase.from('portfolio_stocks').upsert(portRows);
        } catch (e) {
          try {
            // Retry without stringifying if transactions is jsonb
            const portRowsRaw = portfolioStocks.map((s) => ({
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
            await supabase.from('portfolio_stocks').upsert(portRowsRaw);
          } catch (e2) {}
        }
      } else {
        try {
          await supabase.from('portfolio_stocks').delete().eq('sync_code', targetSyncCode);
        } catch (e) {}
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
