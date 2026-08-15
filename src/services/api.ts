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
 * 從 Supabase (API 或前端直連) 讀取數據
 */
export async function fetchCloudData(syncCode: string): Promise<FetchDataResponse | null> {
  // 1. 嘗試 API 路由
  try {
    const res = await fetch(`${API_BASE_URL}/api/data?syncCode=${encodeURIComponent(syncCode)}`, {
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

  // 2. 前端 Supabase 直連
  if (isFrontendSupabaseReady()) {
    const directData = await fetchSupabaseDataDirect(syncCode);
    if (directData) {
      return {
        success: true,
        mode: 'supabase',
        syncCode,
        data: directData,
      };
    }
  }

  // 3. 通用免費全球雲端 Relay Fallback (KVDB Global Storage)
  try {
    const cleanCode = syncCode.trim().toUpperCase();
    const relayUrl = `https://kvdb.io/9L8xY7Z2w3V4u5T6s1R0/${encodeURIComponent(cleanCode)}`;
    const relayRes = await fetch(relayUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (relayRes.ok) {
      const relayJson = await relayRes.json();
      if (relayJson && (Array.isArray(relayJson.transactions) || Array.isArray(relayJson.portfolioStocks))) {
        return {
          success: true,
          mode: 'supabase',
          syncCode: cleanCode,
          data: {
            transactions: relayJson.transactions || [],
            categories: relayJson.categories || [],
            fireConfig: relayJson.fireConfig || null,
            quickPresets: relayJson.quickPresets || [],
            portfolioStocks: relayJson.portfolioStocks || [],
          },
        };
      }
    }
  } catch (e) {}

  return null;
}

/**
 * 推送數據至 Supabase (API、前端直連或通用雲端 Relay)
 */
export async function pushCloudData(payload: {
  syncCode: string;
  transactions?: Transaction[];
  categories?: CategoryItem[];
  fireConfig?: FIREConfig;
  quickPresets?: QuickPreset[];
  portfolioStocks?: PortfolioStock[];
}): Promise<SyncDataResponse | null> {
  // 1. 嘗試 API 路由
  try {
    const res = await fetch(`${API_BASE_URL}/api/data/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) return data;
    }
  } catch (err) {
    // API failed
  }

  // 2. 前端 Supabase 直連 fallback
  if (isFrontendSupabaseReady()) {
    const success = await pushSupabaseDataDirect(payload);
    if (success) {
      return {
        success: true,
        mode: 'supabase',
        lastSyncedAt: new Date().toISOString(),
        message: '全量數據已成功透過前端直連同步至 Supabase！',
      };
    }
  }

  // 3. 通用免費全球雲端 Relay Fallback (KVDB Global Storage)
  try {
    const cleanCode = payload.syncCode.trim().toUpperCase();
    const relayUrl = `https://kvdb.io/9L8xY7Z2w3V4u5T6s1R0/${encodeURIComponent(cleanCode)}`;
    const relayRes = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (relayRes.ok) {
      return {
        success: true,
        mode: 'supabase',
        lastSyncedAt: new Date().toISOString(),
        message: '全量數據已成功透過通用雲端 Relay 同步！',
      };
    }
  } catch (e) {}

  return null;
}

/**
 * 新增/更新單筆交易至 Supabase
 */
export async function saveTransactionToCloud(syncCode: string, transaction: Transaction): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncCode, transaction }),
    });
    if (res.ok) return true;
  } catch (err) {
    // fall back
  }

  return await saveTransactionDirect(transaction, syncCode);
}

/**
 * 從 Supabase 刪除交易記錄
 */
export async function deleteTransactionFromCloud(syncCode: string, id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/transactions/${id}?syncCode=${encodeURIComponent(syncCode)}`, {
      method: 'DELETE',
    });
    if (res.ok) return true;
  } catch (err) {
    // fall back
  }

  return await deleteTransactionDirect(id, syncCode);
}

/**
 * 更新 FIRE 設定至 Supabase
 */
export async function saveFIREConfigToCloud(syncCode: string, config: FIREConfig): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncCode, config }),
    });
    if (res.ok) return true;
  } catch (err) {
    // fall back
  }

  return await saveFIREConfigDirect(config, syncCode);
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
        fireConfig: null,
        quickPresets: [],
        portfolioStocks: [],
      }),
    });
    return true;
  } catch (e) {}

  return false;
}
