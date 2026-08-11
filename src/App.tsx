import React, { useState, useEffect } from 'react';
import { registerPlugin } from '@capacitor/core';
import {
  CategoryItem,
  FIREConfig,
  QuickPreset,
  Transaction,
  PortfolioStock,
} from './types';
import { calculateFIRE } from './utils/fireCalculator';
import {
  autoSyncToCloud,
  getOrCreateSyncCode,
  loadCategories,
  loadFIREConfig,
  loadQuickPresets,
  loadTransactions,
  loadPortfolioStocks,
  savePortfolioStocks,
  removeSingleTransactionFromCloud,
  resetAllDataToDefault,
  saveCategories,
  saveFIREConfig,
  saveTransactions,
  syncSingleTransactionToCloud,
} from './utils/storage';
import { fetchCloudData } from './services/api';

import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { MonthlyYearlySummary } from './components/MonthlyYearlySummary';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { TransactionList } from './components/TransactionList';
import { PortfolioView } from './components/PortfolioView';
import { QuickAddModal } from './components/QuickAddModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { SystemSettingsModal } from './components/SystemSettingsModal';
import { applyThemeToCSSVariables } from './utils/theme';

interface WidgetBridgePluginType {
  getPendingWidgetTransactions: () => Promise<{ pending_txs: string }>;
  loadWidgetAppData: () => Promise<{ app_transactions_json: string }>;
  saveWidgetAppData: (options: { transactions: any[]; todayExpense: number }) => Promise<void>;
  saveWidgetCustomConfig: (options: { cats?: string; subs?: string }) => Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePluginType>('WidgetBridge');

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monthly' | 'yearly' | 'ledger' | 'analytics' | 'portfolio'>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [quickPresets, setQuickPresets] = useState<QuickPreset[]>([]);
  const [portfolioStocks, setPortfolioStocks] = useState<PortfolioStock[]>([]);
  const [fireConfig, setFireConfig] = useState<FIREConfig>(loadFIREConfig());
  const [syncCode, setSyncCode] = useState<string>('');

  // Modals state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);

  // Initialize data locally first, then sync with Supabase / Express backend if connected
  useEffect(() => {
    const localTx = loadTransactions();
    const localCat = loadCategories();
    const localPresets = loadQuickPresets();
    const localStocks = loadPortfolioStocks();
    const loadedConfig = loadFIREConfig();
    const code = getOrCreateSyncCode();

    setTransactions(localTx);
    setCategories(localCat);
    setQuickPresets(localPresets);
    setPortfolioStocks(localStocks);
    setFireConfig(loadedConfig);
    setSyncCode(code);
    applyThemeToCSSVariables(loadedConfig.themeColor);

    // Background fetch from Supabase backend
    fetchCloudData(code).then((cloudRes) => {
      if (cloudRes && cloudRes.success && cloudRes.data) {
        const { transactions: cTx, categories: cCat, fireConfig: cCfg, quickPresets: cPresets } = cloudRes.data;
        if (Array.isArray(cTx)) {
          setTransactions(cTx);
          saveTransactions(cTx);
        }
        if (Array.isArray(cCat) && cCat.length > 0) {
          setCategories(cCat);
          saveCategories(cCat);
        }
        if (cCfg) {
          setFireConfig(cCfg);
          saveFIREConfig(cCfg);
          applyThemeToCSSVariables(cCfg.themeColor);
        }
        if (Array.isArray(cPresets) && cPresets.length > 0) {
          setQuickPresets(cPresets);
        }
      }
    });
  }, []);

  // Sync theme changes
  useEffect(() => {
    applyThemeToCSSVariables(fireConfig.themeColor);
  }, [fireConfig.themeColor]);

  // Two-way Sync: Push App Transactions to Android Widget Bridge so Widget "Today Expense" is 100% identical to App Database!
  useEffect(() => {
    if (transactions) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayTotal = transactions
        .filter((t) => t.date === todayStr && t.type !== 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      WidgetBridge.saveWidgetAppData({
        transactions: transactions as any,
        todayExpense: todayTotal,
      }).catch(() => {});
    }
  }, [transactions]);

  // Sync Categories & Sub-Categories to Android Widget Bridge whenever categories change
  useEffect(() => {
    if (categories.length > 0) {
      try {
        const subsMap: Record<string, string[]> = {};
        categories.forEach((c) => {
          if (c.subCategories && c.subCategories.length > 0) {
            subsMap[c.name] = c.subCategories.slice(0, 6);
          }
        });
        WidgetBridge.saveWidgetCustomConfig({
          subs: JSON.stringify(subsMap),
        }).catch(() => {});
      } catch (e) {}
    }
  }, [categories]);

  // Auto-Sync Total Portfolio Market Value to FIRE Net Worth in Real Time
  useEffect(() => {
    if (portfolioStocks && portfolioStocks.length > 0) {
      let totalMarketValue = 0;
      portfolioStocks.forEach((s) => {
        const val = (s.shares || 0) * (s.currentPrice || 0);
        totalMarketValue += s.market === 'US' ? val * 32.5 : val;
      });

      const roundedVal = Math.round(totalMarketValue);
      if (roundedVal > 0 && Math.abs((fireConfig.currentNetWorth || 0) - roundedVal) > 1) {
        setFireConfig((prev) => {
          const updated = { ...prev, currentNetWorth: roundedVal };
          saveFIREConfig(updated);
          return updated;
        });
      }
    }
  }, [portfolioStocks]);

