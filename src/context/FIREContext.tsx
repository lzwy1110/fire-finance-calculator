import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  CategoryItem,
  FIREConfig,
  FIREResult,
  QuickPreset,
  Transaction,
  PortfolioStock,
} from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_FIRE_CONFIG,
  DEFAULT_PORTFOLIO_STOCKS,
  DEFAULT_QUICK_PRESETS,
  INITIAL_TRANSACTIONS,
} from '../data/initialData';
import {
  loadTransactions,
  saveTransactionsLocalOnly,
  saveTransactions,
  loadCategories,
  saveCategoriesLocalOnly,
  saveCategories,
  loadQuickPresets,
  saveQuickPresetsLocalOnly,
  saveQuickPresets,
  loadPortfolioStocks,
  savePortfolioStocksLocalOnly,
  savePortfolioStocks,
  loadFIREConfig,
  saveFIREConfigLocalOnly,
  saveFIREConfig,
  getOrCreateSyncCode,
  setSyncCode as persistSyncCode,
  getStorageMode,
  setStorageMode,
  autoSyncToCloud,
  switchToCloudMode,
  switchToLocalMode,
  restoreFromBackupJSON,
} from '../utils/storage';
import { fetchCloudData } from '../services/api';
import { subscribeToRealtimeSync, broadcastDataSyncEvent } from '../services/realtimeSync';
import { syncStockCalculations } from '../utils/portfolioMath';
import { calculateFIRE } from '../utils/fireCalculator';
import { applyThemeToCSSVariables } from '../utils/theme';
import { WidgetBridge } from '../services/widgetBridge';

interface FIREContextType {
  // State
  transactions: Transaction[];
  categories: CategoryItem[];
  quickPresets: QuickPreset[];
  portfolioStocks: PortfolioStock[];
  fireConfig: FIREConfig;
  liveStockMarketValue: number;
  totalNetWorth: number;
  fireResult: FIREResult;
  storageMode: 'cloud' | 'local';
  syncCode: string;
  isAppLoading: boolean;
  isSyncing: boolean;

  // Actions
  updateCashSavings: (amount: number) => void;
  updateFIREConfig: (config: FIREConfig) => void;
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  updateCategories: (cats: CategoryItem[]) => void;
  updatePortfolioStocks: (stocks: PortfolioStock[]) => void;
  updateQuickPresets: (presets: QuickPreset[]) => void;
  refreshCloudData: (isManual?: boolean) => Promise<boolean>;
  toggleStorageMode: (mode: 'cloud' | 'local') => Promise<void>;
  restoreAllData: () => void;
}

const FIREContext = createContext<FIREContextType | undefined>(undefined);

