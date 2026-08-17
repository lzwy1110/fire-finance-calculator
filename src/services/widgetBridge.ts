import { registerPlugin } from '@capacitor/core';

export interface WidgetBridgePluginType {
  consumePendingWidgetTransactions: () => Promise<{ pending_transactions_json: string }>;
  getPendingWidgetTransactions: () => Promise<{ pending_txs: string }>;
  loadWidgetAppData: () => Promise<{ app_transactions_json: string }>;
  saveWidgetAppData: (options: {
    transactions?: any[];
    todayExpense?: number;
    cashSavingsTWD?: number;
    cashSavingsUSD?: number;
    categoriesJson?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    syncCode?: string;
    storageMode?: string;
  }) => Promise<void>;
  saveWidgetCustomConfig: (options: {
    categoriesJson?: string;
    cats?: string;
    subs?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    syncCode?: string;
    storageMode?: string;
  }) => Promise<void>;
}

export const WidgetBridge = registerPlugin<WidgetBridgePluginType>('WidgetBridge');
