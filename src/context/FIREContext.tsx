import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  CategoryItem,
  FIREConfig,
  FIREResult,
  QuickPreset,
  Transaction,
  PortfolioStock,
  TaxItem,
} from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_FIRE_CONFIG,
  DEFAULT_PORTFOLIO_STOCKS,
  DEFAULT_QUICK_PRESETS,
  DEFAULT_ANNUAL_TAXES,
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
import { fetchCloudData, saveStockToCloud, deleteStockFromCloud } from '../services/api';
import { subscribeToRealtimeSync, broadcastDataSyncEvent } from '../services/realtimeSync';
import { syncStockCalculations } from '../utils/portfolioMath';
import { calculateFIRE } from '../utils/fireCalculator';
import { applyThemeToCSSVariables } from '../utils/theme';
import { WidgetBridge } from '../services/widgetBridge';
import { fetchLiveUsdRate } from '../services/exchangeRateService';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

interface FIREContextType {
  // State
  transactions: Transaction[];
  categories: CategoryItem[];
  quickPresets: QuickPreset[];
  portfolioStocks: PortfolioStock[];
  fireConfig: FIREConfig;
  annualTaxes: TaxItem[];
  annualTaxTotal: number;
  usdRate: number;
  cashSavingsTWD: number;
  cashSavingsUSD: number;
  liveTWStockMarketValue: number;
  liveUSStockMarketValue: number;
  liveStockMarketValue: number;
  totalNetWorth: number;
  fireResult: FIREResult;
  storageMode: 'cloud' | 'local';
  syncCode: string;
  isAppLoading: boolean;
  isSyncing: boolean;

  // Actions
  updateCashSavings: (twdAmount: number, usdAmount?: number) => void;
  adjustCashSavings: (delta: number, currency?: 'TWD' | 'USD') => void;
  exchangeCurrency: (params: {
    fromCurrency: 'TWD' | 'USD';
    toCurrency: 'TWD' | 'USD';
    fromAmount: number;
    toAmount: number;
    feeTWD?: number;
  }) => void;
  updateFIREConfig: (config: FIREConfig) => void;
  updateAnnualTaxes: (taxes: TaxItem[]) => void;
  toggleTaxPaid: (taxId: string) => void;
  addCustomTaxItem: (tax: Omit<TaxItem, 'id' | 'isPaid'>) => void;
  deleteTaxItem: (taxId: string) => void;
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  updateCategories: (cats: CategoryItem[]) => void;
  updatePortfolioStocks: (stocks: PortfolioStock[], options?: { syncToCloud?: boolean }) => void;
  saveSingleStock: (stock: PortfolioStock) => Promise<{ success: boolean; error?: string }>;
  deleteSingleStock: (stockId: string) => Promise<{ success: boolean; error?: string }>;
  updateQuickPresets: (presets: QuickPreset[]) => void;
  refreshCloudData: (isManual?: boolean) => Promise<boolean>;
  toggleStorageMode: (mode: 'cloud' | 'local') => Promise<void>;
  restoreAllData: () => void;
  clearAllLocalData: (options?: { syncCleanToCloud?: boolean }) => void;
  loadDemoSampleData: () => void;
}

const FIREContext = createContext<FIREContextType | undefined>(undefined);

