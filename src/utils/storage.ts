import { CategoryItem, CloudBackupData, FIREConfig, QuickPreset, Transaction, PortfolioStock } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_FIRE_CONFIG, DEFAULT_QUICK_PRESETS, INITIAL_TRANSACTIONS, DEFAULT_PORTFOLIO_STOCKS } from '../data/initialData';
import { fetchCloudData, pushCloudData, saveFIREConfigToCloud, saveTransactionToCloud, deleteTransactionFromCloud, clearCloudData } from '../services/api';
import { broadcastDataSyncEvent } from '../services/realtimeSync';

const STORAGE_KEY_TRANSACTIONS = 'fire_planner_transactions_v1';
const STORAGE_KEY_CATEGORIES = 'fire_planner_categories_v1';
const STORAGE_KEY_CONFIG = 'fire_planner_config_v1';
const STORAGE_KEY_PRESETS = 'fire_planner_presets_v1';
const STORAGE_KEY_PORTFOLIO = 'fire_planner_portfolio_v1';
const STORAGE_KEY_SYNC_CODE = 'fire_planner_sync_code_v1';
const STORAGE_KEY_CLOUD_SIMULATION = 'fire_planner_cloud_db_v1';

export function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    if (raw === null) return INITIAL_TRANSACTIONS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_TRANSACTIONS;
  } catch (e) {
    console.error('Failed to load transactions:', e);
    return INITIAL_TRANSACTIONS;
  }
}

export function saveTransactionsLocalOnly(data: Transaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save transactions local:', e);
  }
}

export function saveTransactions(data: Transaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(data));
    autoSyncToCloud();
  } catch (e) {
    console.error('Failed to save transactions:', e);
  }
}

export function syncSingleTransactionToCloud(transaction: Transaction): void {
  const code = getOrCreateSyncCode();
  saveTransactionToCloud(code, transaction).catch((e) => console.warn('Cloud sync error:', e));
}

export function removeSingleTransactionFromCloud(id: string): void {
  const code = getOrCreateSyncCode();
  deleteTransactionFromCloud(code, id).catch((e) => console.warn('Cloud delete error:', e));
}

export function loadCategories(): CategoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    if (raw === null) return DEFAULT_CATEGORIES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_CATEGORIES;
  } catch (e) {
    return DEFAULT_CATEGORIES;
  }
}

export function saveCategoriesLocalOnly(data: CategoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save categories local:', e);
  }
}

export function saveCategories(data: CategoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(data));
    autoSyncToCloud();
  } catch (e) {
    console.error('Failed to save categories:', e);
  }
}

export function loadFIREConfig(): FIREConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return DEFAULT_FIRE_CONFIG;
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_FIRE_CONFIG, ...parsed };
    if (merged.baseCashBalance === undefined) {
      merged.baseCashBalance = merged.cashSavings ?? (merged.currentNetWorth ? Math.max(0, merged.currentNetWorth) : 0);
    }
    if (merged.cashSavings === undefined) {
      merged.cashSavings = merged.baseCashBalance;
    }
    return merged;
  } catch (e) {
    return DEFAULT_FIRE_CONFIG;
  }
}

export function saveFIREConfigLocalOnly(config: FIREConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save FIRE config local:', e);
  }
}

export function saveFIREConfig(config: FIREConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    const code = getOrCreateSyncCode();
    saveFIREConfigToCloud(code, config).catch((e) => console.warn('Cloud config save error:', e));
    autoSyncToCloud();
  } catch (e) {
    console.error('Failed to save FIRE config:', e);
  }
}

export function loadQuickPresets(): QuickPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRESETS);
    if (raw === null) return DEFAULT_QUICK_PRESETS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_QUICK_PRESETS;
  } catch (e) {
    return DEFAULT_QUICK_PRESETS;
  }
}

export function saveQuickPresetsLocalOnly(presets: QuickPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
  } catch (e) {
    console.error('Failed to save presets local:', e);
  }
}

export function saveQuickPresets(presets: QuickPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
    autoSyncToCloud();
  } catch (e) {
    console.error('Failed to save presets:', e);
  }
}

export function getOrCreateSyncCode(): string {
  let code = localStorage.getItem(STORAGE_KEY_SYNC_CODE);
  if (!code) {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    code = `FIRE-${randomHex}-2026`;
    localStorage.setItem(STORAGE_KEY_SYNC_CODE, code);
  }
  return code;
}

export function setSyncCode(code: string): void {
  localStorage.setItem(STORAGE_KEY_SYNC_CODE, code.trim().toUpperCase());
}

/**
 * 自動同步至 Supabase 與本地模擬雲端資料庫
 */
export function autoSyncToCloud(): void {
  try {
    const code = getOrCreateSyncCode();
    const backupPayload = {
      syncCode: code,
      transactions: loadTransactions(),
      categories: loadCategories(),
      fireConfig: loadFIREConfig(),
      quickPresets: loadQuickPresets(),
      portfolioStocks: loadPortfolioStocks(),
    };

    // 1. 後端與 Supabase 同步 API (完成後向其他裝置發送廣播)
    pushCloudData(backupPayload)
      .then(() => {
        broadcastDataSyncEvent(code);
      })
      .catch((e) => console.warn('[Supabase Sync Warning]:', e));

    // 3. 本地模擬跨 Tab 緩存
    const backup: CloudBackupData = {
      version: '1.0',
      lastSyncedAt: new Date().toISOString(),
      syncCode: code,
      ...backupPayload,
    };
    const cloudDb = JSON.parse(localStorage.getItem(STORAGE_KEY_CLOUD_SIMULATION) || '{}');
    cloudDb[code] = backup;
    localStorage.setItem(STORAGE_KEY_CLOUD_SIMULATION, JSON.stringify(cloudDb));
  } catch (e) {
    console.error('Cloud auto-sync error:', e);
  }
}