  // Update Portfolio Stocks
  const handleUpdatePortfolioStocks = (newStocks: PortfolioStock[]) => {
    setPortfolioStocks(newStocks);
    savePortfolioStocks(newStocks);
  };

  // Sync Total Portfolio Value to FIRE Model Net Worth (Implicitly called or auto-synced)
  const handleSyncNetWorthToFIRE = (totalMarketValueTWD: number) => {
    const newConfig = {
      ...fireConfig,
      currentNetWorth: Math.round(totalMarketValueTWD),
    };
    setFireConfig(newConfig);
    saveFIREConfig(newConfig);
  };

  // Add Transaction
  const handleAddTransaction = (t: Omit<Transaction, 'id'>) => {
    const newRecord: Transaction = {
      ...t,
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setTransactions((prev) => {
      const updated = [newRecord, ...prev];
      saveTransactions(updated);
      return updated;
    });
    syncSingleTransactionToCloud(newRecord);

    // Also update currentNetWorth dynamically if investment was logged!
    if (t.type === 'investment') {
      setFireConfig((prevConfig) => {
        const newConfig = {
          ...prevConfig,
          currentNetWorth: prevConfig.currentNetWorth + t.amount,
        };
        saveFIREConfig(newConfig);
        return newConfig;
      });
    }
  };

  // Handle App Launch & Resume: Ingest Widget Recorded Transactions
  useEffect(() => {
    const ingestWidgetTransactions = () => {
      WidgetBridge.loadWidgetAppData().then((res) => {
        if (res && res.app_transactions_json) {
          try {
            const parsed = JSON.parse(res.app_transactions_json);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTransactions((prev) => {
                const existingIds = new Set(prev.map((t) => t.id));
                const newItems = parsed.filter((t: any) => !existingIds.has(t.id));
                if (newItems.length > 0) {
                  const merged = [...newItems, ...prev];
                  saveTransactions(merged);
                  newItems.forEach((item) => syncSingleTransactionToCloud(item));
                  return merged;
                }
                return prev;
              });
            }
          } catch (e) {}
        }
      }).catch(() => {});
    };

    const handleWidgetUrl = (urlStr: string) => {
      if (!urlStr) return;
      try {
        const urlObj = new URL(urlStr);
        if (urlObj.protocol === 'fireflow:' || urlStr.includes('quick-add') || urlStr.includes('quick_add')) {
          const cat = urlObj.searchParams.get('cat');
          const sub = urlObj.searchParams.get('sub');
          const amt = urlObj.searchParams.get('amt');

          if (cat && sub && amt) {
            const parsedAmt = parseFloat(amt);
            if (!isNaN(parsedAmt)) {
              handleAddTransaction({
                type: cat === '收入' ? 'income' : cat === '投資資產' ? 'investment' : cat === '稅金規費' ? 'tax' : 'expense',
                amount: parsedAmt,
                mainCategory: cat,
                subCategory: sub,
                date: new Date().toISOString().slice(0, 10),
                note: '來自 Android 桌面小工具 1 秒速記',
                isQuickPreset: true,
              });
            }
          }
          setIsQuickAddOpen(true);
        }
      } catch (e) {
        if (urlStr.includes('quick-add')) {
          setIsQuickAddOpen(true);
        }
      }
    };

    ingestWidgetTransactions();
    handleWidgetUrl(window.location.href);

    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('appUrlOpen', (data) => {
        handleWidgetUrl(data.url);
        ingestWidgetTransactions();
      });
      CapApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          ingestWidgetTransactions();
        }
      });
    }).catch(() => {});
  }, []);

  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    saveTransactions(updated);
    removeSingleTransactionFromCloud(id);
  };

  const handleUpdateFIREConfig = (newConfig: FIREConfig) => {
    setFireConfig(newConfig);
    saveFIREConfig(newConfig);
  };

  const handleUpdateCategories = (newCategories: CategoryItem[]) => {
    setCategories(newCategories);
    saveCategories(newCategories);
  };

  const handleDataRestored = () => {
    setTransactions(loadTransactions());
    setCategories(loadCategories());
    setQuickPresets(loadQuickPresets());
    setPortfolioStocks(loadPortfolioStocks());
    const loadedConfig = loadFIREConfig();
    setFireConfig(loadedConfig);
    setSyncCode(getOrCreateSyncCode());
    applyThemeToCSSVariables(loadedConfig.themeColor);
  };

  const handleRefreshAllData = async () => {
    const code = syncCode || getOrCreateSyncCode();

    // 1. Ingest any pending transactions from Android Widget Bridge
    try {
      const res = await WidgetBridge.loadWidgetAppData();
      if (res && res.app_transactions_json) {
        const parsed = JSON.parse(res.app_transactions_json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTransactions((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newItems = parsed.filter((t: any) => !existingIds.has(t.id));
            if (newItems.length > 0) {
              const merged = [...newItems, ...prev];
              saveTransactions(merged);
              newItems.forEach((item) => syncSingleTransactionToCloud(item));
              return merged;
            }
            return prev;
          });
        }
      }
    } catch (e) {}

    // 2. Actively fetch latest cloud records from Supabase REST API
    try {
      const cloudRes = await fetchCloudData(code);
      if (cloudRes && cloudRes.success && cloudRes.data) {
        const { transactions: cTx, categories: cCat, fireConfig: cCfg, quickPresets: cPresets } = cloudRes.data;
        if (Array.isArray(cTx)) {
          setTransactions(cTx);
          saveTransactions(cTx);
        }
        if (Array.isArray(cCat) && cCat.length > 0) {
          setCategories(cCat);
          saveCategories(cCat);
        }
        if (cCfg) {
          setFireConfig(cCfg);
          saveFIREConfig(cCfg);
          applyThemeToCSSVariables(cCfg.themeColor);
        }
        if (Array.isArray(cPresets) && cPresets.length > 0) {
          setQuickPresets(cPresets);
        }
      }
    } catch (e) {}

    handleDataRestored();
  };

  const handleResetDefaultData = () => {
    if (window.confirm('確定要將財務資料重設為預設範例資料嗎？')) {
      resetAllDataToDefault();
      handleDataRestored();
      autoSyncToCloud();
    }
  };

  // Calculate FIRE Metrics
  const fireResult = calculateFIRE(fireConfig);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-300">
      {/* Top Sticky Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        onOpenConfig={() => setIsSystemSettingsOpen(true)}
        syncCode={syncCode}
        themeColor={fireConfig.themeColor}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Tab 1: Dashboard Overview */}
        {activeTab === 'dashboard' && (
          <DashboardOverview
            transactions={transactions}
            categories={categories}
            quickPresets={quickPresets}
            fireConfig={fireConfig}
            fireResult={fireResult}
            onUpdateFIREConfig={handleUpdateFIREConfig}
            onAddTransaction={handleAddTransaction}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
            onOpenCloudSync={() => setIsCloudSyncOpen(true)}
            setActiveTab={setActiveTab}
          />
        )}

        {/* Tab 2: Unified Investment Portfolio & Analytics */}
        {(activeTab === 'portfolio' || activeTab === 'analytics') && (
          <div className="space-y-8 animate-fadeIn">
            <PortfolioView
              stocks={portfolioStocks}
              fireConfig={fireConfig}
              onUpdateStocks={handleUpdatePortfolioStocks}
              onSyncNetWorthToFIRE={handleSyncNetWorthToFIRE}
            />

            {/* Integrated Investment Analytics & Category Distribution Section */}
            <div className="border-t border-white/10 pt-8">
              <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                <span>📊 財務統計分析與類別圖表</span>
              </h2>
              <AnalyticsCharts
                transactions={transactions}
                fireConfig={fireConfig}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Monthly Summary */}
        {activeTab === 'monthly' && (
          <MonthlyYearlySummary
            transactions={transactions}
            fireConfig={fireConfig}
            initialMode="monthly"
          />
        )}

        {/* Tab 4: Yearly Summary */}
        {activeTab === 'yearly' && (
          <MonthlyYearlySummary
            transactions={transactions}
            fireConfig={fireConfig}
            initialMode="yearly"
          />
        )}

        {/* Tab 5: Ledger Transactions */}
        {activeTab === 'ledger' && (
          <TransactionList
            transactions={transactions}
            categories={categories}
            fireConfig={fireConfig}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            onResetDefaultData={handleResetDefaultData}
            onRefreshData={handleRefreshAllData}
            syncCode={syncCode}
            onOpenCloudSync={() => setIsCloudSyncOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-6 text-center text-xs text-zinc-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-300">FIRE Planner</span>
            <span>• 整合美股與台股庫存、收支細類、稅金、投資與 FIRE 退休估估算（Supabase 雲端同步版）</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400">
            <button onClick={() => setIsCloudSyncOpen(true)} className="hover:text-amber-400 cursor-pointer">
              Supabase 雲端備份與同步
            </button>
            <button onClick={() => setIsCategoryManagerOpen(true)} className="hover:text-amber-400 cursor-pointer">
              管理分類細項
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        categories={categories}
        themeColor={fireConfig.themeColor}
        onAddTransaction={handleAddTransaction}
        onOpenCategoryManager={() => {
          setIsQuickAddOpen(false);
          setIsCategoryManagerOpen(true);
        }}
      />

      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
        syncCode={syncCode}
        themeColor={fireConfig.themeColor}
        onDataRestored={handleDataRestored}
      />

      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        themeColor={fireConfig.themeColor}
        onUpdateCategories={handleUpdateCategories}
      />

      <SystemSettingsModal
        isOpen={isSystemSettingsOpen}
        onClose={() => setIsSystemSettingsOpen(false)}
        config={fireConfig}
        onSaveConfig={handleUpdateFIREConfig}
      />
    </div>
  );
}
