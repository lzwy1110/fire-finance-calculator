import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CategoryItem, FIREConfig, QuickPreset, Transaction } from '../types';
import { PortfolioStock } from '../types/portfolio';

let supabaseClient: SupabaseClient | null = null;

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
 * 從 Supabase 讀取全量數據 (前端直連 - 5 張標準關聯表)
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
      id: String(t.id),
      type: t.type,
      amount: Number(t.amount) || 0,
      mainCategory: t.main_category,
      subCategory: t.sub_category || '',
      date: t.date,
      note: t.note || '',
      tags: t.tags || [],
      isQuickPreset: Boolean(t.is_quick_preset),
    }));

    const categories: CategoryItem[] = (catRes.data || []).map((c: any) => ({
      id: String(c.id),
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
        currentAge: Number(cfg.current_age) || 30,
        targetRetirementAge: Number(cfg.target_retirement_age) || 50,
        currentNetWorth: Number(cfg.current_net_worth) || 0,
        cashSavings: cashSavingsTWD,
        cashSavingsTWD: cashSavingsTWD,
        cashSavingsUSD: cashSavingsUSD,
        usdRate: usdRate > 0 ? usdRate : 32.0,
        baseCashBalance: baseCashBalance,
        monthlyIncome: Number(cfg.monthly_income) || 0,
        monthlyExpenses: Number(cfg.monthly_expenses) || 0,
        monthlyTax: Number(cfg.monthly_tax) || 0,
        monthlyInvestment: Number(cfg.monthly_investment) || 0,
        targetAnnualExpensePostRetirement: Number(cfg.target_annual_expense_post_retirement) || 0,
        expectedInvestmentReturnRate: Number(cfg.expected_investment_return_rate) || 7.0,
        expectedInflationRate: Number(cfg.expected_inflation_rate) || 2.5,
        safeWithdrawalRate: Number(cfg.safe_withdrawal_rate) || 4.0,
        currencySymbol: cfg.currency_symbol || 'NT$',
        themeColor: cfg.theme_color || 'cyan',
      };
    }

    const quickPresets: QuickPreset[] = (presetRes.data || []).map((p: any) => ({
      id: String(p.id),
      label: p.label,
      mainCategory: p.main_category,
      subCategory: p.sub_category,
      amount: Number(p.amount) || 0,
      icon: p.icon || 'Zap',
    }));

    const portfolioStocks: PortfolioStock[] = (portRes.data || []).map((s: any) => {
      const shares = Number(s.shares) || 0;
      const avgCost = Number(s.avg_cost) || 0;
      const currentPrice = Number(s.current_price) || 0;
      let txs = Array.isArray(s.transactions)
        ? s.transactions
        : typeof s.transactions === 'string'
        ? (() => {
            try {
              return JSON.parse(s.transactions);
            } catch (e) {
              return [];
            }
          })()
        : [];

      if (!txs || txs.length === 0) {
        if (shares > 0) {
          txs = [
            {
              id: `tx-init-${s.id}`,
              stockId: s.id,
              type: 'BUY',
              shares: shares,
              price: avgCost,
              date: new Date().toISOString().split('T')[0],
              note: '初始持股建倉紀錄',
            },
          ];
        } else {
          txs = [];
        }
      }

      return {
        id: String(s.id),
        symbol: String(s.symbol || '').toUpperCase(),
        name: String(s.name || s.symbol || ''),
        market: s.market === 'TW' ? 'TW' : 'US',
        shares,
        avgCost,
        currentPrice,
        currency: s.currency || (s.market === 'TW' ? 'TWD' : 'USD'),
        transactions: txs,
      };
    });

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
 * 推送全量備份至 Supabase (前端直連 - 5 張標準關聯表)
 */
export async function pushSupabaseDataDirect(payload: {
  syncCode: string;
  transactions?: Transaction[];
  categories?: CategoryItem[];
  fireConfig?: FIREConfig;
  quickPresets?: QuickPreset[];
  portfolioStocks?: PortfolioStock[];
}): Promise<{ success: boolean; error?: string }> {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase 未連線' };

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

      const res = await supabase.from('fire_configs').upsert(configRow, { onConflict: 'sync_code' });
      if (res.error) {
        console.error('[Supabase fire_configs Upsert Error]:', res.error);
        return { success: false, error: `FIRE Config 寫入失敗: ${res.error.message}` };
      }
    }

    // 2. 寫入 Categories
    if (Array.isArray(categories)) {
      if (categories.length > 0) {
        const catRows = categories.map((c) => ({
          id: String(c.id),
          sync_code: targetSyncCode,
          name: c.name,
          type: c.type,
          icon: c.icon,
          color: c.color,
          sub_categories: c.subCategories || [],
          updated_at: new Date().toISOString(),
        }));
        const currentCatIds = categories.map((c) => String(c.id));
        const res = await supabase.from('categories').upsert(catRows, { onConflict: 'id' });
        if (res.error) {
          console.error('[Supabase categories Upsert Error]:', res.error);
          return { success: false, error: `分類設定寫入失敗: ${res.error.message}` };
        }

        // 精準清理已在前端被刪除的分類
        try {
          const { data: existingCats } = await supabase
            .from('categories')
            .select('id')
            .eq('sync_code', targetSyncCode);
          if (Array.isArray(existingCats)) {
            const currentCatIdSet = new Set(currentCatIds);
            const toDeleteCats = existingCats.filter((r) => !currentCatIdSet.has(r.id)).map((r) => r.id);
            if (toDeleteCats.length > 0) {
              await supabase.from('categories').delete().in('id', toDeleteCats);
            }
          }
        } catch (delErr) {}
      } else {
        await supabase.from('categories').delete().eq('sync_code', targetSyncCode);
      }
    }

    // 3. 寫入 Transactions
    if (Array.isArray(transactions)) {
      if (transactions.length > 0) {
        const txRows = transactions.map((t) => ({
          id: String(t.id),
          sync_code: targetSyncCode,
          type: t.type,
          amount: Number(t.amount) || 0,
          main_category: t.mainCategory,
          sub_category: t.subCategory || '',
          date: t.date,
          note: t.note || '',
          tags: t.tags || [],
          is_quick_preset: Boolean(t.isQuickPreset),
          updated_at: new Date().toISOString(),
        }));
        const currentTxIds = transactions.map((t) => String(t.id));
        const res = await supabase.from('transactions').upsert(txRows, { onConflict: 'id' });
        if (res.error) {
          console.error('[Supabase transactions Upsert Error]:', res.error);
          return { success: false, error: `記帳明細寫入失敗: ${res.error.message}` };
        }

        // 精準清理已在前端被刪除的交易紀錄
        try {
          const { data: existingTxs } = await supabase
            .from('transactions')
            .select('id')
            .eq('sync_code', targetSyncCode);
          if (Array.isArray(existingTxs)) {
            const currentTxIdSet = new Set(currentTxIds);
            const toDeleteTxs = existingTxs.filter((r) => !currentTxIdSet.has(r.id)).map((r) => r.id);
            if (toDeleteTxs.length > 0) {
              await supabase.from('transactions').delete().in('id', toDeleteTxs);
            }
          }
        } catch (delErr) {}
      } else {
        await supabase.from('transactions').delete().eq('sync_code', targetSyncCode);
      }
    }

    // 4. 寫入 Quick Presets
    if (Array.isArray(quickPresets)) {
      if (quickPresets.length > 0) {
        const presetRows = quickPresets.map((p) => ({
          id: String(p.id),
          sync_code: targetSyncCode,
          label: p.label,
          main_category: p.mainCategory,
          sub_category: p.subCategory,
          amount: Number(p.amount) || 0,
          icon: p.icon || 'Zap',
          updated_at: new Date().toISOString(),
        }));
        const currentPresetIds = quickPresets.map((p) => String(p.id));
        const res = await supabase.from('quick_presets').upsert(presetRows, { onConflict: 'id' });
        if (res.error) {
          console.error('[Supabase quick_presets Upsert Error]:', res.error);
          return { success: false, error: `快捷預設寫入失敗: ${res.error.message}` };
        }

        // 精準清理已在前端被刪除的快捷預設
        try {
          const { data: existingPresets } = await supabase
            .from('quick_presets')
            .select('id')
            .eq('sync_code', targetSyncCode);
          if (Array.isArray(existingPresets)) {
            const currentPresetIdSet = new Set(currentPresetIds);
            const toDeletePresets = existingPresets.filter((r) => !currentPresetIdSet.has(r.id)).map((r) => r.id);
            if (toDeletePresets.length > 0) {
              await supabase.from('quick_presets').delete().in('id', toDeletePresets);
            }
          }
        } catch (delErr) {}
      } else {
        await supabase.from('quick_presets').delete().eq('sync_code', targetSyncCode);
      }
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
        const res = await supabase.from('portfolio_stocks').upsert(portRows, { onConflict: 'id' });
        if (res.error) {
          console.error('[Supabase portfolio_stocks Upsert Error]:', res.error);
          return { success: false, error: `股票庫存寫入失敗: ${res.error.message}` };
        }
        
        // 安全精準清理已刪除的股票
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

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Direct Push Error]:', err);
    return { success: false, error: err.message || String(err) };
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

/**
 * 單筆記帳直連寫入
 */
export async function saveTransactionDirect(tx: Transaction, syncCode: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase 未連線' };
  try {
    const res = await supabase.from('transactions').upsert({
      id: String(tx.id),
      sync_code: syncCode,
      type: tx.type,
      amount: Number(tx.amount) || 0,
      main_category: tx.mainCategory,
      sub_category: tx.subCategory || '',
      date: tx.date,
      note: tx.note || '',
      tags: tx.tags || [],
      is_quick_preset: Boolean(tx.isQuickPreset),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (res.error) return { success: false, error: res.error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * 單筆記帳直連刪除
 */
export async function deleteTransactionDirect(id: string, syncCode: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase 未連線' };
  try {
    const res = await supabase.from('transactions').delete().eq('id', id).eq('sync_code', syncCode);
    if (res.error) return { success: false, error: res.error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * 單筆持股直連寫入 (新增或修改)
 */
export async function saveStockDirect(stock: PortfolioStock, syncCode: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase 未連線' };
  try {
    const res = await supabase.from('portfolio_stocks').upsert({
      id: String(stock.id),
      sync_code: syncCode,
      symbol: String(stock.symbol || '').toUpperCase(),
      name: String(stock.name || stock.symbol || ''),
      market: stock.market === 'TW' ? 'TW' : 'US',
      shares: Number(stock.shares) || 0,
      avg_cost: Number(stock.avgCost) || 0,
      current_price: Number(stock.currentPrice) || 0,
      currency: stock.currency === 'TWD' ? 'TWD' : 'USD',
      transactions: Array.isArray(stock.transactions) ? stock.transactions : [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (res.error) return { success: false, error: res.error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * 單筆持股直連刪除
 */
export async function deleteStockDirect(stockId: string, syncCode: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase 未連線' };
  try {
    const res = await supabase.from('portfolio_stocks').delete().eq('id', stockId).eq('sync_code', syncCode);
    if (res.error) return { success: false, error: res.error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * FIRE 設定直連寫入
 */
export async function saveFIREConfigDirect(config: FIREConfig, syncCode: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getFrontendSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase 未連線' };
  try {
    const configRow = {
      sync_code: syncCode,
      current_age: config.currentAge,
      target_retirement_age: config.targetRetirementAge,
      current_net_worth: config.currentNetWorth,
      cash_savings: config.cashSavingsTWD != null ? config.cashSavingsTWD : (config.cashSavings || 0),
      cash_savings_usd: config.cashSavingsUSD != null ? config.cashSavingsUSD : 0,
      usd_rate: config.usdRate != null ? config.usdRate : 32.0,
      base_cash_balance: config.baseCashBalance != null ? config.baseCashBalance : 0,
      monthly_income: config.monthlyIncome,
      monthly_expenses: config.monthlyExpenses,
      monthly_tax: config.monthlyTax,
      monthly_investment: config.monthlyInvestment,
      target_annual_expense_post_retirement: config.targetAnnualExpensePostRetirement,
      expected_investment_return_rate: config.expectedInvestmentReturnRate,
      expected_inflation_rate: config.expectedInflationRate,
      safe_withdrawal_rate: config.safeWithdrawalRate,
      currency_symbol: config.currencySymbol || 'NT$',
      theme_color: config.themeColor || 'cyan',
      updated_at: new Date().toISOString(),
    };

    const res = await supabase.from('fire_configs').upsert(configRow, { onConflict: 'sync_code' });
    if (res.error) return { success: false, error: res.error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * 清空雲端該 Sync Code 的所有資料
 */
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
      supabase.from('fire_configs').delete().eq('sync_code', cleanCode),
    ]);
    return true;
  } catch (e) {
    return false;
  }
}