/**
 * 依同步碼連線同步 Supabase / 後端資料庫，若離線則使用 LocalStorage 同步
 */
export async function syncWithCloudCodeAsync(inputCode: string): Promise<CloudBackupData | null> {
  const cleanCode = inputCode.trim().toUpperCase();
  if (!cleanCode) return null;

  try {
    const apiRes = await fetchCloudData(cleanCode);
    if (apiRes && apiRes.success && apiRes.data) {
      const { transactions, categories, fireConfig, quickPresets, portfolioStocks } = apiRes.data;

      setSyncCode(cleanCode);

      if (Array.isArray(transactions)) saveTransactions(transactions);
      if (Array.isArray(categories)) saveCategories(categories);
      if (fireConfig) {
        saveFIREConfig(fireConfig);
      } else {
        const zeroConfig: FIREConfig = {
          ...DEFAULT_FIRE_CONFIG,
          currentNetWorth: 0,
          baseCashBalance: 0,
          cashSavings: 0,
        };
        saveFIREConfig(zeroConfig);
      }
      if (Array.isArray(quickPresets)) saveQuickPresets(quickPresets);
      if (Array.isArray(portfolioStocks)) savePortfolioStocks(portfolioStocks);

      return {
        version: '1.0 (Supabase)',
        lastSyncedAt: new Date().toISOString(),
        syncCode: cleanCode,
        transactions: transactions || loadTransactions(),
        categories: categories || loadCategories(),
        fireConfig: fireConfig || loadFIREConfig(),
        quickPresets: quickPresets || loadQuickPresets(),
        portfolioStocks: portfolioStocks || loadPortfolioStocks(),
      };
    }
  } catch (e) {
    console.warn('[Sync API Error, trying local storage fallback]:', e);
  }

  return syncWithCloudCodeLocal(cleanCode);
}

export function syncWithCloudCodeLocal(inputCode: string): CloudBackupData | null {
  try {
    const cleanCode = inputCode.trim().toUpperCase();
    const cloudDb = JSON.parse(localStorage.getItem(STORAGE_KEY_CLOUD_SIMULATION) || '{}');
    const matched = cloudDb[cleanCode];
    if (matched) {
      saveTransactions(matched.transactions);
      saveCategories(matched.categories);
      saveFIREConfig(matched.fireConfig);
      if (matched.quickPresets) saveQuickPresets(matched.quickPresets);
      setSyncCode(matched.syncCode);
      return matched;
    }
    return null;
  } catch (e) {
    console.error('Sync code fetch error:', e);
    return null;
  }
}

export function createFullBackupJSON(): string {
  const backup: CloudBackupData = {
    version: '1.0',
    lastSyncedAt: new Date().toISOString(),
    syncCode: getOrCreateSyncCode(),
    transactions: loadTransactions(),
    categories: loadCategories(),
    fireConfig: loadFIREConfig(),
    quickPresets: loadQuickPresets(),
    portfolioStocks: loadPortfolioStocks(),
  };
  return JSON.stringify(backup, null, 2);
}

export function restoreFromBackupJSON(jsonString: string): boolean {
  try {
    const parsed: CloudBackupData = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.transactions)) return false;

    saveTransactions(parsed.transactions);
    if (Array.isArray(parsed.categories)) saveCategories(parsed.categories);
    if (parsed.fireConfig) saveFIREConfig(parsed.fireConfig);
    if (Array.isArray(parsed.quickPresets)) saveQuickPresets(parsed.quickPresets);
    if (Array.isArray(parsed.portfolioStocks)) savePortfolioStocks(parsed.portfolioStocks);
    if (parsed.syncCode) setSyncCode(parsed.syncCode);
    return true;
  } catch (e) {
    console.error('Failed to restore backup JSON:', e);
    return false;
  }
}

export function resetAllDataToDefault(): void {
  localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEY_PORTFOLIO, JSON.stringify([]));

  const zeroConfig: FIREConfig = {
    ...DEFAULT_FIRE_CONFIG,
    currentNetWorth: 0,
    baseCashBalance: 0,
    cashSavings: 0,
  };
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(zeroConfig));
  localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
  localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(DEFAULT_QUICK_PRESETS));
}

export async function clearLocalAndCloudData(targetCode?: string): Promise<boolean> {
  const code = (targetCode || getOrCreateSyncCode()).trim().toUpperCase();
  resetAllDataToDefault();

  const success = await clearCloudData(code);
  broadcastDataSyncEvent(code);
  return success;
}

export function loadPortfolioStocks(): PortfolioStock[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PORTFOLIO);
    if (raw === null) return DEFAULT_PORTFOLIO_STOCKS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_PORTFOLIO_STOCKS;
  } catch (e) {
    return DEFAULT_PORTFOLIO_STOCKS;
  }
}

export function savePortfolioStocksLocalOnly(data: PortfolioStock[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PORTFOLIO, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save portfolio stocks local:', e);
  }
}

export function savePortfolioStocks(data: PortfolioStock[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PORTFOLIO, JSON.stringify(data));
    autoSyncToCloud();
  } catch (e) {
    console.error('Failed to save portfolio stocks:', e);
  }
}
