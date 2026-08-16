import { registerPlugin } from '@capacitor/core';

export interface WidgetBridgePluginType {
  getPendingWidgetTransactions: () => Promise<{ pending_txs: string }>;
  loadWidgetAppData: () => Promise<{ app_transactions_json: string }>;
  saveWidgetAppData: (options: { transactions: any[]; todayExpense: number }) => Promise<void>;
  saveWidgetCustomConfig: (options: { cats?: string; subs?: string }) => Promise<void>;
}

export const WidgetBridge = registerPlugin<WidgetBridgePluginType>('WidgetBridge');
