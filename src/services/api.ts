import { CategoryItem, CloudBackupData, FIREConfig, QuickPreset, Transaction } from '../types';

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
 * 檢查後端伺服器與 Supabase 連線狀態
 */
export async function checkBackendHealth(): Promise<HealthCheckResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Backend Health Check Offline]:', err);
    return null;
  }
}

/**
 * 從 Supabase/後端讀取同步資料
 */
export async function fetchCloudData(syncCode: string): Promise<FetchDataResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/data?syncCode=${encodeURIComponent(syncCode)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Cloud Fetch Data Offline]:', err);
    return null;
  }
}

/**
 * 推送數據備份至 Supabase/後端
 */
export async function pushCloudData(payload: {
  syncCode: string;
  transactions?: Transaction[];
  categories?: CategoryItem[];
  fireConfig?: FIREConfig;
  quickPresets?: QuickPreset[];
}): Promise<SyncDataResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/data/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Cloud Push Sync Data Offline]:', err);
    return null;
  }
}

/**
 * 新增/更新單筆交易至後端與 Supabase
 */
export async function saveTransactionToCloud(syncCode: string, transaction: Transaction): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncCode, transaction }),
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

/**
 * 從 Supabase 刪除交易記錄
 */
export async function deleteTransactionFromCloud(syncCode: string, id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/transactions/${id}?syncCode=${encodeURIComponent(syncCode)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    return false;
  }
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
    return res.ok;
  } catch (err) {
    return false;
  }
}