export const FIREProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageModeState, setStorageModeState] = useState<'cloud' | 'local'>(getStorageMode());
  const [syncCodeState, setSyncCodeState] = useState<string>(getOrCreateSyncCode());

  // Core Data States
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions());
  const [categories, setCategories] = useState<CategoryItem[]>(() => loadCategories());
  const [quickPresets, setQuickPresets] = useState<QuickPreset[]>(() => loadQuickPresets());
  const [portfolioStocks, setPortfolioStocks] = useState<PortfolioStock[]>(() => {
    const raw = loadPortfolioStocks();
    return raw.map((s) => syncStockCalculations(s));
  });
  const [fireConfig, setFireConfig] = useState<FIREConfig>(() => loadFIREConfig());

  // Prevent refresh storms immediately after user edit
  const lastUserEditTimeRef = useRef<number>(0);

  // 1. Calculate Real-Time Stock Market Value
  const liveStockMarketValue = useMemo(() => {
    let sum = 0;
    if (Array.isArray(portfolioStocks) && portfolioStocks.length > 0) {
      portfolioStocks.forEach((s) => {
        const synced = syncStockCalculations(s);
        const val = (synced.shares || 0) * (synced.currentPrice || 0);
        const rate = s.market === 'US' ? 32.5 : 1;
        sum += val * rate;
      });
    }
    return Math.round(sum);
  }, [portfolioStocks]);

  // 2. Authoritative Cash Reserves & Total Net Worth
  const cashSavings = useMemo(() => {
    return fireConfig.cashSavings ?? (fireConfig.baseCashBalance ?? 0);
  }, [fireConfig.cashSavings, fireConfig.baseCashBalance]);

  const totalNetWorth = useMemo(() => {
    return Math.round(cashSavings + liveStockMarketValue);
  }, [cashSavings, liveStockMarketValue]);

  // 3. Computed FIRE Results
  const fireResult = useMemo(() => {
    return calculateFIRE({
      ...fireConfig,
      cashSavings,
      currentNetWorth: totalNetWorth,
    });
  }, [fireConfig, cashSavings, totalNetWorth]);

  // Keep CSS Theme updated
  useEffect(() => {
    applyThemeToCSSVariables(fireConfig.themeColor);
  }, [fireConfig.themeColor]);

  // 4. Pure Read Cloud Fetcher (Never pushes back)
  const refreshCloudData = useCallback(async (isManual = false): Promise<boolean> => {
    if (storageModeState === 'local') return false;

    // Skip background auto-refresh if user edited within last 4 seconds
    if (!isManual && Date.now() - lastUserEditTimeRef.current < 4000) {
      return false;
    }

    const code = syncCodeState || getOrCreateSyncCode();
    setIsSyncing(true);

    try {
      // Ingest any Android Widget recorded transactions locally
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
                saveTransactionsLocalOnly(merged);
                return merged;
              }
              return prev;
            });
          }
        }
      } catch (e) {}

      // Fetch cloud records
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
          const cashVal = cCfg.cashSavings != null 
            ? cCfg.cashSavings 
            : (cCfg.baseCashBalance != null 
                ? cCfg.baseCashBalance 
                : (cCfg.currentNetWorth != null && cCfg.currentNetWorth > 0 
                    ? cCfg.currentNetWorth 
                    : 0));

          const merged: FIREConfig = {
            ...DEFAULT_FIRE_CONFIG,
            ...cCfg,
            cashSavings: cashVal,
            baseCashBalance: cashVal,
          };
          setFireConfig(merged);
          saveFIREConfigLocalOnly(merged);
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
        return true;
      }
    } catch (e) {
      console.warn('Cloud refresh error:', e);
    } finally {
      setIsSyncing(false);
    }
    return false;
  }, [storageModeState, syncCodeState]);

  const restoreAllData = useCallback(() => {
    const tx = loadTransactions();
    const cat = loadCategories();
    const presets = loadQuickPresets();
    const stocks = loadPortfolioStocks();
    const cfg = loadFIREConfig();

    setTransactions(tx);
    setCategories(cat);
    setQuickPresets(presets);
    setPortfolioStocks(stocks);
    setFireConfig(cfg);
  }, []);

  // 5. Initial App Load (Runs strictly once on mount)
  useEffect(() => {
    const initApp = async () => {
      const mode = getStorageMode();
      if (mode === 'cloud') {
        await refreshCloudData(true);
      }
      setTimeout(() => {
        setIsAppLoading(false);
      }, 250);
    };

    initApp();
  }, []);

  // 6. Background Realtime & Sync Listeners
  useEffect(() => {
    // Subscribe to Realtime WebSocket / Broadcast Channel
    const unsubscribe = subscribeToRealtimeSync(syncCodeState, () => {
      // Received remote change broadcast -> execute Pure Read refresh
      refreshCloudData(true);
    });

    // Instant Cross-Tab LocalStorage event listener
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('fire_')) {
        restoreAllData();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Focus & Visibility change listener
    const handleFocus = () => {
      if (storageModeState === 'cloud') {
        refreshCloudData(false);
      }
    };
    window.addEventListener('focus', handleFocus);

    // 25s interval background refresh
    const interval = setInterval(() => {
      if (storageModeState === 'cloud' && document.visibilityState === 'visible') {
        refreshCloudData(false);
      }
    }, 25000);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [storageModeState, syncCodeState, refreshCloudData, restoreAllData]);

  // ================= MUTATION ACTIONS ================= //

  const updateCashSavings = useCallback((amount: number) => {
    lastUserEditTimeRef.current = Date.now();
    const finalCash = Math.max(0, Math.round(amount));

    setFireConfig((prev) => {
      const updated: FIREConfig = {
        ...prev,
        cashSavings: finalCash,
        baseCashBalance: finalCash,
        currentNetWorth: Math.round(finalCash + liveStockMarketValue),
      };
      saveFIREConfig(updated);
      return updated;
    });
  }, [liveStockMarketValue]);

  const updateFIREConfig = useCallback((newConfig: FIREConfig) => {
    lastUserEditTimeRef.current = Date.now();
    const finalCash = newConfig.cashSavings ?? (newConfig.baseCashBalance ?? (fireConfig.cashSavings ?? 0));

    const updated: FIREConfig = {
      ...newConfig,
      cashSavings: finalCash,
      baseCashBalance: finalCash,
      currentNetWorth: Math.round(finalCash + liveStockMarketValue),
    };

    setFireConfig(updated);
    saveFIREConfig(updated);
  }, [fireConfig.cashSavings, liveStockMarketValue]);

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>) => {
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
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    lastUserEditTimeRef.current = Date.now();
    setTransactions((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveTransactions(updated);
      return updated;
    });
  }, []);

  const updateCategories = useCallback((cats: CategoryItem[]) => {
    lastUserEditTimeRef.current = Date.now();
    setCategories(cats);
    saveCategories(cats);
  }, []);

  const updatePortfolioStocks = useCallback((stocks: PortfolioStock[]) => {
    lastUserEditTimeRef.current = Date.now();
    const synced = stocks.map((s) => syncStockCalculations(s));
    setPortfolioStocks(synced);
    savePortfolioStocks(synced);
  }, []);

  const updateQuickPresets = useCallback((presets: QuickPreset[]) => {
    lastUserEditTimeRef.current = Date.now();
    setQuickPresets(presets);
    saveQuickPresets(presets);
  }, []);

  const toggleStorageMode = useCallback(async (mode: 'cloud' | 'local') => {
    if (mode === 'cloud') {
      const res = await switchToCloudMode();
      setStorageModeState('cloud');
      setSyncCodeState(res.syncCode);
      persistSyncCode(res.syncCode);
      await refreshCloudData(true);
    } else {
      await switchToLocalMode();
      setStorageModeState('local');
    }
  }, [refreshCloudData]);

  const value = useMemo(() => ({
    transactions,
    categories,
    quickPresets,
    portfolioStocks,
    fireConfig,
    liveStockMarketValue,
    totalNetWorth,
    fireResult,
    storageMode: storageModeState,
    syncCode: syncCodeState,
    isAppLoading,
    isSyncing,
    updateCashSavings,
    updateFIREConfig,
    addTransaction,
    deleteTransaction,
    updateCategories,
    updatePortfolioStocks,
    updateQuickPresets,
    refreshCloudData,
    toggleStorageMode,
    restoreAllData,
  }), [
    transactions,
    categories,
    quickPresets,
    portfolioStocks,
    fireConfig,
    liveStockMarketValue,
    totalNetWorth,
    fireResult,
    storageModeState,
    syncCodeState,
    isAppLoading,
    isSyncing,
    updateCashSavings,
    updateFIREConfig,
    addTransaction,
    deleteTransaction,
    updateCategories,
    updatePortfolioStocks,
    updateQuickPresets,
    refreshCloudData,
    toggleStorageMode,
    restoreAllData,
  ]);

  return <FIREContext.Provider value={value}>{children}</FIREContext.Provider>;
};

export const useFIRE = (): FIREContextType => {
  const context = useContext(FIREContext);
  if (!context) {
    throw new Error('useFIRE must be used within a FIREProvider');
  }
  return context;
};
