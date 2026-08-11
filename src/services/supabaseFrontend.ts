import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CategoryItem, FIREConfig, QuickPreset, Transaction, PortfolioStock } from '../types';

const STORAGE_KEY_CUSTOM_URL = 'fire_planner_custom_supabase_url';
const STORAGE_KEY_CUSTOM_KEY = 'fire_planner_custom_supabase_key';

let customSupabaseClient: SupabaseClient | null = null;
let currentClientKey = '';

export function getCustomCredentials(): { url: string; key: string } {
  const url = (localStorage.getItem(STORAGE_KEY_CUSTOM_URL) || '').trim();
  const key = (localStorage.getItem(STORAGE_KEY_CUSTOM_KEY) || '').trim();
  return { url, key };
}

export function saveCustomCredentials(url: string, key: string): void {
  const cleanUrl = url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '').replace(/\/+$/, '');
  const cleanKey = key.trim();

  if (cleanUrl) localStorage.setItem(STORAGE_KEY_CUSTOM_URL, cleanUrl);
  else localStorage.removeItem(STORAGE_KEY_CUSTOM_URL);

  if (cleanKey) localStorage.setItem(STORAGE_KEY_CUSTOM_KEY, cleanKey);
  else localStorage.removeItem(STORAGE_KEY_CUSTOM_KEY);

  customSupabaseClient = null;
  currentClientKey = '';
}

/**
 * 取得前端直連之 Supabase Client
 */
export function getFrontendSupabaseClient(): SupabaseClient | null {
  // 1. 優先使用使用者手動輸入於 LocalStorage 的憑證
  const custom = getCustomCredentials();
  let url = custom.url;
  let key = custom.key;

  // 2. 其次使用 Vite 打包環境變數 (Vercel Project Settings)
  if (!url || !key) {
    url = ((import.meta.env.VITE_SUPABASE_URL as string) || '').trim();
    key = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '').trim();
  }

  // 清除 URL 末尾多餘的斜線與 /rest/v1 等多餘路徑 (常見的輸入錯誤)
  url = url.replace(/\/+$/, '').replace(/\/rest\/v1$/i, '').replace(/\/+$/, '');

  if (!url || !key || url.includes('your-project') || key.includes('your-anon-key')) {
    return null;
  }

  const clientKey = `${url}___${key}`;
  if (customSupabaseClient && currentClientKey === clientKey) {
    return customSupabaseClient;
  }

  try {
    customSupabaseClient = createClient(url, key);
    currentClientKey = clientKey;
    return customSupabaseClient;
  } catch (err) {
    console.error('[Frontend Supabase Client Init Error]:', err);
    return null;
  }
}

export function isFrontendSupabaseReady(): boolean {
  return getFrontendSupabaseClient() !== null;
}

/**
 * 測試直連 Supabase 資料庫狀態
 */
export async function testSupabaseDirectConnection(): Promise<{ success: boolean; message: string }> {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      message: '尚未設定有效的 Supabase URL 與 Anon Key。請在下方輸入憑證或於 Vercel 環境變數中設定 VITE_SUPABASE_URL。',
    };
  }

  try {
    const { error } = await supabase.from('fire_configs').select('sync_code').limit(1);
    if (error) {
      if (error.code === '42P01') {
        return {
          success: false,
          message: `已連接 Supabase，但尚未在資料庫建表！請前往 Supabase 控制台的 SQL Editor 執行專案中的 supabase/schema.sql。`,
        };
      }
      return { success: false, message: `Supabase 查詢測試回應 [${error.code || 'ERR'}]: ${error.message}` };
    }
    return { success: true, message: '🎉 成功直連 Supabase 資料庫！' };
  } catch (err: any) {
    return { success: false, message: `連線失敗: ${err.message || err}` };
  }
}

/**
 * 從 Supabase 讀取數據 (前端直連)
 */
export async function fetchSupabaseDataDirect(syncCode: string) {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return null;

  try {
    const [txRes, catRes, configRes, presetRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('sync_code', syncCode).order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('sync_code', syncCode),
      supabase.from('fire_configs').select('*').eq('sync_code', syncCode).maybeSingle(),
      supabase.from('quick_presets').select('*').eq('sync_code', syncCode),
    ]);

    let portRes: any = { data: null, error: true };
    try {
      portRes = await supabase.from('portfolio_stocks').select('*').eq('sync_code', syncCode);
    } catch (e) {}

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

    const quickPresets: QuickPreset[] = (presetRes.data || []).map((p: any) => ({
      id: p.id,
      label: p.label,
      mainCategory: p.main_category,
      subCategory: p.sub_category,
      amount: Number(p.amount),
      icon: p.icon,
    }));

    const portfolioStocks: PortfolioStock[] = ((portRes as any)?.data || []).map((s: any) => ({
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

    return {
      transactions: txRes.error ? null : transactions,
      categories: catRes.error ? null : (categories.length > 0 ? categories : null),
      fireConfig,
      quickPresets: presetRes.error ? null : (quickPresets.length > 0 ? quickPresets : null),
      portfolioStocks: (portRes as any)?.error ? null : portfolioStocks,
    };
  } catch (err) {
    console.error('[Supabase Direct Fetch Error]:', err);
    return null;
  }
}

/**
 * 推送全量備份至 Supabase (前端直連)
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
      await supabase.from('categories').upsert(catRows);
    }

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
        await supabase.from('transactions').upsert(txRows);
      } else {
        // If user cleared all transactions, delete from Supabase
        await supabase.from('transactions').delete().eq('sync_code', targetSyncCode);
      }
    }

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
      await supabase.from('quick_presets').upsert(presetRows);
    }

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

    return true;
  } catch (err) {
    console.error('[Supabase Direct Push Error]:', err);
    return false;
  }
}

/**
 * 新增/更新單筆交易至 Supabase (前端直連)
 */
export async function saveTransactionDirect(syncCode: string, transaction: Transaction) {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('transactions').upsert({
      id: transaction.id,
      sync_code: syncCode,
      type: transaction.type,
      amount: transaction.amount,
      main_category: transaction.mainCategory,
      sub_category: transaction.subCategory || '',
      date: transaction.date,
      note: transaction.note || '',
      tags: transaction.tags || [],
      is_quick_preset: Boolean(transaction.isQuickPreset),
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch (err) {
    return false;
  }
}

/**
 * 刪除單筆交易 (前端直連)
 */
export async function deleteTransactionDirect(syncCode: string, id: string) {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('sync_code', syncCode);
    return !error;
  } catch (err) {
    return false;
  }
}

/**
 * 更新 FIRE 設定 (前端直連)
 */
export async function saveFIREConfigDirect(syncCode: string, config: FIREConfig) {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('fire_configs').upsert({
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
      theme_color: config.themeColor || 'cyan',
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch (err) {
    return false;
  }
}