export const FIREProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageModeState, setStorageModeState] = useState<'cloud' | 'local'>(() => getStorageMode());
  const [syncCodeState, setSyncCodeState] = useState<string>(() => getOrCreateSyncCode());

  // Core Data States
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions());
  const [categories, setCategories] = useState<CategoryItem[]>(() => loadCategories());
  const [quickPresets, setQuickPresets] = useState<QuickPreset[]>(() => loadQuickPresets());
  const [portfolioStocks, setPortfolioStocks] = useState<PortfolioStock[]>(() => {
    const raw = loadPortfolioStocks();
    return raw.map((s) => syncStockCalculations(s));
  });
  const [fireConfig, setFireConfig] = useState<FIREConfig>(() => loadFIREConfig());
  const [usdRate, setUsdRate] = useState<number>(() => {
    try {
      const cfg = loadFIREConfig();
      return cfg?.usdRate || 32.0;
    } catch (e) {
      return 32.0;
    }
  });

  // Prevent refresh storms immediately after user edit & overlapping cloud fetches
  const lastUserEditTimeRef = useRef<number>(0);
  const isCloudFetchingRef = useRef<boolean>(false);

  // 0. Fetch Live Exchange Rate on startup (Once)
  useEffect(() => {
    fetchLiveUsdRate().then((rate) => {
      if (rate && rate > 20 && rate < 50) {
        setUsdRate(rate);
        setFireConfig((prev) => {
          if (prev.usdRate !== rate) {
            const updated = { ...prev, usdRate: rate };
            saveFIREConfigLocalOnly(updated);
            return updated;
          }
          return prev;
        });
      }
    });
  }, []);

  // 1. Calculate Real-Time Stock Market Values (Separated by TW and US)
  const liveTWStockMarketValue = useMemo(() => {
    let sum = 0;
    (portfolioStocks || []).filter((s) => s.market === 'TW').forEach((s) => {
      const synced = syncStockCalculations(s);
      sum += (synced.shares || 0) * (synced.currentPrice || 0);
    });
    return Math.round(sum);
  }, [portfolioStocks]);

  const liveUSStockMarketValue = useMemo(() => {
    let sum = 0;
    (portfolioStocks || []).filter((s) => s.market === 'US').forEach((s) => {
      const synced = syncStockCalculations(s);
      sum += (synced.shares || 0) * (synced.currentPrice || 0);
    });
    return Number(sum.toFixed(2));
  }, [portfolioStocks]);

  const liveStockMarketValue = useMemo(() => {
    const currentRate = usdRate || fireConfig.usdRate || 32.0;
    return Math.round(liveTWStockMarketValue + liveUSStockMarketValue * currentRate);
  }, [liveTWStockMarketValue, liveUSStockMarketValue, usdRate, fireConfig.usdRate]);

  // 2. Dual-Currency Cash Reserves & Total Net Worth
  const cashSavingsTWD = useMemo(() => {
    return fireConfig.cashSavingsTWD ?? (fireConfig.cashSavings ?? (fireConfig.baseCashBalance ?? 0));
  }, [fireConfig.cashSavingsTWD, fireConfig.cashSavings, fireConfig.baseCashBalance]);

  const cashSavingsUSD = useMemo(() => {
    return fireConfig.cashSavingsUSD ?? 0;
  }, [fireConfig.cashSavingsUSD]);

  const totalCashSavingsTWD = useMemo(() => {
    const currentRate = usdRate || fireConfig.usdRate || 32.0;
    return Math.round(cashSavingsTWD + cashSavingsUSD * currentRate);
  }, [cashSavingsTWD, cashSavingsUSD, usdRate, fireConfig.usdRate]);

  const totalNetWorth = useMemo(() => {
    return Math.round(totalCashSavingsTWD + liveStockMarketValue);
  }, [totalCashSavingsTWD, liveStockMarketValue]);

  // 3. Computed FIRE Results
  const fireResult = useMemo(() => {
    return calculateFIRE({
      ...fireConfig,
      cashSavings: totalCashSavingsTWD,
      cashSavingsTWD,
      cashSavingsUSD,
      currentNetWorth: totalNetWorth,
    });
  }, [fireConfig, totalCashSavingsTWD, cashSavingsTWD, cashSavingsUSD, totalNetWorth]);

  // Keep CSS Theme updated
  useEffect(() => {
    applyThemeToCSSVariables(fireConfig.themeColor);
  }, [fireConfig.themeColor]);

  // ================= ANNUAL TAXES SYSTEM ================= //

  const annualTaxes = useMemo(() => {
    return fireConfig.annualTaxes && fireConfig.annualTaxes.length > 0
      ? fireConfig.annualTaxes
      : DEFAULT_ANNUAL_TAXES;
  }, [fireConfig.annualTaxes]);

  const annualTaxTotal = useMemo(() => {
    return annualTaxes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [annualTaxes]);

  const updateAnnualTaxes = useCallback((taxes: TaxItem[]) => {
    lastUserEditTimeRef.current = Date.now();
    const total = taxes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const monthly = Math.round(total / 12);
    setFireConfig((prev) => {
      const updated: FIREConfig = {
        ...prev,
        annualTaxes: taxes,
        monthlyTax: monthly,
      };
      saveFIREConfig(updated);
      return updated;
    });
  }, []);

  const toggleTaxPaid = useCallback((taxId: string) => {
    lastUserEditTimeRef.current = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    const currentTaxes = fireConfig.annualTaxes && fireConfig.annualTaxes.length > 0
      ? fireConfig.annualTaxes
      : DEFAULT_ANNUAL_TAXES;
    const targetTax = currentTaxes.find((t) => t.id === taxId);
    if (!targetTax) return;

    if (!targetTax.isPaid) {
      // 1. Mark as paid, create linked transaction
      const newTxId = `t-tax-${Date.now()}`;
      const newTx: Transaction = {
        id: newTxId,
        type: 'tax',
        amount: targetTax.amount,
        mainCategory: '稅金規費',
        subCategory: targetTax.name,
        date: todayStr,
        note: `${targetTax.name} (年度稅金繳納)`,
      };

      const updatedTaxes = currentTaxes.map((t) =>
        t.id === taxId
          ? { ...t, isPaid: true, paidDate: todayStr, transactionId: newTxId }
          : t
      );

      // Add transaction to state & storage
      setTransactions((prev) => {
        const next = [newTx, ...prev];
        saveTransactions(next);
        return next;
      });

      // Deduct cash savings TWD
      adjustCashSavings(-targetTax.amount, 'TWD');

      // Update fire config
      updateAnnualTaxes(updatedTaxes);
    } else {
      // 2. Mark as unpaid, remove linked transaction
      if (targetTax.transactionId) {
        setTransactions((prev) => {
          const next = prev.filter((t) => t.id !== targetTax.transactionId);
          saveTransactions(next);
          return next;
        });
      }

      // Refund cash savings TWD
      adjustCashSavings(targetTax.amount, 'TWD');

      const updatedTaxes = currentTaxes.map((t) =>
        t.id === taxId
          ? { ...t, isPaid: false, paidDate: undefined, transactionId: undefined }
          : t
      );

      updateAnnualTaxes(updatedTaxes);
    }
  }, [fireConfig.annualTaxes, updateAnnualTaxes, adjustCashSavings]);

  const addCustomTaxItem = useCallback((tax: Omit<TaxItem, 'id' | 'isPaid'>) => {
    lastUserEditTimeRef.current = Date.now();
    const currentTaxes = fireConfig.annualTaxes && fireConfig.annualTaxes.length > 0
      ? fireConfig.annualTaxes
      : DEFAULT_ANNUAL_TAXES;
    const newTaxItem: TaxItem = {
      ...tax,
      id: `tax-custom-${Date.now()}`,
      isPaid: false,
    };
    updateAnnualTaxes([...currentTaxes, newTaxItem]);
  }, [fireConfig.annualTaxes, updateAnnualTaxes]);

  const deleteTaxItem = useCallback((taxId: string) => {
    lastUserEditTimeRef.current = Date.now();
    const currentTaxes = fireConfig.annualTaxes && fireConfig.annualTaxes.length > 0
      ? fireConfig.annualTaxes
      : DEFAULT_ANNUAL_TAXES;
    const targetTax = currentTaxes.find((t) => t.id === taxId);
    if (targetTax && targetTax.isPaid && targetTax.transactionId) {
      setTransactions((prev) => {
        const next = prev.filter((t) => t.id !== targetTax.transactionId);
        saveTransactions(next);
        return next;
      });
      adjustCashSavings(targetTax.amount, 'TWD');
    }
    const updatedTaxes = currentTaxes.filter((t) => t.id !== taxId);
    updateAnnualTaxes(updatedTaxes);
  }, [fireConfig.annualTaxes, updateAnnualTaxes, adjustCashSavings]);

  // ================= MUTATION ACTIONS ================= //

  const updateCashSavings = useCallback((twdAmount: number, usdAmount?: number) => {
    lastUserEditTimeRef.current = Date.now();
    const finalTWD = Math.max(0, Math.round(twdAmount));

    setFireConfig((prev) => {
      const finalUSD = usdAmount !== undefined ? Math.max(0, Number(usdAmount.toFixed(2))) : (prev.cashSavingsUSD ?? 0);
      const totalCashInTWD = Math.round(finalTWD + finalUSD * (prev.usdRate || usdRate));
      const updated: FIREConfig = {
        ...prev,
        cashSavings: finalTWD,
        cashSavingsTWD: finalTWD,
        cashSavingsUSD: finalUSD,
        baseCashBalance: finalTWD,
        currentNetWorth: Math.round(totalCashInTWD + liveStockMarketValue),
      };
      saveFIREConfig(updated);
      return updated;
    });
  }, [liveStockMarketValue, usdRate]);

  const adjustCashSavings = useCallback((delta: number, currency: 'TWD' | 'USD' = 'TWD') => {
    if (!delta || delta === 0) return;
    lastUserEditTimeRef.current = Date.now();

    setFireConfig((prev) => {
      const currentTWD = prev.cashSavingsTWD ?? (prev.cashSavings ?? (prev.baseCashBalance ?? 0));
      const currentUSD = prev.cashSavingsUSD ?? 0;
      let newTWD = currentTWD;
      let newUSD = currentUSD;

      if (currency === 'USD') {
        newUSD = Number((currentUSD + delta).toFixed(2));
      } else {
        newTWD = Math.round(currentTWD + delta);
      }

      const totalCashInTWD = Math.round(newTWD + newUSD * (prev.usdRate || usdRate));
      const updated: FIREConfig = {
        ...prev,
        cashSavings: newTWD,
        cashSavingsTWD: newTWD,
        cashSavingsUSD: newUSD,
        baseCashBalance: newTWD,
        currentNetWorth: Math.round(totalCashInTWD + liveStockMarketValue),
      };
      saveFIREConfig(updated);
      return updated;
    });
  }, [liveStockMarketValue, usdRate]);

  const updateFIREConfig = useCallback((newConfig: FIREConfig) => {
    lastUserEditTimeRef.current = Date.now();
    const finalTWD = newConfig.cashSavingsTWD ?? (newConfig.cashSavings ?? (newConfig.baseCashBalance ?? (fireConfig.cashSavingsTWD ?? 0)));
    const finalUSD = newConfig.cashSavingsUSD ?? (fireConfig.cashSavingsUSD ?? 0);
    const rate = newConfig.usdRate || usdRate;
    const totalCashInTWD = Math.round(finalTWD + finalUSD * rate);

    const updated: FIREConfig = {
      ...newConfig,
      cashSavings: finalTWD,
      cashSavingsTWD: finalTWD,
      cashSavingsUSD: finalUSD,
      usdRate: rate,
      baseCashBalance: finalTWD,
      currentNetWorth: Math.round(totalCashInTWD + liveStockMarketValue),
    };

    if (newConfig.usdRate && newConfig.usdRate !== usdRate) {
      setUsdRate(newConfig.usdRate);
    }

    setFireConfig(updated);
    saveFIREConfig(updated);
  }, [fireConfig.cashSavingsTWD, fireConfig.cashSavingsUSD, liveStockMarketValue, usdRate]);

  const exchangeCurrency = useCallback((params: {
    fromCurrency: 'TWD' | 'USD';
    toCurrency: 'TWD' | 'USD';
    fromAmount: number;
    toAmount: number;
    feeTWD?: number;
  }) => {
    const { fromCurrency, toCurrency, fromAmount, toAmount, feeTWD = 0 } = params;
    lastUserEditTimeRef.current = Date.now();

    setFireConfig((prev) => {
      const currentTWD = prev.cashSavingsTWD ?? (prev.cashSavings ?? (prev.baseCashBalance ?? 0));
      const currentUSD = prev.cashSavingsUSD ?? 0;
      let newTWD = currentTWD;
      let newUSD = currentUSD;

      if (fromCurrency === 'TWD' && toCurrency === 'USD') {
        newTWD = Math.max(0, Math.round(currentTWD - fromAmount - feeTWD));
        newUSD = Number((currentUSD + toAmount).toFixed(2));
      } else if (fromCurrency === 'USD' && toCurrency === 'TWD') {
        newUSD = Math.max(0, Number((currentUSD - fromAmount).toFixed(2)));
        newTWD = Math.max(0, Math.round(currentTWD + toAmount - feeTWD));
      }

      const totalCashInTWD = Math.round(newTWD + newUSD * (prev.usdRate || usdRate));
      const updated: FIREConfig = {
        ...prev,
        cashSavings: newTWD,
        cashSavingsTWD: newTWD,
        cashSavingsUSD: newUSD,
        baseCashBalance: newTWD,
        currentNetWorth: Math.round(totalCashInTWD + liveStockMarketValue),
      };
      saveFIREConfig(updated);
      return updated;
    });
  }, [liveStockMarketValue, usdRate]);

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>) => {
    lastUserEditTimeRef.current = Date.now();
    const newRecord: Transaction = {
      ...t,
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };

    let cashDelta = 0;
    if (t.type === 'income') {
      cashDelta = t.amount;
    } else if (t.type === 'expense' || t.type === 'investment' || t.type === 'tax') {
      cashDelta = -t.amount;
    }

    setTransactions((prev) => {
      const updated = [newRecord, ...prev];
      saveTransactions(updated);
      return updated;
    });

    if (cashDelta !== 0) {
      adjustCashSavings(cashDelta, 'TWD');
    }
  }, [adjustCashSavings]);

  const deleteTransaction = useCallback((id: string) => {
    lastUserEditTimeRef.current = Date.now();
    let cashDelta = 0;

    setTransactions((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target) {
        if (target.type === 'income') {
          cashDelta = -target.amount;
        } else if (target.type === 'expense' || target.type === 'investment' || target.type === 'tax') {
          cashDelta = target.amount;
        }
      }
      const updated = prev.filter((t) => t.id !== id);
      saveTransactions(updated);
      return updated;
    });

    if (cashDelta !== 0) {
      adjustCashSavings(cashDelta, 'TWD');
    }
  }, [adjustCashSavings]);

  const updateCategories = useCallback((cats: CategoryItem[]) => {
    lastUserEditTimeRef.current = Date.now();
    setCategories(cats);
    saveCategories(cats);
  }, []);

  const updatePortfolioStocks = useCallback((stocks: PortfolioStock[], options?: { syncToCloud?: boolean }) => {
    const syncToCloud = options?.syncToCloud ?? true;
    lastUserEditTimeRef.current = Date.now();
    const synced = stocks.map((s) => syncStockCalculations(s));
    setPortfolioStocks(synced);
    savePortfolioStocks(synced);

    if (syncToCloud && storageModeState === 'cloud') {
      const code = syncCodeState || getOrCreateSyncCode();
      synced.forEach((s) => {
        saveStockToCloud(code, s).catch(() => {});
      });
    }
  }, [storageModeState, syncCodeState]);

  const saveSingleStock = useCallback(async (stock: PortfolioStock): Promise<{ success: boolean; error?: string }> => {
    lastUserEditTimeRef.current = Date.now();
    const syncedStock = syncStockCalculations(stock);

    if (storageModeState === 'cloud') {
      const code = syncCodeState || getOrCreateSyncCode();
      const res = await saveStockToCloud(code, syncedStock);
      if (!res.success) {
        return res;
      }
    }

    setPortfolioStocks((prev) => {
      const idx = prev.findIndex((s) => s.id === syncedStock.id || s.symbol.toUpperCase() === syncedStock.symbol.toUpperCase());
      let updated: PortfolioStock[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = syncedStock;
      } else {
        updated = [syncedStock, ...prev];
      }
      savePortfolioStocks(updated);
      return updated;
    });

    return { success: true };
  }, [storageModeState, syncCodeState]);

  const deleteSingleStock = useCallback(async (stockId: string): Promise<{ success: boolean; error?: string }> => {
    lastUserEditTimeRef.current = Date.now();

    if (storageModeState === 'cloud') {
      const code = syncCodeState || getOrCreateSyncCode();
      const res = await deleteStockFromCloud(code, stockId);
      if (!res.success) {
        return res;
      }
    }

    setPortfolioStocks((prev) => {
      const updated = prev.filter((s) => s.id !== stockId);
      savePortfolioStocks(updated);
      return updated;
    });

    return { success: true };
  }, [storageModeState, syncCodeState]);

  const updateQuickPresets = useCallback((presets: QuickPreset[]) => {
    lastUserEditTimeRef.current = Date.now();
    setQuickPresets(presets);
    saveQuickPresets(presets);
  }, []);

  // ================= WIDGET INGESTION & CLOUD FETCHING ================= //

  // Ingest any Android Widget recorded transactions (Consumes from dedicated native queue)
  const ingestPendingWidgetTransactions = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const res = await WidgetBridge.consumePendingWidgetTransactions();
      if (res && res.pending_transactions_json) {
        const parsed = JSON.parse(res.pending_transactions_json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          lastUserEditTimeRef.current = Date.now();
          let cashDelta = 0;
          const validNewItems: Transaction[] = [];

          parsed.forEach((t: any) => {
            if (t && t.id && t.amount > 0) {
              const formatted: Transaction = {
                id: t.id,
                type: t.type || 'expense',
                amount: Number(t.amount),
                mainCategory: t.mainCategory || '飲食',
                subCategory: t.subCategory || '',
                date: t.date || new Date().toISOString().slice(0, 10),
                note: t.note || '來自 Android 桌面小工具 1 秒速記',
                isQuickPreset: true,
                tags: t.tags || ['Widget'],
              };
              validNewItems.push(formatted);

              if (formatted.type === 'income') {
                cashDelta += formatted.amount;
              } else if (formatted.type === 'expense' || formatted.type === 'investment' || formatted.type === 'tax') {
                cashDelta -= formatted.amount;
              }
            }
          });

          if (validNewItems.length > 0) {
            setTransactions((prev) => {
              const existingIds = new Set(prev.map((item) => item.id));
              const deduplicated = validNewItems.filter((item) => !existingIds.has(item.id));
              if (deduplicated.length > 0) {
                const merged = [...deduplicated, ...prev];
                saveTransactions(merged);
                return merged;
              }
              return prev;
            });

            if (cashDelta !== 0) {
              adjustCashSavings(cashDelta, 'TWD');
            }
          }
        }
      }
    } catch (e) {
      // Ignored if not native
    }
  }, [adjustCashSavings]);

  // Pure Read Cloud Fetcher (Never pushes back, guarded by concurrency lock)
  const refreshCloudData = useCallback(async (isManual = false): Promise<boolean> => {
    // Ingest any Android Widget transactions first if on native platform
    if (Capacitor.isNativePlatform()) {
      await ingestPendingWidgetTransactions();
    }

    if (storageModeState === 'local') return false;

    // Prevent concurrent duplicate cloud fetching requests
    if (isCloudFetchingRef.current) return false;

    // Skip background auto-refresh if user edited within last 4.5 seconds
    if (!isManual && Date.now() - lastUserEditTimeRef.current < 4500) {
      return false;
    }

    isCloudFetchingRef.current = true;
    const code = syncCodeState || getOrCreateSyncCode();
    setIsSyncing(true);

    try {
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
          const cashTWD = cCfg.cashSavingsTWD != null 
            ? cCfg.cashSavingsTWD 
            : (cCfg.cashSavings != null 
                ? cCfg.cashSavings 
                : (cCfg.baseCashBalance != null 
                    ? cCfg.baseCashBalance 
                    : 0));
          const cashUSD = cCfg.cashSavingsUSD != null ? cCfg.cashSavingsUSD : 0;
          const rate = cCfg.usdRate != null && cCfg.usdRate > 0 ? cCfg.usdRate : usdRate;

          if (cCfg.usdRate) {
            setUsdRate(cCfg.usdRate);
          }

          const merged: FIREConfig = {
            ...DEFAULT_FIRE_CONFIG,
            ...cCfg,
            cashSavings: cashTWD,
            cashSavingsTWD: cashTWD,
            cashSavingsUSD: cashUSD,
            usdRate: rate,
            baseCashBalance: cashTWD,
          };
          setFireConfig(merged);
          saveFIREConfigLocalOnly(merged);
        }
        if (Array.isArray(cPresets) && cPresets.length > 0) {
          setQuickPresets(cPresets);
          saveQuickPresetsLocalOnly(cPresets);
        }
        if (Array.isArray(cStocks)) {
          if (cStocks.length > 0 || Date.now() - lastUserEditTimeRef.current > 4000) {
            setPortfolioStocks((prevLocal) => {
              // Map all existing local live prices & metadata
              const localPriceMap = new Map<string, { currentPrice: number; previousClose?: number; lastUpdated?: string; sparkline?: number[] }>();
              (prevLocal || []).forEach((ls) => {
                const sym = ls.symbol.toUpperCase();
                const raw = sym.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
                if (ls.currentPrice > 0) {
                  const info = {
                    currentPrice: ls.currentPrice,
                    previousClose: ls.previousClose,
                    lastUpdated: ls.lastUpdated,
                    sparkline: ls.sparkline,
                  };
                  localPriceMap.set(sym, info);
                  localPriceMap.set(raw, info);
                }
              });

              // Merge cloud trade history with local live market prices (NEVER overwrite with cloud stale prices)
              const merged = cStocks.map((cs) => {
                const sym = cs.symbol.toUpperCase();
                const raw = sym.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
                const localInfo = localPriceMap.get(sym) || localPriceMap.get(raw);

                const effectivePrice = (localInfo && localInfo.currentPrice > 0) ? localInfo.currentPrice : (cs.currentPrice || 0);
                const effectivePrevClose = (localInfo && localInfo.previousClose) ? localInfo.previousClose : cs.previousClose;
                const effectiveLastUpdated = (localInfo && localInfo.lastUpdated) ? localInfo.lastUpdated : cs.lastUpdated;
                const effectiveSparkline = (localInfo && localInfo.sparkline) ? localInfo.sparkline : cs.sparkline;

                return syncStockCalculations({
                  ...cs,
                  currentPrice: effectivePrice,
                  previousClose: effectivePrevClose,
                  lastUpdated: effectiveLastUpdated,
                  sparkline: effectiveSparkline,
                });
              });

              savePortfolioStocksLocalOnly(merged);
              return merged;
            });
          }
        }
        return true;
      }
    } catch (e) {
      console.warn('Cloud refresh error:', e);
    } finally {
      isCloudFetchingRef.current = false;
      setIsSyncing(false);
    }
    return false;
  }, [storageModeState, syncCodeState, usdRate, ingestPendingWidgetTransactions]);

  const restoreAllData = useCallback(() => {
    const tx = loadTransactions();
    const cat = loadCategories();
    const presets = loadQuickPresets();
    const loadedStocks = loadPortfolioStocks();
    const cfg = loadFIREConfig();

    setTransactions(tx);
    setCategories(cat);
    setQuickPresets(presets);
    setPortfolioStocks((prevLocal) => {
      const localPriceMap = new Map<string, { currentPrice: number; previousClose?: number; lastUpdated?: string; sparkline?: number[] }>();
      (prevLocal || []).forEach((ls) => {
        const sym = ls.symbol.toUpperCase();
        const raw = sym.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
        if (ls.currentPrice > 0) {
          const info = {
            currentPrice: ls.currentPrice,
            previousClose: ls.previousClose,
            lastUpdated: ls.lastUpdated,
            sparkline: ls.sparkline,
          };
          localPriceMap.set(sym, info);
          localPriceMap.set(raw, info);
        }
      });

      return loadedStocks.map((s) => {
        const sym = s.symbol.toUpperCase();
        const raw = sym.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
        const localInfo = localPriceMap.get(sym) || localPriceMap.get(raw);
        return syncStockCalculations({
          ...s,
          currentPrice: (localInfo && localInfo.currentPrice > 0) ? localInfo.currentPrice : (s.currentPrice || 0),
          previousClose: (localInfo && localInfo.previousClose) ? localInfo.previousClose : s.previousClose,
          lastUpdated: (localInfo && localInfo.lastUpdated) ? localInfo.lastUpdated : s.lastUpdated,
          sparkline: (localInfo && localInfo.sparkline) ? localInfo.sparkline : s.sparkline,
        });
      });
    });
    setFireConfig(cfg);
    if (cfg.usdRate) {
      setUsdRate(cfg.usdRate);
    }
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

  // ================= LIFECYCLE & BACKGROUND LISTENERS ================= //

  // Initial App Load (Runs strictly once on mount)
  useEffect(() => {
    let isMounted = true;

    const initApp = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await ingestPendingWidgetTransactions();
        }
      } catch (e) {}

      try {
        const mode = getStorageMode();
        if (mode === 'cloud') {
          await refreshCloudData(true);
        }
      } catch (e) {}

      setTimeout(() => {
        if (isMounted) {
          setIsAppLoading(false);
        }
      }, 250);
    };

    initApp();

    const fallbackTimer = setTimeout(() => {
      if (isMounted) {
        setIsAppLoading(false);
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
    };
  }, [ingestPendingWidgetTransactions, refreshCloudData]);

  // Background Realtime & Sync Listeners
  useEffect(() => {
    // Subscribe to Realtime WebSocket / Broadcast Channel
    const unsubscribe = subscribeToRealtimeSync(syncCodeState, () => {
      // Received remote change broadcast -> execute Pure Read refresh (skip if this device recently edited)
      if (Date.now() - lastUserEditTimeRef.current >= 4000) {
        refreshCloudData(true);
      }
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
      if (Capacitor.isNativePlatform()) {
        ingestPendingWidgetTransactions();
      }
      if (storageModeState === 'cloud') {
        refreshCloudData(false);
      }
    };
    window.addEventListener('focus', handleFocus);

    // Capacitor App State listener (handles mobile background -> foreground resume)
    let appStateHandle: any = null;
    if (Capacitor.isNativePlatform()) {
      try {
        CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            ingestPendingWidgetTransactions();
            if (storageModeState === 'cloud') {
              refreshCloudData(false);
            }
          }
        }).then((handle) => {
          appStateHandle = handle;
        }).catch(() => {});
      } catch (e) {}
    }

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
      if (appStateHandle && typeof appStateHandle.remove === 'function') {
        appStateHandle.remove();
      }
      clearInterval(interval);
    };
  }, [storageModeState, syncCodeState, refreshCloudData, restoreAllData, ingestPendingWidgetTransactions]);

  const clearAllLocalData = useCallback((options?: { syncCleanToCloud?: boolean }) => {
    lastUserEditTimeRef.current = Date.now();
    const emptyTx: Transaction[] = [];
    const emptyStocks: PortfolioStock[] = [];
    const emptyPresets: QuickPreset[] = [];
    const zeroConfig: FIREConfig = {
      ...DEFAULT_FIRE_CONFIG,
      currentNetWorth: 0,
      baseCashBalance: 0,
      cashSavings: 0,
      cashSavingsTWD: 0,
      cashSavingsUSD: 0,
      usdRate: usdRate,
    };

    setTransactions(emptyTx);
    setPortfolioStocks(emptyStocks);
    setQuickPresets(emptyPresets);
    setFireConfig(zeroConfig);

    saveTransactionsLocalOnly(emptyTx);
    savePortfolioStocksLocalOnly(emptyStocks);
    saveQuickPresetsLocalOnly(emptyPresets);
    saveFIREConfigLocalOnly(zeroConfig);

    if (options?.syncCleanToCloud) {
      autoSyncToCloud(true);
    }
  }, [usdRate]);

  const loadDemoSampleData = useCallback(() => {
    lastUserEditTimeRef.current = Date.now();
    setTransactions(INITIAL_TRANSACTIONS);
    setCategories(DEFAULT_CATEGORIES);
    setQuickPresets(DEFAULT_QUICK_PRESETS);
    setPortfolioStocks(DEFAULT_PORTFOLIO_STOCKS.map((s) => syncStockCalculations(s)));
    setFireConfig(DEFAULT_FIRE_CONFIG);

    saveTransactions(INITIAL_TRANSACTIONS);
    saveCategories(DEFAULT_CATEGORIES);
    saveQuickPresets(DEFAULT_QUICK_PRESETS);
    savePortfolioStocks(DEFAULT_PORTFOLIO_STOCKS);
    saveFIREConfig(DEFAULT_FIRE_CONFIG);
  }, []);

  const value = useMemo(() => ({
    transactions,
    categories,
    quickPresets,
    portfolioStocks,
    fireConfig,
    annualTaxes,
    annualTaxTotal,
    usdRate,
    cashSavingsTWD,
    cashSavingsUSD,
    liveTWStockMarketValue,
    liveUSStockMarketValue,
    liveStockMarketValue,
    totalNetWorth,
    fireResult,
    storageMode: storageModeState,
    syncCode: syncCodeState,
    isAppLoading,
    isSyncing,
    updateCashSavings,
    adjustCashSavings,
    exchangeCurrency,
    updateFIREConfig,
    updateAnnualTaxes,
    toggleTaxPaid,
    addCustomTaxItem,
    deleteTaxItem,
    addTransaction,
    deleteTransaction,
    updateCategories,
    updatePortfolioStocks,
    saveSingleStock,
    deleteSingleStock,
    updateQuickPresets,
    refreshCloudData,
    toggleStorageMode,
    restoreAllData,
    clearAllLocalData,
    loadDemoSampleData,
  }), [
    transactions,
    categories,
    quickPresets,
    portfolioStocks,
    fireConfig,
    annualTaxes,
    annualTaxTotal,
    usdRate,
    cashSavingsTWD,
    cashSavingsUSD,
    liveTWStockMarketValue,
    liveUSStockMarketValue,
    liveStockMarketValue,
    totalNetWorth,
    fireResult,
    storageModeState,
    syncCodeState,
    isAppLoading,
    isSyncing,
    updateCashSavings,
    adjustCashSavings,
    exchangeCurrency,
    updateFIREConfig,
    updateAnnualTaxes,
    toggleTaxPaid,
    addCustomTaxItem,
    deleteTaxItem,
    addTransaction,
    deleteTransaction,
    updateCategories,
    updatePortfolioStocks,
    saveSingleStock,
    deleteSingleStock,
    updateQuickPresets,
    refreshCloudData,
    toggleStorageMode,
    restoreAllData,
    clearAllLocalData,
    loadDemoSampleData,
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
