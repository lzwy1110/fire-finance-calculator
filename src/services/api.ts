import { CategoryItem, CloudBackupData, FIREConfig, QuickPreset, Transaction, PortfolioStock } from '../types';
import {
  deleteTransactionDirect,
  fetchSupabaseDataDirect,
  isFrontendSupabaseReady,
  pushSupabaseDataDirect,
  saveFIREConfigDirect,
  saveTransactionDirect,
  testSupabaseDirectConnection,
  clearCloudDataDirect,
} from './supabaseFrontend';

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  supabase: {
    configured: boolean;
    dbStatus: 'connected' | 'disconnected' | 'error';
    message: string;
  };
}

export interface FetchDataResponse {
  success: boolean;
  mode: 'supabase' | 'offline';
  syncCode: string;
  data?: {
    transactions: Transaction[] | null;
    categories: CategoryItem[] | null;
    fireConfig: FIREConfig | null;
    quickPresets: QuickPreset[] | null;
    portfolioStocks?: PortfolioStock[] | null;
  };
  message?: string;
  error?: string;
}

export interface SyncDataResponse {
  success: boolean;
  mode: 'supabase' | 'offline';
  lastSyncedAt?: string;
  message?: string;
  error?: string;
}

const API_BASE_URL = '';

/**
 * 檢查後端 API / 前端直連 Supabase 狀態
 */
export async function checkBackendHealth(): Promise<HealthCheckResponse | null> {
  // 1. 嘗試 Express API
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'ok') {
        return data;
      }
    }
  } catch (err) {
    // API offline
  }

  // 2. 退回測試前端 Supabase 直連
  if (isFrontendSupabaseReady()) {
    const directTest = await testSupabaseDirectConnection();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      supabase: {
        configured: true,
        dbStatus: directTest.success ? 'connected' : 'error',
        message: `[前端直連] ${directTest.message}`,
      },
    };
  }

  return null;
}

/**
 * 從 Supabase (前端直連優先，次為 API 路由) 讀取數據
 */
export async function fetchCloudData(syncCode: string): Promise<FetchDataResponse | null> {
  const cleanCode = (syncCode || 'FIRE-DEFAULT-2026').trim().toUpperCase();

  // 1. 前端 Supabase 直連 (第一優先級)
  if (isFrontendSupabaseReady()) {
    try {
      const directData = await fetchSupabaseDataDirect(cleanCode);
      if (directData) {
        return {
          success: true,
          mode: 'supabase',
          syncCode: cleanCode,
          data: directData,
        };
      }
    } catch (e) {
      console.warn('[Supabase Direct Fetch Error]:', e);
    }
  }

  // 2. 嘗試後端 API 路由 (若無 Supabase 憑證或連線伺服器)
  try {
    const res = await fetch(`${API_BASE_URL}/api/data?syncCode=${encodeURIComponent(cleanCode)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) return data;
    }
  } catch (err) {
    // API offline or 404
  }

  return null;
}

/**
 * 推送數據至 Supabase (前端直連優先，次為 API 路由)
 */
export async function pushCloudData(payload: {
  syncCode: string;
  transactions?: Transaction[];
  categories?: CategoryItem[];
  fireConfig?: FIREConfig;
  quickPresets?: QuickPreset[];
  portfolioStocks?: PortfolioStock[];
}): Promise<SyncDataResponse | null> {
  const cleanCode = (payload.syncCode || 'FIRE-DEFAULT-2026').trim().toUpperCase();
  const cleanPayload = { ...payload, syncCode: cleanCode };

  // 1. 前端 Supabase 直連 (第一優先級)
  if (isFrontendSupabaseReady()) {
    try {
      const success = await pushSupabaseDataDirect(cleanPayload);
      if (success) {
        return {
          success: true,
          mode: 'supabase',
          lastSyncedAt: new Date().toISOString(),
          message: '全量數據已成功透過前端直連同步至 Supabase！',
        };
      }
    } catch (e) {
      console.warn('[Supabase Direct Push Error]:', e);
    }
  }

  // 2. 嘗試後端 API 路由
  try {
    const res = await fetch(`${API_BASE_URL}/api/data/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanPayload),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) return data;
    }
  } catch (err) {
    // API failed
  }

  return null;
}

/**
 * 新增/更新單筆交易至 Supabase
 */
export async function saveTransactionToCloud(syncCode: string, transaction: Transaction): Promise<boolean> {
  if (isFrontendSupabaseReady()) {
    const directRes = await saveTransactionDirect(transaction, syncCode);
    if (directRes) return true;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncCode, transaction }),
    });
    if (res.ok) return true;
  } catch (err) {}

  return false;
}

/**
 * 從 Supabase 刪除交易記錄
 */
export async function deleteTransactionFromCloud(syncCode: string, id: string): Promise<boolean> {
  if (isFrontendSupabaseReady()) {
    const directRes = await deleteTransactionDirect(id, syncCode);
    if (directRes) return true;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/transactions/${id}?syncCode=${encodeURIComponent(syncCode)}`, {
      method: 'DELETE',
    });
    if (res.ok) return true;
  } catch (err) {}

  return false;
}

/**
 * 更新 FIRE 設定至 Supabase
 */
export async function saveFIREConfigToCloud(syncCode: string, config: FIREConfig): Promise<boolean> {
  if (isFrontendSupabaseReady()) {
    const directRes = await saveFIREConfigDirect(config, syncCode);
    if (directRes) return true;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncCode, config }),
    });
    if (res.ok) return true;
  } catch (err) {}

  return false;
}

/**
 * 清空雲端此同步碼的所有數據
 */
export async function clearCloudData(syncCode: string): Promise<boolean> {
  const cleanCode = syncCode.trim().toUpperCase();

  // 1. API route
  try {
    const res = await fetch(`${API_BASE_URL}/api/data?syncCode=${encodeURIComponent(cleanCode)}`, {
      method: 'DELETE',
    });
    if (res.ok) return true;
  } catch (err) {}

  // 2. Direct Supabase
  if (isFrontendSupabaseReady()) {
    return await clearCloudDataDirect(cleanCode);
  }

  // 3. KVDB relay wipe
  try {
    const relayUrl = `https://kvdb.io/9L8xY7Z2w3V4u5T6s1R0/${encodeURIComponent(cleanCode)}`;
    await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactions: [],
        categories: [],
        fireConfig: {
          currentAge: 28,
          targetRetirementAge: 45,
          currentNetWorth: 0,
          cashSavings: 0,
          baseCashBalance: 0,
          monthlyIncome: 85000,
          monthlyExpenses: 35000,
          monthlyTax: 5000,
          monthlyInvestment: 35000,
          targetAnnualExpensePostRetirement: 480000,
          expectedInvestmentReturnRate: 7.0,
          expectedInflationRate: 2.5,
          safeWithdrawalRate: 4.0,
          currencySymbol: 'NT$',
          themeColor: 'sakura',
        },
        quickPresets: [],
        portfolioStocks: [],
      }),
    });
    return true;
  } catch (e) {}

  return false;
}
