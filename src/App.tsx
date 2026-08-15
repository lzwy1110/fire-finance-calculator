import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  calculateStockMetrics,
  mergeStockPortfolios,
  syncStockCalculations,
} from './utils/portfolioMath';
import {
  autoSyncToCloud,
  getOrCreateSyncCode,
  loadCategories,
  loadFIREConfig,
  loadQuickPresets,
  loadTransactions,
  loadPortfolioStocks,
  savePortfolioStocks,
  savePortfolioStocksLocalOnly,
  removeSingleTransactionFromCloud,
  resetAllDataToDefault,
  saveCategories,
  saveCategoriesLocalOnly,
  saveFIREConfig,
  saveFIREConfigLocalOnly,
  saveTransactions,
  saveTransactionsLocalOnly,
  saveQuickPresets,
  saveQuickPresetsLocalOnly,
  syncSingleTransactionToCloud,
  getStorageMode,
  setStorageMode,
  switchToCloudMode,
  switchToLocalMode,
} from './utils/storage';
import { fetchCloudData } from './services/api';
import { subscribeToRealtimeSync } from './services/realtimeSync';

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
import { DataReconciliationModal, CloudSnapshotData, LocalSnapshotData } from './components/DataReconciliationModal';
import { AppLoadingSplash } from './components/AppLoadingSplash';
import { DEFAULT_CATEGORIES, DEFAULT_FIRE_CONFIG, DEFAULT_QUICK_PRESETS } from './data/initialData';
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
  const [storageMode, setStorageModeState] = useState<'cloud' | 'local'>(getStorageMode());
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true);
  const lastUserEditTimeRef = useRef<number>(0);

  // Modals state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);
  const [reconciliationModalData, setReconciliationModalData] = useState<{
    cloudData: CloudSnapshotData;
    localData: LocalSnapshotData;
  } | null>(null);

  // Startup Load: Check Storage Mode (Local vs Cloud-First)
  useEffect(() => {
    const currentMode = getStorageMode();
    setStorageModeState(currentMode);
    const code = getOrCreateSyncCode();
    setSyncCode(code);

    if (currentMode === 'local') {
      const localTx = loadTransactions();
      const localCat = loadCategories();
      const localPresets = loadQuickPresets();
      const localStocks = loadPortfolioStocks();
      const loadedConfig = loadFIREConfig();

      setTransactions(localTx);
      setCategories(localCat);
      setQuickPresets(localPresets);
      setPortfolioStocks(localStocks);
      setFireConfig(loadedConfig);
      applyThemeToCSSVariables(loadedConfig.themeColor);

      setTimeout(() => {
        setIsAppLoading(false);
      }, 200);
      return;
    }

    // Pure Cloud-First Load on App Launch (Fetch single source of truth from Supabase)
    fetchCloudData(code)
      .then((cloudRes) => {
        if (cloudRes && cloudRes.success && cloudRes.data) {
          const { transactions: cTx, categories: cCat, fireConfig: cCfg, quickPresets: cPresets, portfolioStocks: cStocks } = cloudRes.data;

          setTransactions(cTx || []);
          saveTransactionsLocalOnly(cTx || []);

          if (Array.isArray(cCat) && cCat.length > 0) {
            setCategories(cCat);
            saveCategoriesLocalOnly(cCat);
          } else {
            setCategories(DEFAULT_CATEGORIES);
            saveCategoriesLocalOnly(DEFAULT_CATEGORIES);
          }

          if (cCfg) {
            const merged = {
              ...DEFAULT_FIRE_CONFIG,
              ...cCfg,
              baseCashBalance: cCfg.baseCashBalance ?? (cCfg.cashSavings ?? 0),
              cashSavings: cCfg.cashSavings ?? (cCfg.baseCashBalance ?? 0),
            };
            setFireConfig(merged);
            saveFIREConfigLocalOnly(merged);
            applyThemeToCSSVariables(merged.themeColor);
          } else {
            const zeroCfg = { ...DEFAULT_FIRE_CONFIG, currentNetWorth: 0, cashSavings: 0, baseCashBalance: 0 };
            setFireConfig(zeroCfg);
            saveFIREConfigLocalOnly(zeroCfg);
            applyThemeToCSSVariables(zeroCfg.themeColor);
          }

          if (Array.isArray(cPresets) && cPresets.length > 0) {
            setQuickPresets(cPresets);
            saveQuickPresetsLocalOnly(cPresets);
          } else {
            setQuickPresets(DEFAULT_QUICK_PRESETS);
            saveQuickPresetsLocalOnly(DEFAULT_QUICK_PRESETS);
          }

          if (Array.isArray(cStocks)) {
            const synced = cStocks.map((s) => syncStockCalculations(s));
            setPortfolioStocks(synced);
            savePortfolioStocksLocalOnly(synced);
          } else {
            setPortfolioStocks([]);
            savePortfolioStocksLocalOnly([]);
          }
        } else {
          // Fallback to local cache if offline
          const localTx = loadTransactions();
          const localCat = loadCategories();
          const localPresets = loadQuickPresets();
          const localStocks = loadPortfolioStocks();
          const loadedConfig = loadFIREConfig();
          setTransactions(localTx);
          setCategories(localCat);
          setQuickPresets(localPresets);
          setPortfolioStocks(localStocks);
          setFireConfig(loadedConfig);
          applyThemeToCSSVariables(loadedConfig.themeColor);
        }

        setTimeout(() => {
          setIsAppLoading(false);
        }, 350);
      })
      .catch(() => {
        setIsAppLoading(false);
      });
  }, []);

  const handleToggleStorageMode = async (targetMode: 'cloud' | 'local') => {
    if (targetMode === 'cloud') {
      const res = await switchToCloudMode();
      setStorageModeState('cloud');
      setSyncCode(res.syncCode);
      await handleRefreshAllData(true);
    } else {
      await switchToLocalMode();
      setStorageModeState('local');
    }
  };

  // Sync theme changes
  useEffect(() => {
    applyThemeToCSSVariables(fireConfig.themeColor);
  }, [fireConfig.themeColor]);

  // Real-Time Multi-Device WebSocket Realtime Channel Subscription
  useEffect(() => {
    const code = syncCode || getOrCreateSyncCode();
    const unsubscribe = subscribeToRealtimeSync(code, () => {
      // Received remote instant broadcast! Refresh immediately!
      handleRefreshAllData(true);
    });

    return () => {
      unsubscribe();
    };
  }, [syncCode]);

  // Fallback Multi-Device Auto-Sync Listener: Window Focus + 20s Polling + Tab Switch
  useEffect(() => {
    const handleFocus = () => {
      handleRefreshAllData();
    };
    window.addEventListener('focus', handleFocus);
    const handleVis = () => {
      if (document.visibilityState === 'visible') handleFocus();
    };
    document.addEventListener('visibilitychange', handleVis);

    const pollInterval = setInterval(() => {
      handleRefreshAllData();
    }, 20000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVis);
      clearInterval(pollInterval);
    };
  }, []);

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

  // Double-Entry Accounting: Auto-Sync Total FIRE Net Worth in Real Time
  // Total Net Worth = Live Stock Market Value + Cash Savings (Base Cash + Income - Expense - Tax - Stock Purchases + Stock Sales)
  useEffect(() => {
    let stockMarketValue = 0;
    let stockTradeNetCash = 0;

    if (Array.isArray(portfolioStocks) && portfolioStocks.length > 0) {
      portfolioStocks.forEach((s) => {
        const synced = syncStockCalculations(s);
        const val = synced.shares * (synced.currentPrice || 0);
        const rate = s.market === 'US' ? 32.5 : 1;
        stockMarketValue += val * rate;

        (synced.transactions || []).forEach((tx) => {
          const tradeAmt = (tx.shares * tx.price) * rate;
          if (tx.type === 'BUY') {
            if (!tx.isInitialHoldings) {
              stockTradeNetCash -= tradeAmt; // Only deduct cash for NEW cash purchases, skip for pre-existing holdings
            }
          } else if (tx.type === 'SELL') {
            stockTradeNetCash += tradeAmt; // Selling stock generates cash!
          }
        });
      });
    }

    // Ledger Net Cash Savings (Income - Expense - Tax)
    let ledgerNetCash = 0;
    if (Array.isArray(transactions)) {
      transactions.forEach((t) => {
        if (t.type === 'income') ledgerNetCash += t.amount;
        if (t.type === 'expense') ledgerNetCash -= t.amount;
        if (t.type === 'tax') ledgerNetCash -= t.amount;
      });
    }

    const baseCash = fireConfig.baseCashBalance ?? (fireConfig.cashSavings ?? (fireConfig.currentNetWorth ? Math.max(0, fireConfig.currentNetWorth) : 0));
    const computedCashSavings = Math.round(baseCash + ledgerNetCash + stockTradeNetCash);
    const totalNetWorth = Math.round(stockMarketValue + computedCashSavings);

    if (
      (fireConfig.currentNetWorth || 0) !== totalNetWorth ||
      (fireConfig.cashSavings || 0) !== computedCashSavings ||
      fireConfig.baseCashBalance === undefined
    ) {
      setFireConfig((prev) => {
        const updated = {
          ...prev,
          baseCashBalance: prev.baseCashBalance ?? baseCash,
          cashSavings: computedCashSavings,
          currentNetWorth: totalNetWorth,
        };
        saveFIREConfigLocalOnly(updated);
        return updated;
      });
    }
  }, [portfolioStocks, transactions, fireConfig.baseCashBalance]);

  // Update Portfolio Stocks
  const handleUpdatePortfolioStocks = (newStocks: PortfolioStock[]) => {
    lastUserEditTimeRef.current = Date.now();
    const synced = newStocks.map((s) => syncStockCalculations(s));
    setPortfolioStocks(synced);
    savePortfolioStocks(synced);
  };

  // Sync Total Portfolio Value to FIRE Model Net Worth
  const handleSyncNetWorthToFIRE = (totalMarketValueTWD: number) => {
    lastUserEditTimeRef.current = Date.now();
    const cash = fireConfig.cashSavings ?? (fireConfig.baseCashBalance || 0);
    const totalNetWorth = Math.round(cash + totalMarketValueTWD);
    const newConfig = {
      ...fireConfig,
      currentNetWorth: totalNetWorth,
    };
    setFireConfig(newConfig);
    saveFIREConfig(newConfig);
  };

  // Add Transaction
  const handleAddTransaction = (t: Omit<Transaction, 'id'>) => {
    lastUserEditTimeRef.current = Date.now();
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

    const handleWidgetUrl = (url: string) => {
      try {
        const urlStr = url.toString();
        if (urlStr.includes('quick-add')) {
          const urlObj = new URL(urlStr);
          const type = urlObj.searchParams.get('type') as any;
          const amount = urlObj.searchParams.get('amount');
          const mainCategory = urlObj.searchParams.get('mainCategory');
          const subCategory = urlObj.searchParams.get('subCategory');

          if (amount && mainCategory && type) {
            handleAddTransaction({
              type,
              amount: parseFloat(amount),
              mainCategory,
              subCategory: subCategory || '',
              date: new Date().toISOString().slice(0, 10),
              note: '來自 Android Widget 快記',
              tags: ['Widget'],
            });
            return;
          }

          if (mainCategory && subCategory) {
            const preset = quickPresets.find(
              (p) => p.mainCategory === mainCategory && p.subCategory === subCategory
            );
            if (preset) {
              handleAddTransaction({
                type: 'expense',
                amount: preset.amount,
                mainCategory: preset.mainCategory,
                subCategory: preset.subCategory,
                date: new Date().toISOString().slice(0, 10),
                note: `來自 Widget 快記 (${preset.label})`,
                tags: ['Widget'],
                isQuickPreset: true,
              });
            }
          }
          setIsQuickAddOpen(true);
        }
      } catch (e) {
        if (url.includes('quick-add')) {
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
    lastUserEditTimeRef.current = Date.now();
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    saveTransactions(updated);
    removeSingleTransactionFromCloud(id);
  };

  const liveStockMarketValue = useMemo(() => {
    let sum = 0;
    if (Array.isArray(portfolioStocks) && portfolioStocks.length > 0) {
      portfolioStocks.forEach((s) => {
        const synced = syncStockCalculations(s);
        const val = synced.shares * (synced.currentPrice || 0);
        const rate = s.market === 'US' ? 32.5 : 1;
        sum += val * rate;
      });
    }
    return Math.round(sum);
  }, [portfolioStocks]);

  const handleUpdateFIREConfig = (newConfig: FIREConfig) => {
    lastUserEditTimeRef.current = Date.now();

    let stockTradeNetCash = 0;
    if (Array.isArray(portfolioStocks) && portfolioStocks.length > 0) {
      portfolioStocks.forEach((s) => {
        const rate = s.market === 'US' ? 32.5 : 1;
        (s.transactions || []).forEach((tx) => {
          const tradeAmt = (tx.shares * tx.price) * rate;
          if (tx.type === 'BUY' && !tx.isInitialHoldings) {
            stockTradeNetCash -= tradeAmt;
          } else if (tx.type === 'SELL') {
            stockTradeNetCash += tradeAmt;
          }
        });
      });
    }

    let ledgerNetCash = 0;
    if (Array.isArray(transactions)) {
      transactions.forEach((t) => {
        if (t.type === 'income') ledgerNetCash += t.amount;
        if (t.type === 'expense') ledgerNetCash -= t.amount;
        if (t.type === 'tax') ledgerNetCash -= t.amount;
      });
    }

    const targetCash = newConfig.cashSavings ?? (newConfig.baseCashBalance ?? (fireConfig.cashSavings ?? 0));
    const calculatedBase = Math.round(targetCash - (ledgerNetCash + stockTradeNetCash));

    const finalConfig: FIREConfig = {
      ...newConfig,
      baseCashBalance: calculatedBase,
      cashSavings: targetCash,
      currentNetWorth: Math.round(targetCash + liveStockMarketValue),
    };

    setFireConfig(finalConfig);
    saveFIREConfig(finalConfig);
  };

  const handleUpdateCategories = (newCategories: CategoryItem[]) => {
    lastUserEditTimeRef.current = Date.now();
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

  const handleChooseCloudVersion = () => {
    if (!reconciliationModalData) return;
    const { cloudData } = reconciliationModalData;
    setTransactions(cloudData.transactions || []);
    saveTransactionsLocalOnly(cloudData.transactions || []);

    if (cloudData.categories && cloudData.categories.length > 0) {
      setCategories(cloudData.categories);
      saveCategoriesLocalOnly(cloudData.categories);
    }

    if (cloudData.quickPresets && cloudData.quickPresets.length > 0) {
      setQuickPresets(cloudData.quickPresets);
      saveQuickPresetsLocalOnly(cloudData.quickPresets);
    }

    const syncedStocks = (cloudData.portfolioStocks || []).map((s) => syncStockCalculations(s));
    setPortfolioStocks(syncedStocks);
    savePortfolioStocksLocalOnly(syncedStocks);

    if (cloudData.fireConfig) {
      const merged = {
        ...fireConfig,
        ...cloudData.fireConfig,
        baseCashBalance: cloudData.fireConfig.baseCashBalance ?? (cloudData.fireConfig.cashSavings ?? 0),
        cashSavings: cloudData.fireConfig.cashSavings ?? (cloudData.fireConfig.baseCashBalance ?? 0),
      };
      setFireConfig(merged);
      saveFIREConfigLocalOnly(merged);
      applyThemeToCSSVariables(merged.themeColor);
    } else {
      const zeroConfig = { ...fireConfig, currentNetWorth: 0, cashSavings: 0, baseCashBalance: 0 };
      setFireConfig(zeroConfig);
      saveFIREConfigLocalOnly(zeroConfig);
    }

    setReconciliationModalData(null);
  };

  const handleChooseLocalVersion = () => {
    if (!reconciliationModalData) return;
    autoSyncToCloud();
    setReconciliationModalData(null);
  };

  const handleRefreshAllData = async (isManual?: boolean) => {
    if (reconciliationModalData) return;

    // Skip background refresh if user performed an edit in the last 4 seconds
    if (Date.now() - lastUserEditTimeRef.current < 4000) {
      return;
    }

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
        const { transactions: cTx, categories: cCat, fireConfig: cCfg, quickPresets: cPresets, portfolioStocks: cStocks } = cloudRes.data;
        if (Array.isArray(cTx)) {
          setTransactions(cTx);
          saveTransactionsLocalOnly(cTx);
        }
        if (Array.isArray(cCat) && cCat.length > 0) {
          setCategories(cCat);
          saveCategoriesLocalOnly(cCat);
        }
        if (cCfg) {
          const merged = {
            ...DEFAULT_FIRE_CONFIG,
            ...cCfg,
            baseCashBalance: cCfg.baseCashBalance ?? (cCfg.cashSavings ?? 0),
            cashSavings: cCfg.cashSavings ?? (cCfg.baseCashBalance ?? 0),
          };
          setFireConfig(merged);
          saveFIREConfigLocalOnly(merged);
          applyThemeToCSSVariables(merged.themeColor);
        }
        if (Array.isArray(cPresets) && cPresets.length > 0) {
          setQuickPresets(cPresets);
          saveQuickPresetsLocalOnly(cPresets);
        }
        if (Array.isArray(cStocks)) {
          const synced = cStocks.map((s) => syncStockCalculations(s));
          setPortfolioStocks(synced);
          savePortfolioStocksLocalOnly(synced);
        }
      }
    } catch (e) {}
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

  if (isAppLoading) {
    return <AppLoadingSplash themeColor={fireConfig.themeColor} statusMessage="正在連線雲端資料庫並同步資產..." />;
  }

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
        storageMode={storageMode}
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

        {/* Tab 3: Integrated Monthly & Yearly Financial Summary */}
        {(activeTab === 'monthly' || activeTab === 'yearly') && (
          <MonthlyYearlySummary
            transactions={transactions}
            fireConfig={fireConfig}
            initialMode={activeTab === 'yearly' ? 'yearly' : 'monthly'}
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
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-6 text-center text-xs text-zinc-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-300">FIRE Planner</span>
            <span>• 整合美股與台股庫存、收支細類、稅金、投資與 FIRE 退休估算</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400">
            <button onClick={() => setIsSystemSettingsOpen(true)} className="hover:text-amber-400 cursor-pointer">
              系統偏好與存儲設定
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
        stockMarketValue={liveStockMarketValue}
        onSaveConfig={handleUpdateFIREConfig}
        syncCode={syncCode}
        storageMode={storageMode}
        onToggleStorageMode={handleToggleStorageMode}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
      />

      <DataReconciliationModal
        isOpen={Boolean(reconciliationModalData)}
        cloudData={reconciliationModalData?.cloudData || null}
        localData={reconciliationModalData?.localData || {
          transactions,
          categories,
          fireConfig,
          quickPresets,
          portfolioStocks,
        }}
        themeColor={fireConfig.themeColor}
        onChooseCloud={handleChooseCloudVersion}
        onChooseLocal={handleChooseLocalVersion}
      />
    </div>
  );
}
