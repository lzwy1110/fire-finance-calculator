import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Flame,
  X,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  Search,
  History,
  Calendar,
  DollarSign,
  PlusCircle,
  AlertTriangle,
  ArrowRightLeft,
  LayoutGrid,
  List,
  ArrowUpDown,
  PieChart,
  Check,
  ChevronDown,
  Settings,
  Scissors,
  Gift,
  BarChart3,
  MoreHorizontal,
} from 'lucide-react';
import { FIREConfig, MarketType, PortfolioStock, StockTransaction, StockSplitEvent, StockDividendEvent, StockRightEvent } from '../types';
import { getThemePreset } from '../utils/theme';
import { ConfirmModal } from './ConfirmModal';
import { useFIRE } from '../context/FIREContext';
import { StockChartModal } from './StockChartModal';
import { StockSplitModal } from './StockSplitModal';
import { StockDividendModal } from './StockDividendModal';
import { StockRightModal } from './StockRightModal';
import { DividendCalendarView } from './DividendCalendarView';
import { StockTradeModal, StockTradeFormData } from './portfolio/StockTradeModal';
import { StockHistoryModal } from './portfolio/StockHistoryModal';
import { StockFeeSettingsModal } from './portfolio/StockFeeSettingsModal';
import { StockActionSheetModal } from './portfolio/StockActionSheetModal';
import { InsufficientCashModal } from './portfolio/InsufficientCashModal';
import { StockCapitalReductionModal } from './portfolio/StockCapitalReductionModal';
import {
  batchFetchStockQuotes,
  fetchSingleStockQuote,
  searchStockSuggestionsAsync,
  fetchStockSplits,
  fetchStockDividends,
  fetchStockRights,
  StockSearchResult,
} from '../services/stockPriceService';
import {
  calculateStockMetrics,
  syncStockCalculations,
  validateTradeTimeline,
  validateTradeDeletionOrEdit,
} from '../utils/portfolioMath';

interface PortfolioViewProps {
  stocks: PortfolioStock[];
  fireConfig: FIREConfig;
  cashSavingsTWD?: number;
  cashSavingsUSD?: number;
  usdRate?: number;
  onUpdateStocks: (newStocks: PortfolioStock[], options?: { syncToCloud?: boolean }) => void;
  onUpdateLiveQuotes?: (quotesMap: Record<string, { currentPrice: number; name?: string; previousClose?: number; sparkline?: number[] }>) => void;
  onSaveSingleStock?: (stock: PortfolioStock) => Promise<{ success: boolean; error?: string }>;
  onDeleteSingleStock?: (stockId: string) => Promise<{ success: boolean; error?: string }>;
  onSyncNetWorthToFIRE: (totalMarketValueTWD: number) => void;
  onAdjustCashSavings?: (delta: number, currency?: 'TWD' | 'USD') => void;
  onOpenCurrencyExchange?: () => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  stocks,
  fireConfig,
  cashSavingsTWD,
  cashSavingsUSD,
  usdRate: propUsdRate,
  onUpdateStocks,
  onUpdateLiveQuotes,
  onSaveSingleStock,
  onDeleteSingleStock,
  onSyncNetWorthToFIRE,
  onAdjustCashSavings,
  onOpenCurrencyExchange,
}) => {
  const currentTheme = getThemePreset(fireConfig.themeColor);
  const [portfolioSubTab, setPortfolioSubTab] = useState<'holdings' | 'dividend_calendar'>('holdings');
  const [filterMarket, setFilterMarket] = useState<'ALL' | 'US' | 'TW'>('ALL');
  const usdRate = propUsdRate || fireConfig.usdRate || 32.0;
  const currentTWD = cashSavingsTWD ?? (fireConfig.cashSavingsTWD ?? (fireConfig.cashSavings ?? 0));
  const currentUSD = cashSavingsUSD ?? (fireConfig.cashSavingsUSD ?? 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [liveSyncState, setLiveSyncState] = useState<'ok' | 'warning' | 'error'>('ok');
  const [lastSuccessfulSyncTime, setLastSuccessfulSyncTime] = useState<number>(Date.now());
  const consecutiveFailuresRef = useRef<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const lastUserTradeTimeRef = useRef<number>(0);

  // Add / Record Transaction Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTradeStock, setEditingTradeStock] = useState<PortfolioStock | null>(null);
  const [editingTradeTx, setEditingTradeTx] = useState<StockTransaction | null>(null);
  const { updateFIREConfig } = useFIRE();

  // Global Fee Settings Modal State
  const [isFeeSettingsModalOpen, setIsFeeSettingsModalOpen] = useState(false);

  // Transaction History Modal State
  const [activeHistoryStock, setActiveHistoryStock] = useState<PortfolioStock | null>(null);

  // Stock Chart & K-Line Modal State
  const [activeChartStock, setActiveChartStock] = useState<PortfolioStock | null>(null);

  // Stock Split Modal State
  const [activeSplitModal, setActiveSplitModal] = useState<{
    stock: PortfolioStock;
    splitEvent: StockSplitEvent | null;
  } | null>(null);
  const [detectedSplitsMap, setDetectedSplitsMap] = useState<Record<string, StockSplitEvent>>({});

  // Stock Cash Dividend Modal State
  const [activeDividendModal, setActiveDividendModal] = useState<{
    stock: PortfolioStock;
    dividendEvent: StockDividendEvent | null;
  } | null>(null);
  const [detectedDividendsMap, setDetectedDividendsMap] = useState<Record<string, StockDividendEvent>>({});

  // Stock Right (Stock Dividend / 配股) Modal State
  const [activeRightModal, setActiveRightModal] = useState<{
    stock: PortfolioStock;
    rightEvent: StockRightEvent | null;
  } | null>(null);
  const [detectedRightsMap, setDetectedRightsMap] = useState<Record<string, StockRightEvent>>({});

  // Stock Capital Reduction (現金減資) Modal State
  const [activeReductionStock, setActiveReductionStock] = useState<PortfolioStock | null>(null);

  // Quick Action Sheet Modal for Compact List
  const [activeActionStock, setActiveActionStock] = useState<PortfolioStock | null>(null);

  // Insufficient Cash Warning Dialog State
  const [cashAlertModal, setCashAlertModal] = useState<{
    isOpen: boolean;
    stockName: string;
    isUS: boolean;
    tradeCost: number;
    currentCash: number;
    shortage: number;
    onConfirmInitialHoldings: () => void;
    onConfirmForceDeduct: () => void;
  } | null>(null);

  // Quick Stock Search & Trend Chart Explorer State
  const [chartSearchQuery, setChartSearchQuery] = useState('');
  const [chartSearchResults, setChartSearchResults] = useState<StockSearchResult[]>([]);
  const [isChartSearching, setIsChartSearching] = useState(false);
  const [showChartSearchResults, setShowChartSearchResults] = useState(false);
  const chartSearchSeqRef = useRef<number>(0);
  const chartSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sym = fireConfig.currencySymbol || 'NT$';
  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(Math.round(num));
  const formatDec = (num: number) =>
    num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatUpdateTime = (isoStr?: string) => {
    if (!isoStr) return null;
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return null;
      const now = new Date();
      const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${mins}`;

      if (isToday) {
        return `🟢 今日 ${timeStr}`;
      }
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `📅 ${month}/${day} ${timeStr}`;
    } catch (e) {
      return null;
    }
  };

  // Ensure all stock items are synced with proper calculations
  const syncedStocks = stocks.map((s) => syncStockCalculations(s));

  const latestStockUpdate = syncedStocks
    .map((s) => s.lastUpdated)
    .filter((t): t is string => Boolean(t))
    .sort()
    .reverse()[0];

  const filteredStocks = syncedStocks.filter((s) => {
    if (filterMarket === 'US') return s.market === 'US';
    if (filterMarket === 'TW') return s.market === 'TW';
    return true;
  });

  // View Layout & Sorting State
  const [viewLayout, setViewLayout] = useState<'cards' | 'list'>('cards');
  const [sortBy, setSortBy] = useState<'value_desc' | 'roi_desc' | 'roi_asc' | 'today_desc' | 'symbol_asc'>('value_desc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [showAllocationBar, setShowAllocationBar] = useState(true);

  // Aggregate Portfolio Totals & Today's PnL
  let totalCostTWD = 0;
  let totalMarketValueTWD = 0;
  let usMarketValueUSD = 0;
  let twMarketValueTWD = 0;
  let totalRealizedPnLTWD = 0;
  let totalTodayChangeTWD = 0;

  syncedStocks.forEach((s) => {
    const cost = s.shares * s.avgCost;
    const value = s.shares * s.currentPrice;
    const realized = s.realizedPnL || 0;

    let todayStockChange = 0;
    if (s.shares > 0 && s.currentPrice > 0 && s.previousClose && s.previousClose > 0) {
      todayStockChange = (s.currentPrice - s.previousClose) * s.shares;
    }

    if (s.market === 'US') {
      totalCostTWD += cost * usdRate;
      totalMarketValueTWD += value * usdRate;
      usMarketValueUSD += value;
      totalRealizedPnLTWD += realized * usdRate;
      totalTodayChangeTWD += todayStockChange * usdRate;
    } else {
      totalCostTWD += cost;
      totalMarketValueTWD += value;
      twMarketValueTWD += value;
      totalRealizedPnLTWD += realized;
      totalTodayChangeTWD += todayStockChange;
    }
  });

  const totalUnrealizedProfitTWD = totalMarketValueTWD - totalCostTWD;
  const totalRoiPercent = totalCostTWD > 0 ? (totalUnrealizedProfitTWD / totalCostTWD) * 100 : 0;
  const totalTodayRoiPercent =
    totalMarketValueTWD > 0 && totalMarketValueTWD - totalTodayChangeTWD > 0
      ? (totalTodayChangeTWD / (totalMarketValueTWD - totalTodayChangeTWD)) * 100
      : 0;

  // Asset Allocation Calculations (100% full-width guaranteed)
  const currentCashTWDVal = Math.max(0, currentTWD + currentUSD * usdRate);

  const allocationPalette = [
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#3b82f6', // Blue
    '#f97316', // Orange
    '#14b8a6', // Teal
  ];

  // All stocks with positive market value across the entire portfolio
  const allStockAllocations = syncedStocks
    .map((s) => {
      const valTWD = s.market === 'US' ? s.shares * s.currentPrice * usdRate : s.shares * s.currentPrice;
      return {
        id: s.id,
        symbol: s.symbol,
        name: s.name,
        market: s.market,
        valTWD: Math.max(0, valTWD),
      };
    })
    .filter((it) => it.valTWD > 0)
    .sort((a, b) => b.valTWD - a.valTWD);

  const totalAllocatedValue =
    allStockAllocations.reduce((acc, it) => acc + it.valTWD, 0) + currentCashTWDVal;

  const allocationSegments = allStockAllocations.map((st, idx) => ({
    ...st,
    pct: totalAllocatedValue > 0 ? (st.valTWD / totalAllocatedValue) * 100 : 0,
    color: allocationPalette[idx % allocationPalette.length],
  }));

  const cashPct =
    totalAllocatedValue > 0 && currentCashTWDVal > 0 ? (currentCashTWDVal / totalAllocatedValue) * 100 : 0;

  const sortedStocks = [...filteredStocks].sort((a, b) => {
    const valA = a.market === 'US' ? a.shares * a.currentPrice * usdRate : a.shares * a.currentPrice;
    const valB = b.market === 'US' ? b.shares * b.currentPrice * usdRate : b.shares * b.currentPrice;
    const metricsA = calculateStockMetrics(a.transactions, a.currentPrice);
    const metricsB = calculateStockMetrics(b.transactions, b.currentPrice);

    if (sortBy === 'value_desc') return valB - valA;
    if (sortBy === 'roi_desc') return metricsB.unrealizedRoiPercent - metricsA.unrealizedRoiPercent;
    if (sortBy === 'roi_asc') return metricsA.unrealizedRoiPercent - metricsB.unrealizedRoiPercent;
    if (sortBy === 'today_desc') {
      const changePctA =
        a.previousClose && a.previousClose > 0 ? ((a.currentPrice - a.previousClose) / a.previousClose) * 100 : -999;
      const changePctB =
        b.previousClose && b.previousClose > 0 ? ((b.currentPrice - b.previousClose) / b.previousClose) * 100 : -999;
      return changePctB - changePctA;
    }
    if (sortBy === 'symbol_asc') return a.symbol.localeCompare(b.symbol);
    return 0;
  });

  // Human readable last sync time
  const formatLastSync = () => {
    if (!lastSuccessfulSyncTime) return '剛剛';
    const diffSec = Math.floor((Date.now() - lastSuccessfulSyncTime) / 1000);
    if (diffSec < 10) return '剛剛';
    if (diffSec < 60) return `${diffSec}秒前`;
    const d = new Date(lastSuccessfulSyncTime);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Batch Refresh All Stock Quotes from Online Endpoints (Zero Supabase Writes by default)
  const isRefreshingRef = useRef<boolean>(false);
  const handleRefreshQuotes = async (silent: boolean = false, syncToCloud: boolean = false) => {
    if (syncedStocks.length === 0 || isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    if (!silent) {
      setRefreshStatus('⚡ 正在連線交易所與行情中心同步最新股價...');
    }

    try {
      const stockList = syncedStocks.map((s) => ({ symbol: s.symbol, market: s.market }));
      const quotesMap = await batchFetchStockQuotes(stockList);

      let updatedCount = 0;
      const nowIso = new Date().toISOString();
      const updatedStocks = syncedStocks.map((s) => {
        const symUpper = s.symbol.toUpperCase();
        const rawCode = symUpper.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
        const quote = quotesMap[symUpper] || quotesMap[`${rawCode}.TW`] || quotesMap[rawCode] || quotesMap[`${rawCode}.TWO`];

        if (quote && quote.currentPrice > 0) {
          updatedCount++;
          const updatedStock = {
            ...s,
            currentPrice: quote.currentPrice,
            name: quote.name || s.name,
            previousClose: quote.previousClose || s.previousClose,
            sparkline: quote.sparkline || s.sparkline,
            lastUpdated: nowIso,
          };
          return syncStockCalculations(updatedStock);
        }
        return s;
      });

      if (updatedCount > 0) {
        if (onUpdateLiveQuotes) {
          onUpdateLiveQuotes(quotesMap);
        } else {
          onUpdateStocks(updatedStocks, { syncToCloud: false });
        }
        consecutiveFailuresRef.current = 0;
        setLiveSyncState('ok');
        setLastSuccessfulSyncTime(Date.now());
        if (!silent) {
          setRefreshStatus(`✅ 已成功更新 ${updatedCount} 檔最新線上行情報價！`);
        }
      } else {
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 3 || Date.now() - lastSuccessfulSyncTime > 30000) {
          setLiveSyncState('error');
        } else {
          setLiveSyncState('warning');
        }
        if (!silent) {
          setRefreshStatus('⚠️ 數據源連線繁忙，現有持股價格已完好保留。');
        }
      }
    } catch (e) {
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 3 || Date.now() - lastSuccessfulSyncTime > 30000) {
        setLiveSyncState('error');
      } else {
        setLiveSyncState('warning');
      }
      if (!silent) {
        setRefreshStatus('⚠️ 線上服務連線失敗，現有資料已保留。');
      }
    } finally {
      isRefreshingRef.current = false;
      setTimeout(() => {
        setIsRefreshing(false);
        if (!silent) {
          setRefreshStatus(null);
        }
      }, 1500);
    }
  };

  // 5-second Smart Foreground Heartbeat Polling (Zero Supabase writes, pauses on background/tab-switch)
  useEffect(() => {
    if (syncedStocks.length === 0) return;

    let timer: any = null;

    const doPoll = () => {
      // Pause polling if user recently edited/traded within 6 seconds
      if (Date.now() - lastUserTradeTimeRef.current < 6000) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !isRefreshingRef.current) {
        handleRefreshQuotes(true, false);
      }
    };

    // Initial immediate silent poll on mount
    doPoll();

    // Start 5-second cadence
    timer = setInterval(doPoll, 5000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        doPoll();
        if (!timer) timer = setInterval(doPoll, 5000);
      } else {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncedStocks.length]);

  // Check for upcoming or unapplied stock splits, dividends & rights (配股) across held stocks
  const splitApiCacheRef = useRef<Record<string, StockSplitEvent[]>>({});
  const dividendApiCacheRef = useRef<Record<string, StockDividendEvent[]>>({});
  const rightApiCacheRef = useRef<Record<string, StockRightEvent[]>>({});
  useEffect(() => {
    if (syncedStocks.length === 0) return;

    const checkAllCorporateActions = async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const newSplitsMap: Record<string, StockSplitEvent> = {};
      const newDivsMap: Record<string, StockDividendEvent> = {};
      const newRightsMap: Record<string, StockRightEvent> = {};

      await Promise.all(
        syncedStocks.map(async (stock) => {
          if (!stock.symbol || (stock.shares || 0) <= 0) return;

          // Parallel query for Splits, Dividends, and Rights for this stock
          const [splitsResult, divsResult, rightsResult] = await Promise.allSettled([
            (async () => {
              let splits = splitApiCacheRef.current[stock.symbol];
              if (!splits) {
                splits = await fetchStockSplits(stock.symbol);
                splitApiCacheRef.current[stock.symbol] = splits;
              }
              return splits;
            })(),
            (async () => {
              let divs = dividendApiCacheRef.current[stock.symbol];
              if (!divs) {
                divs = await fetchStockDividends(stock.symbol);
                dividendApiCacheRef.current[stock.symbol] = divs;
              }
              return divs;
            })(),
            (async () => {
              let rights = rightApiCacheRef.current[stock.symbol];
              if (!rights) {
                rights = await fetchStockRights(stock.symbol);
                rightApiCacheRef.current[stock.symbol] = rights;
              }
              return rights;
            })(),
          ]);

          // Process Splits
          if (splitsResult.status === 'fulfilled' && Array.isArray(splitsResult.value)) {
            const splits = splitsResult.value;
            for (const sp of splits) {
              const isUpcoming = sp.date > todayStr;
              const alreadyApplied = (stock.transactions || []).some(
                (t) =>
                  t.type === 'SPLIT' &&
                  (t.date === sp.date || Math.abs((t.splitRatio || 1) - sp.ratio) < 0.001)
              );

              if (alreadyApplied) continue;

              if (!isUpcoming) {
                const txsOnOrBeforeSplit = (stock.transactions || []).filter((t) => t.date <= sp.date);
                const metricsAtSplit = calculateStockMetrics(txsOnOrBeforeSplit, 0);
                if (metricsAtSplit.shares <= 0) continue;
              }

              newSplitsMap[stock.id] = {
                ...sp,
                status: isUpcoming ? 'upcoming' : 'effective_pending',
              };
              break;
            }
          }

          // Process Dividends
          if (divsResult.status === 'fulfilled' && Array.isArray(divsResult.value)) {
            const divs = divsResult.value;
            for (const d of divs) {
              const isUpcoming = d.date > todayStr;
              const alreadyApplied = (stock.transactions || []).some(
                (t) => t.type === 'DIVIDEND' && t.date === d.date
              );

              if (alreadyApplied) continue;

              // Timeline Defense:
              // For historical dividends, user MUST have held shares on or before ex-dividend date!
              if (!isUpcoming) {
                const txsOnOrBeforeDiv = (stock.transactions || []).filter((t) => t.date <= d.date);
                const metricsAtDiv = calculateStockMetrics(txsOnOrBeforeDiv, 0);
                if (metricsAtDiv.shares <= 0) continue;
              }

              newDivsMap[stock.id] = {
                ...d,
                status: isUpcoming ? 'upcoming' : 'effective_pending',
              };
              break;
            }
          }

          // Process Rights (Stock Dividend / 配股)
          if (rightsResult.status === 'fulfilled' && Array.isArray(rightsResult.value)) {
            const rights = rightsResult.value;
            for (const r of rights) {
              const isUpcoming = r.date > todayStr;
              const alreadyApplied = (stock.transactions || []).some(
                (t) => t.type === 'STOCK_DIVIDEND' && t.date === r.date
              );

              if (alreadyApplied) continue;

              // Timeline Defense:
              if (!isUpcoming) {
                const txsOnOrBeforeRight = (stock.transactions || []).filter((t) => t.date <= r.date);
                const metricsAtRight = calculateStockMetrics(txsOnOrBeforeRight, 0);
                if (metricsAtRight.shares <= 0) continue;
              }

              newRightsMap[stock.id] = {
                ...r,
                status: isUpcoming ? 'upcoming' : 'effective_pending',
              };
              break;
            }
          }
        })
      );

      setDetectedSplitsMap(newSplitsMap);
      setDetectedDividendsMap(newDivsMap);
      setDetectedRightsMap(newRightsMap);
    };

    const timer = setTimeout(checkAllCorporateActions, 100);
    return () => clearTimeout(timer);
  }, [syncedStocks]);

  // Handle Confirmed Stock Split Execution
  const handleConfirmSplit = async (
    targetStock: PortfolioStock,
    splitData: {
      ratio: number;
      numerator: number;
      denominator: number;
      date: string;
      notes?: string;
    }
  ) => {
    const newTx: StockTransaction = {
      id: `split-${targetStock.symbol}-${Date.now()}`,
      stockId: targetStock.id,
      type: 'SPLIT',
      shares: 0,
      price: 0,
      date: splitData.date,
      splitRatio: splitData.ratio,
      splitNumerator: splitData.numerator,
      splitDenominator: splitData.denominator,
      note: splitData.notes || `${targetStock.symbol} ${splitData.ratio}x 股票分割`,
    };

    const existingTxs = targetStock.transactions || [];
    const updatedTxs = [...existingTxs, newTx];

    const updatedStock = syncStockCalculations({
      ...targetStock,
      transactions: updatedTxs,
      lastUpdated: new Date().toISOString(),
    });

    const updatedList = syncedStocks.map((s) => (s.id === targetStock.id ? updatedStock : s));
    onUpdateStocks(updatedList);

    setDetectedSplitsMap((prev) => {
      const copy = { ...prev };
      delete copy[targetStock.id];
      return copy;
    });

    setActiveSplitModal(null);
    setRefreshStatus(`✅ 已成功套用 ${targetStock.symbol} 股票分割！持股已校正為 ${updatedStock.shares} 股`);
    setTimeout(() => setRefreshStatus(null), 3000);
  };

  // Handle Confirmed Stock Cash Dividend Payout Execution
  const handleConfirmDividend = async (
    targetStock: PortfolioStock,
    divData: {
      amountPerShare: number;
      eligibleShares: number;
      totalGross: number;
      taxWithheld: number;
      netCash: number;
      exDate: string;
      paymentDate: string;
      notes?: string;
    }
  ) => {
    const newTx: StockTransaction = {
      id: `div-${targetStock.symbol}-${Date.now()}`,
      stockId: targetStock.id,
      type: 'DIVIDEND',
      shares: divData.eligibleShares,
      price: divData.amountPerShare,
      date: divData.paymentDate,
      dividendPerShare: divData.amountPerShare,
      dividendTotalCash: divData.netCash,
      taxWithheld: divData.taxWithheld,
      note: divData.notes || `${targetStock.symbol} 現金股利每股 $${divData.amountPerShare}`,
    };

    const existingTxs = targetStock.transactions || [];
    const updatedTxs = [...existingTxs, newTx];

    const updatedStock = syncStockCalculations({
      ...targetStock,
      transactions: updatedTxs,
      lastUpdated: new Date().toISOString(),
    });

    const updatedList = syncedStocks.map((s) => (s.id === targetStock.id ? updatedStock : s));
    onUpdateStocks(updatedList);

    // Credit cash balance into user's savings account!
    if (onAdjustCashSavings && divData.netCash > 0) {
      onAdjustCashSavings(+divData.netCash, targetStock.market === 'US' ? 'USD' : 'TWD');
    }

    setDetectedDividendsMap((prev) => {
      const copy = { ...prev };
      delete copy[targetStock.id];
      return copy;
    });

    setActiveDividendModal(null);
    const currSym = targetStock.currency === 'USD' ? '$' : 'NT$';
    setRefreshStatus(`✅ 已成功入帳 ${targetStock.symbol} 現金股利 +${currSym}${formatNum(divData.netCash)}！`);
    setTimeout(() => setRefreshStatus(null), 3500);
  };

  // Handle Confirmed Stock Right (Stock Dividend / 配股) Execution
  const handleConfirmRight = async (
    targetStock: PortfolioStock,
    rightData: {
      stockDividendRatio: number;
      stockDividendPerShare: number;
      bonusShares: number;
      exDate: string;
      notes?: string;
    }
  ) => {
    const newTx: StockTransaction = {
      id: `right-${targetStock.symbol}-${Date.now()}`,
      stockId: targetStock.id,
      type: 'STOCK_DIVIDEND',
      shares: rightData.bonusShares,
      price: 0,
      date: rightData.exDate,
      stockDividendPerShare: rightData.stockDividendPerShare,
      stockDividendRatio: rightData.stockDividendRatio,
      note: rightData.notes || `${targetStock.symbol} 股票股利除權配發 (+${rightData.bonusShares}股)`,
    };

    const existingTxs = targetStock.transactions || [];
    const updatedTxs = [...existingTxs, newTx];

    const updatedStock = syncStockCalculations({
      ...targetStock,
      transactions: updatedTxs,
      lastUpdated: new Date().toISOString(),
    });

    const updatedList = syncedStocks.map((s) => (s.id === targetStock.id ? updatedStock : s));
    onUpdateStocks(updatedList);

    setDetectedRightsMap((prev) => {
      const copy = { ...prev };
      delete copy[targetStock.id];
      return copy;
    });

    setActiveRightModal(null);
    setRefreshStatus(`✅ 已成功入帳 ${targetStock.symbol} 股票股利！持股已增加 +${rightData.bonusShares} 股（均價已自動除權）`);
    setTimeout(() => setRefreshStatus(null), 3500);
  };

  // Handle Confirmed Stock Capital Reduction (現金減資) Execution
  const handleConfirmReduction = async (
    targetStock: PortfolioStock,
    reductionData: {
      date: string;
      reductionRatio: number;
      cashRefundPerShare: number;
      cashRefundTotal: number;
      reducedShares: number;
      newShares: number;
      newAvgCost: number;
      note?: string;
    }
  ) => {
    const newTx: StockTransaction = {
      id: `reduction-${targetStock.symbol}-${Date.now()}`,
      stockId: targetStock.id,
      type: 'CAPITAL_REDUCTION',
      shares: reductionData.newShares,
      price: reductionData.newAvgCost,
      date: reductionData.date,
      capitalReductionRatio: reductionData.reductionRatio,
      capitalReductionCashPerShare: reductionData.cashRefundPerShare,
      capitalReductionCashTotal: reductionData.cashRefundTotal,
      note: reductionData.note || `${targetStock.symbol} 現金減資退還股款 (退還 $${reductionData.cashRefundTotal})`,
    };

    const existingTxs = targetStock.transactions || [];
    const updatedTxs = [...existingTxs, newTx];

    const updatedStock = syncStockCalculations({
      ...targetStock,
      transactions: updatedTxs,
      lastUpdated: new Date().toISOString(),
    });

    if (onSaveSingleStock) {
      await onSaveSingleStock(updatedStock);
    } else {
      const updatedList = syncedStocks.map((s) => (s.id === targetStock.id ? updatedStock : s));
      onUpdateStocks(updatedList);
    }

    // Automatically deposit cash refund to user's cash reserves
    if (reductionData.cashRefundTotal > 0 && onAdjustCashSavings) {
      onAdjustCashSavings(+reductionData.cashRefundTotal, targetStock.currency === 'USD' ? 'USD' : 'TWD');
    }

    setActiveReductionStock(null);
    setRefreshStatus(
      `✅ 已成功執行 ${targetStock.symbol} 現金減資！退還現金 +${targetStock.currency === 'USD' ? '$' : 'NT$'}${reductionData.cashRefundTotal} 已匯入活存，持股已變更為 ${reductionData.newShares} 股`
    );
    setTimeout(() => setRefreshStatus(null), 3500);
  };

  // Quick Stock Search & Trend Chart Handlers
  const handleChartSearchChange = (val: string) => {
    setChartSearchQuery(val);
    const currentSeq = ++chartSearchSeqRef.current;

    if (chartSearchTimeoutRef.current) {
      clearTimeout(chartSearchTimeoutRef.current);
    }

    if (!val.trim()) {
      setChartSearchResults([]);
      setShowChartSearchResults(false);
      setIsChartSearching(false);
      return;
    }

    setIsChartSearching(true);
    chartSearchTimeoutRef.current = setTimeout(async () => {
      const finalVal = val.trim();
      if (!finalVal || currentSeq !== chartSearchSeqRef.current) {
        if (currentSeq === chartSearchSeqRef.current) setIsChartSearching(false);
        return;
      }
      try {
        const targetMkt = filterMarket === 'ALL' ? undefined : filterMarket;
        const matches = await searchStockSuggestionsAsync(finalVal, targetMkt);
        if (currentSeq === chartSearchSeqRef.current) {
          setChartSearchResults(matches);
          setShowChartSearchResults(matches.length > 0);
          setIsChartSearching(false);
        }
      } catch (e) {
        if (currentSeq === chartSearchSeqRef.current) {
          setChartSearchResults([]);
          setShowChartSearchResults(false);
          setIsChartSearching(false);
        }
      }
    }, 100);
  };

  const handleSelectChartSearchStock = async (item: StockSearchResult) => {
    setShowChartSearchResults(false);
    setChartSearchQuery('');

    const symUp = item.symbol.toUpperCase();
    const rawCode = symUp.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const existing = syncedStocks.find((s) => {
      const sUp = s.symbol.toUpperCase();
      const sRaw = sUp.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
      return sUp === symUp || sRaw === rawCode;
    });

    if (existing) {
      setActiveChartStock(existing);
      return;
    }

    const unheldStock: PortfolioStock = {
      id: `chart-search-${item.symbol}-${Date.now()}`,
      symbol: item.symbol,
      name: item.name || item.symbol,
      market: item.market,
      shares: 0,
      avgCost: 0,
      currentPrice: item.price || 0,
      currency: item.market === 'US' ? 'USD' : 'TWD',
      lastUpdated: new Date().toISOString(),
      transactions: [],
    };

    setActiveChartStock(unheldStock);

    if (!item.price || item.price <= 0) {
      const quote = await fetchSingleStockQuote(item.symbol, item.market);
      if (quote && quote.currentPrice > 0) {
        setActiveChartStock((prev) => {
          if (prev && prev.symbol.toUpperCase() === item.symbol.toUpperCase()) {
            return {
              ...prev,
              currentPrice: quote.currentPrice,
              name: quote.name || prev.name,
              previousClose: quote.previousClose || prev.previousClose,
            };
          }
          return prev;
        });
      }
    }
  };

  // Open Modal for Add New Transaction / Stock
  const handleOpenAddModal = (targetStock?: PortfolioStock) => {
    setEditingTradeStock(targetStock || null);
    setEditingTradeTx(null);
    setIsAddModalOpen(true);
  };

  // Open Modal for Editing an Existing Transaction Record
  const handleOpenEditModal = (targetStock: PortfolioStock, tx: StockTransaction) => {
    setEditingTradeStock(targetStock);
    setEditingTradeTx(tx);
    setIsAddModalOpen(true);
  };

  // Save Transaction (BUY / SELL / EDIT)
  const handleSaveTransaction = async (formData: StockTradeFormData, overrideInitialHoldings?: boolean) => {
    lastUserTradeTimeRef.current = Date.now();
    const {
      editingTxId,
      tradeType,
      symbol,
      name,
      market: tradeMarket,
      shares: parsedShares,
      cost: parsedCostRaw,
      price: priceVal,
      date: tradeDate,
      note: tradeNote,
      isInitialHoldings: initialHoldingsFlag,
      netTradeTotal,
    } = formData;

    const cleanSym = symbol.trim().toUpperCase();
    let parsedCost = parsedCostRaw;
    if (parsedCost <= 0 && priceVal > 0) {
      parsedCost = priceVal;
    }

    if (!cleanSym || parsedShares <= 0 || parsedCost <= 0) {
      setConfirmModal({
        isOpen: true,
        title: '請確認填寫內容',
        message: '請填寫有效的股票代號、股數（需大於 0）與買入單價（需大於 0）！',
        type: 'warning',
        isAlert: true,
        confirmText: '我知道了',
      });
      return;
    }

    // Taiwan Stock Integer Shares Validation
    if (tradeMarket === 'TW' && !Number.isInteger(parsedShares)) {
      setConfirmModal({
        isOpen: true,
        title: '股數格式不正確 ⚠️',
        message: '台股交易單位必須為整數（最小單位為 1 股），不支援小數點碎股！\n若為零股交易，請輸入整數股數（例如 1 ~ 999 股）。',
        type: 'warning',
        isAlert: true,
        confirmText: '我知道了',
      });
      return;
    }

    const useInitialHoldings =
      typeof overrideInitialHoldings === 'boolean'
        ? overrideInitialHoldings
        : tradeType === 'BUY'
        ? initialHoldingsFlag
        : false;

    // Validate cash balance for BUY trade if deducting cash (only on new add)
    if (!editingTxId && tradeType === 'BUY' && !useInitialHoldings && typeof overrideInitialHoldings === 'undefined') {
      const isUS = tradeMarket === 'US';
      const tradeCost = netTradeTotal > 0 ? netTradeTotal : parsedShares * parsedCost;
      const availableCash = isUS ? currentUSD : currentTWD;

      if (availableCash < tradeCost) {
        const shortage = tradeCost - availableCash;
        setCashAlertModal({
          isOpen: true,
          stockName: name.trim() || cleanSym,
          isUS,
          tradeCost,
          currentCash: availableCash,
          shortage,
          onConfirmInitialHoldings: () => {
            setCashAlertModal(null);
            handleSaveTransaction(formData, true);
          },
          onConfirmForceDeduct: () => {
            setCashAlertModal(null);
            handleSaveTransaction(formData, false);
          },
        });
        return;
      }
    }

    const initialPrice = priceVal > 0 ? priceVal : parsedCost;

    // Check if stock already exists in portfolio
    const existingStockIndex = syncedStocks.findIndex(
      (s) => s.symbol.toUpperCase() === cleanSym.toUpperCase()
    );
    const existingStock = existingStockIndex >= 0 ? syncedStocks[existingStockIndex] : null;

    setIsSaving(true);
    try {
      if (editingTxId && existingStock) {
        // Editing existing transaction
        const oldTx = (existingStock.transactions || []).find((t) => t.id === editingTxId);
        const isUS = tradeMarket === 'US';

        const updatedTxs = (existingStock.transactions || []).map((t) => {
          if (t.id === editingTxId) {
            return {
              ...t,
              type: tradeType,
              shares: parsedShares,
              price: parsedCost,
              date: tradeDate || t.date,
              note: tradeNote.trim(),
              isInitialHoldings: useInitialHoldings,
            };
          }
          return t;
        });

        // Validate chronological timeline to prevent naked shorting / negative shares
        const timelineCheck = validateTradeTimeline(updatedTxs);
        if (!timelineCheck.isValid) {
          setWarningModal({
            isOpen: true,
            title: '現股庫存不足警告 ⚠️',
            message: timelineCheck.errorMessage || '修改此筆交易會導致歷史持股庫存變為負數！',
            details: '【防裸賣防禦機制】系統依據交易時間軸檢核：此修改會導致該日期或後續日期的持股數量不足以支撐賣出。若要縮減買入或增加賣出，請先確認或調整後續的賣出明細。',
          });
          setIsSaving(false);
          return;
        }

        const updatedStockObj = syncStockCalculations({
          ...existingStock,
          name: name.trim() || existingStock.name,
          currentPrice: initialPrice > 0 ? initialPrice : existingStock.currentPrice,
          transactions: updatedTxs,
        });

        if (onSaveSingleStock) {
          const res = await onSaveSingleStock(updatedStockObj);
          if (!res.success) {
            setConfirmModal({
              isOpen: true,
              title: '雲端同步失敗',
              message: `❌ 雲端同步失敗: ${res.error || '無法寫入 Supabase 資料庫'}\n請檢查網路或 Supabase 資料表設定！`,
              type: 'danger',
              isAlert: true,
              confirmText: '確定',
            });
            return;
          }
        } else {
          const updatedStocksList = [...syncedStocks];
          updatedStocksList[existingStockIndex] = updatedStockObj;
          onUpdateStocks(updatedStocksList);
        }

        // Precise Cash reconciliation (Conserving fees and taxes)
        if (onAdjustCashSavings && oldTx) {
          const calcNetAmt = (tx: StockTransaction, isUsStock: boolean) => {
            const raw = (tx.shares || 0) * (tx.price || 0);
            if (isUsStock) {
              const feeRate = fireConfig?.usStockFeeRate ?? 0;
              const fee = Number((raw * (feeRate / 100)).toFixed(2));
              return tx.type === 'BUY' ? raw + fee : Math.max(0, raw - fee);
            } else {
              const feeRate = fireConfig?.twStockFeeRate ?? 0.0399;
              const fee = Math.max(1, Math.round(raw * (feeRate / 100)));
              const isETF = existingStock.symbol.startsWith('00') || existingStock.name.includes('ETF') || existingStock.symbol.includes('00');
              const tax = tx.type === 'SELL' ? Math.round(raw * (isETF ? 0.001 : 0.003)) : 0;
              return tx.type === 'BUY' ? raw + fee : Math.max(0, raw - fee - tax);
            }
          };

          const oldNetAmt = calcNetAmt(oldTx, isUS);
          const newNetAmt = netTradeTotal > 0 ? netTradeTotal : parsedShares * parsedCost;

          if (oldTx.type === 'BUY' && !oldTx.isInitialHoldings) {
            onAdjustCashSavings(+oldNetAmt, isUS ? 'USD' : 'TWD');
          } else if (oldTx.type === 'SELL') {
            onAdjustCashSavings(-oldNetAmt, isUS ? 'USD' : 'TWD');
          }
          if (tradeType === 'BUY' && !useInitialHoldings) {
            onAdjustCashSavings(-newNetAmt, isUS ? 'USD' : 'TWD');
          } else if (tradeType === 'SELL') {
            onAdjustCashSavings(+newNetAmt, isUS ? 'USD' : 'TWD');
          }
        }

        setIsAddModalOpen(false);
        setEditingTradeStock(null);
        setEditingTradeTx(null);

        if (activeHistoryStock && activeHistoryStock.id === existingStock.id) {
          setActiveHistoryStock(updatedStockObj);
        }
        return;
      }

      const newTx: StockTransaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: tradeType,
        shares: parsedShares,
        price: parsedCost,
        date: tradeDate || new Date().toISOString().split('T')[0],
        note: tradeNote.trim(),
        isInitialHoldings: useInitialHoldings,
      };

      const existingTxs = existingStock ? existingStock.transactions || [] : [];
      const simulatedTxs = [newTx, ...existingTxs];

      // Validate chronological timeline to prevent naked shorting / negative shares
      const timelineCheck = validateTradeTimeline(simulatedTxs);
      if (!timelineCheck.isValid) {
        setWarningModal({
          isOpen: true,
          title: '現股庫存不足警告 ⚠️',
          message: timelineCheck.errorMessage || '現有持股庫存數量不足，無法執行賣出交易！',
          details: '【防裸賣機制】系統已依據交易日期比對歷史庫存。在該日期賣出的股數，不得大於當時實際持有的可賣現股數量。',
        });
        return;
      }

      let targetStockObj: PortfolioStock;

      if (existingStockIndex >= 0 && existingStock) {
        const updatedTxArray = [newTx, ...(existingStock.transactions || [])];
        targetStockObj = syncStockCalculations({
          ...existingStock,
          name: name.trim() || existingStock.name,
          currentPrice: initialPrice,
          transactions: updatedTxArray,
        });
      } else {
        const newStockObj: PortfolioStock = {
          id: `port-${Date.now()}`,
          symbol: cleanSym,
          name: name.trim() || cleanSym,
          market: tradeMarket,
          shares: parsedShares,
          avgCost: parsedCost,
          currentPrice: initialPrice,
          currency: tradeMarket === 'US' ? 'USD' : 'TWD',
          lastUpdated: new Date().toISOString(),
          transactions: [newTx],
        };
        targetStockObj = syncStockCalculations(newStockObj);
      }

      if (onSaveSingleStock) {
        const res = await onSaveSingleStock(targetStockObj);
        if (!res.success) {
          setConfirmModal({
            isOpen: true,
            title: '雲端同步失敗',
            message: `❌ 雲端同步失敗: ${res.error || '無法寫入 Supabase 資料庫'}\n請檢查網路或 Supabase 資料表設定！`,
            type: 'danger',
            isAlert: true,
            confirmText: '確定',
          });
          return;
        }
      } else {
        let updatedList: PortfolioStock[];
        if (existingStockIndex >= 0) {
          updatedList = [...syncedStocks];
          updatedList[existingStockIndex] = targetStockObj;
        } else {
          updatedList = [targetStockObj, ...syncedStocks];
        }
        onUpdateStocks(updatedList);
      }

      // Adjust cash savings according to the stock trade and currency (including fee/tax)
      let cashDelta = 0;
      const isUS = tradeMarket === 'US';
      const tradeValue = netTradeTotal > 0 ? netTradeTotal : parsedShares * parsedCost;
      if (tradeType === 'BUY') {
        if (!useInitialHoldings) {
          cashDelta = -tradeValue;
        }
      } else if (tradeType === 'SELL') {
        cashDelta = +tradeValue;
      }

      if (cashDelta !== 0 && onAdjustCashSavings) {
        onAdjustCashSavings(cashDelta, isUS ? 'USD' : 'TWD');
      }

      if (filterMarket !== 'ALL' && filterMarket !== tradeMarket) {
        setFilterMarket('ALL');
      }
      setIsAddModalOpen(false);
      setEditingTradeStock(null);
      setEditingTradeTx(null);

      if (activeHistoryStock && activeHistoryStock.id === targetStockObj.id) {
        setActiveHistoryStock(targetStockObj);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Warning Alert Modal state for Naked Short Selling / Insufficient Inventory
  const [warningModal, setWarningModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  // Confirm Modal state for deleting stocks or single trade logs
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    isAlert?: boolean;
    confirmText?: string;
    onConfirm?: () => void;
  } | null>(null);

  // Delete Single Transaction Record with Styled Confirmation
  const handleDeleteSingleTransaction = (stockId: string, txId: string) => {
    const targetStock = syncedStocks.find((s) => s.id === stockId);
    if (!targetStock || !targetStock.transactions) return;

    // Validate deletion impact on downstream inventory
    const deleteCheck = validateTradeDeletionOrEdit(targetStock.transactions, txId);
    if (!deleteCheck.isValid) {
      setWarningModal({
        isOpen: true,
        title: '無法刪除此筆交易 ⚠️',
        message: deleteCheck.errorMessage || '刪除此筆交易會導致後續歷史庫存不足或變為負數！',
        details: '【防裸賣防禦機制】此交易在歷史時間軸上支撐了後續的賣出交易，若要刪除請先調整或刪除該日期之後的賣出紀錄。',
      });
      return;
    }

    const targetTx = targetStock.transactions.find((t) => t.id === txId);
    const txDesc = targetTx
      ? targetTx.type === 'SPLIT'
        ? `股票分割 (${targetTx.splitRatio ? (targetTx.splitRatio >= 1 ? `1 拆 ${targetTx.splitRatio}` : `${1 / targetTx.splitRatio} 併 1`) : '1 拆 10'})`
        : targetTx.type === 'DIVIDEND'
        ? `現金股息 (${targetStock.market === 'US' ? '$' : 'NT$'}${formatNum(targetTx.dividendTotalCash || (targetTx.shares * (targetTx.dividendPerShare || targetTx.price || 0)))})`
        : targetTx.type === 'STOCK_DIVIDEND'
        ? `股票股利 (配股 +${targetTx.shares} 股)`
        : `${targetTx.type === 'BUY' ? '買入' : '賣出'} ${targetTx.shares} 股 @ $${targetTx.price}`
      : '這筆交易';

    setConfirmModal({
      isOpen: true,
      title: '確定要刪除這筆交易明細？',
      message: `確定要刪除股票「${targetStock.name} (${targetStock.symbol})」的 ${txDesc} 交易紀錄嗎？刪除後持股與買入均價將重新計算。`,
      onConfirm: async () => {
        lastUserTradeTimeRef.current = Date.now();
        const remainingTx = targetStock.transactions.filter((t) => t.id !== txId);
        const updatedStock = syncStockCalculations({
          ...targetStock,
          transactions: remainingTx,
        });

        // Refund/revert cash if deleting trade in matching currency (including fee & tax)
        if (targetTx && onAdjustCashSavings) {
          const isUS = targetStock.market === 'US';
          if (targetTx.type === 'DIVIDEND') {
            const divCash = targetTx.dividendTotalCash ?? ((targetTx.shares || 0) * (targetTx.dividendPerShare || targetTx.price || 0));
            if (divCash > 0) {
              onAdjustCashSavings(-divCash, isUS ? 'USD' : 'TWD');
            }
          } else {
            const isTW = targetStock.market === 'TW';
            const rawAmt = (targetTx.shares || 0) * (targetTx.price || 0);

            let netAmt = rawAmt;
            if (isTW) {
              const feeRate = fireConfig?.twStockFeeRate ?? 0.0399;
              const fee = Math.max(1, Math.round(rawAmt * (feeRate / 100)));
              const isETF = targetStock.symbol.startsWith('00') || targetStock.name.includes('ETF') || targetStock.symbol.includes('00');
              const tax = targetTx.type === 'SELL' ? Math.round(rawAmt * (isETF ? 0.001 : 0.003)) : 0;
              if (targetTx.type === 'BUY') {
                netAmt = rawAmt + fee;
              } else {
                netAmt = Math.max(0, rawAmt - fee - tax);
              }
            } else {
              const usFeeRate = fireConfig?.usStockFeeRate ?? 0;
              const fee = Number((rawAmt * (usFeeRate / 100)).toFixed(2));
              if (targetTx.type === 'BUY') {
                netAmt = rawAmt + fee;
              } else {
                netAmt = Math.max(0, rawAmt - fee);
              }
            }

            if (targetTx.type === 'BUY' && !targetTx.isInitialHoldings) {
              onAdjustCashSavings(+netAmt, isUS ? 'USD' : 'TWD');
            } else if (targetTx.type === 'SELL') {
              onAdjustCashSavings(-netAmt, isUS ? 'USD' : 'TWD');
            }
          }
        }

        if (remainingTx.length === 0 && updatedStock.shares === 0) {
          if (onDeleteSingleStock) {
            await onDeleteSingleStock(stockId);
          } else {
            const updatedList = syncedStocks.filter((s) => s.id !== stockId);
            onUpdateStocks(updatedList);
          }
          setActiveHistoryStock(null);
        } else {
          if (onSaveSingleStock) {
            await onSaveSingleStock(updatedStock);
          } else {
            const updatedList = syncedStocks.map((s) => (s.id === stockId ? updatedStock : s));
            onUpdateStocks(updatedList);
          }
          setActiveHistoryStock(updatedStock);
        }
      },
    });
  };

  // Delete Entire Stock Card with Styled Confirmation
  const handleDeleteStockEntirely = (id: string) => {
    const targetStock = syncedStocks.find((s) => s.id === id);
    const stockName = targetStock ? `${targetStock.name} (${targetStock.symbol})` : '這檔股票';

    setConfirmModal({
      isOpen: true,
      title: '確定要整檔刪除此股票嗎？',
      message: `確定要整檔刪除「${stockName}」及其所有歷史買賣交易對帳紀錄嗎？\n\n（提示：整檔刪除僅清空庫存持股追蹤與歷史走勢，不會回退過去已扣除的現金儲備）`,
      onConfirm: async () => {
        lastUserTradeTimeRef.current = Date.now();
        if (onDeleteSingleStock) {
          const res = await onDeleteSingleStock(id);
          if (!res.success) {
            setConfirmModal({
              isOpen: true,
              title: '刪除失敗',
              message: `❌ 刪除失敗: ${res.error || '無法從雲端刪除'}`,
              type: 'danger',
              isAlert: true,
              confirmText: '確定',
            });
            return;
          }
        } else {
          const updated = syncedStocks.filter((s) => s.id !== id);
          onUpdateStocks(updated);
        }
        if (activeHistoryStock?.id === id) {
          setActiveHistoryStock(null);
        }
      },
    });
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* 🌟 Unified Pro Hero Dashboard Card (Robinhood / Revolut / Apple Stocks Style) */}
      <div
        className="bg-[#0e0e0e] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden space-y-5"
        style={{
          boxShadow: `0 0 40px rgba(${currentTheme.bgGlowRgb}, 0.12)`,
        }}
      >
        {/* Top Header Row: Portfolio Title & Quick Currency Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center font-bold shadow-md shrink-0"
              style={{ backgroundColor: currentTheme.primaryHex, color: '#000' }}
            >
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                投資庫存總覽 <span className="text-xs font-mono font-bold text-gray-400 font-normal">Portfolio</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* USD Exchange Rate */}
            <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-gray-300">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-[11px] text-amber-300">1 USD = {usdRate.toFixed(2)} TWD</span>
            </div>

            {/* Currency Exchange Modal Trigger */}
            {onOpenCurrencyExchange && (
              <button
                type="button"
                onClick={onOpenCurrencyExchange}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold rounded-xl transition cursor-pointer active:scale-95 shadow-sm"
                title="雙幣現金池換匯轉帳"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>換匯轉帳</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Big Number Row (Robinhood Style) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-gray-400 block tracking-wider uppercase">
                目前投資總市值 (Market Value)
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight mt-0.5">
                {sym} {formatNum(totalMarketValueTWD)}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 font-mono mt-1">
                <span>🇺🇸 美股: <strong className="text-cyan-400">${formatNum(usMarketValueUSD)} USD</strong></span>
                <span>•</span>
                <span>🇹🇼 台股: <strong className="text-emerald-400">${formatNum(twMarketValueTWD)}</strong></span>
              </div>
            </div>

            {/* P&L Badges (All-Time + Today) Responsive Grid */}
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-col gap-2 shrink-0">
              {/* Total Cumulative Unrealized Gain */}
              <div
                className={`px-3 py-1.5 rounded-2xl font-mono text-xs sm:text-sm font-black flex items-center justify-between sm:justify-start gap-1.5 shadow-md ${
                  totalUnrealizedProfitTWD >= 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                <div className="flex items-center gap-1">
                  {totalUnrealizedProfitTWD >= 0 ? <ArrowUpRight className="w-4 h-4 stroke-[3]" /> : <ArrowDownRight className="w-4 h-4 stroke-[3]" />}
                  <span className="font-sans text-[11px] text-gray-300">總損益</span>
                </div>
                <span className="whitespace-nowrap">
                  {totalUnrealizedProfitTWD >= 0 ? '+' : ''}{sym} {formatNum(totalUnrealizedProfitTWD)} ({totalUnrealizedProfitTWD >= 0 ? '+' : ''}{formatDec(totalRoiPercent)}%)
                </span>
              </div>

              {/* Today's Estimated Gain */}
              {syncedStocks.length > 0 && (
                <div
                  className={`px-3 py-1.5 rounded-2xl font-mono text-xs font-bold flex items-center justify-between sm:justify-end gap-1.5 border ${
                    totalTodayChangeTWD >= 0
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}
                >
                  <span className="font-sans text-[11px] text-gray-400">今日估算:</span>
                  <span className="whitespace-nowrap">
                    {totalTodayChangeTWD >= 0 ? '+' : ''}{sym} {formatNum(totalTodayChangeTWD)} ({totalTodayChangeTWD >= 0 ? '+' : ''}{totalTodayRoiPercent.toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3 Key Metric Columns Row (Zero Truncation Guaranteed) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-3 border-t border-white/10 text-xs">
          {/* Col 1: Cost */}
          <div className="bg-[#121216] border border-white/5 rounded-2xl p-3 flex sm:flex-col items-center sm:items-start justify-between">
            <span className="text-[11px] text-gray-400 block font-medium">投入成本 (Cost)</span>
            <div className="text-sm sm:text-base font-black text-gray-200 font-mono mt-0.5 whitespace-nowrap">
              {sym} {formatNum(totalCostTWD)}
            </div>
          </div>

          {/* Col 2: Cash Reserves (Full Dual-Currency Display, Balanced & Crisp) */}
          <div className="bg-[#121216] border border-white/5 rounded-2xl p-3 flex sm:flex-col items-center sm:items-start justify-between gap-1">
            <span className="text-[11px] text-emerald-400/90 block font-medium shrink-0">現金儲備 (Cash)</span>
            <div className="text-xs sm:text-sm font-black text-emerald-300 font-mono mt-0.5 flex flex-wrap items-center justify-end sm:justify-start gap-1 sm:gap-1.5">
              <span className="whitespace-nowrap">NT$ {formatNum(currentTWD)}</span>
              {currentUSD > 0 && (
                <>
                  <span className="text-gray-600 font-normal hidden xs:inline">•</span>
                  <span className="text-cyan-300 whitespace-nowrap">USD ${formatNum(currentUSD)}</span>
                </>
              )}
            </div>
          </div>

          {/* Col 3: Realized P&L */}
          <div className="bg-[#121216] border border-white/5 rounded-2xl p-3 flex sm:flex-col items-center sm:items-start justify-between">
            <span className="text-[11px] text-gray-400 block font-medium">已實現總損益</span>
            <div className={`text-sm sm:text-base font-black font-mono mt-0.5 whitespace-nowrap ${totalRealizedPnLTWD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalRealizedPnLTWD >= 0 ? '+' : ''}{sym} {formatNum(totalRealizedPnLTWD)}
            </div>
          </div>
        </div>

        {/* Embedded Asset Allocation Bar (Seamlessly integrated into Hero) */}
        {totalAllocatedValue > 0 && (
          <div className="pt-2 space-y-2 border-t border-white/5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-gray-300 font-bold text-[11px]">
                <PieChart className="w-3.5 h-3.5 text-cyan-400" />
                <span>資產配置權重分佈</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">
                總資產池: {sym} {formatNum(totalAllocatedValue)}
              </span>
            </div>

            {/* Horizontal Segmented Bar (100% Full Width) */}
            <div className="w-full h-2.5 bg-black/60 rounded-full flex overflow-hidden border border-white/10">
              {allocationSegments.map((st) => (
                <div
                  key={st.id}
                  className="h-full transition-all duration-300 relative group"
                  style={{
                    width: `${st.pct}%`,
                    backgroundColor: st.color,
                  }}
                  title={`${st.symbol} (${st.name}): ${st.pct.toFixed(1)}%`}
                />
              ))}
              {cashPct > 0 && (
                <div
                  className="h-full bg-emerald-500/80 transition-all duration-300"
                  style={{ width: `${cashPct}%` }}
                  title={`現金儲備 (TWD+USD): ${cashPct.toFixed(1)}%`}
                />
              )}
            </div>

            {/* Legend Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
              {allocationSegments.slice(0, 6).map((st) => (
                <div key={st.id} className="flex items-center gap-1 bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: st.color }}
                  />
                  <span className="font-mono font-bold text-white text-[10px]">{st.symbol}</span>
                  <span className="text-gray-400 text-[10px]">{st.pct.toFixed(1)}%</span>
                </div>
              ))}
              {cashPct > 0 && (
                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="font-bold text-emerald-300 text-[10px]">現金</span>
                  <span className="text-emerald-400 text-[10px]">{cashPct.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🧭 Primary View Mode Switcher: [ 📦 持股庫存 (Holdings) ] vs [ 📅 股息日曆與被動收入 (Dividend Calendar) ] */}
      <div className="flex items-center p-1 bg-[#111114] border border-white/10 rounded-2xl shadow-xl max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => setPortfolioSubTab('holdings')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
            portfolioSubTab === 'holdings'
              ? 'bg-white/15 text-white shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
          <span>📦 持股庫存 ({syncedStocks.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setPortfolioSubTab('dividend_calendar')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
            portfolioSubTab === 'dividend_calendar'
              ? 'bg-white/15 text-white shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
          <span>📅 股息日曆與被動收入</span>
        </button>
      </div>

      {portfolioSubTab === 'dividend_calendar' ? (
        <DividendCalendarView
          stocks={syncedStocks}
          fireConfig={fireConfig}
          usdRate={usdRate}
          onOpenDividendModal={(stock, event) => {
            setActiveDividendModal({ stock, dividendEvent: event || null });
          }}
          onSelectStock={(stock) => {
            setActiveChartStock(stock);
          }}
        />
      ) : (
        <>
          {/* 🛠️ Symmetrically Aligned Clean Control Toolbar */}
          <div className="bg-[#0c0c0c] border border-white/5 p-3.5 sm:p-4 rounded-3xl space-y-3">
            {/* Row 1: Market Filter Tabs (Left) + Live Status (Middle) + Sort & Layout Mode (Right) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Market Filter Tabs */}
          <div className="flex items-center gap-1 bg-black/60 border border-white/10 p-1 rounded-2xl">
            <button
              onClick={() => setFilterMarket('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                filterMarket === 'ALL'
                  ? 'bg-white/15 text-white border border-white/20 shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              全部 ({syncedStocks.length})
            </button>

            <button
              onClick={() => setFilterMarket('US')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
                filterMarket === 'US'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-md'
                  : 'text-gray-400 hover:text-cyan-300'
              }`}
            >
              <span>🇺🇸 美股</span>
              <span className="text-[10px] font-mono opacity-80">
                ({syncedStocks.filter((s) => s.market === 'US').length})
              </span>
            </button>

            <button
              onClick={() => setFilterMarket('TW')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
                filterMarket === 'TW'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-md'
                  : 'text-gray-400 hover:text-emerald-300'
              }`}
            >
              <span>🇹🇼 台股</span>
              <span className="text-[10px] font-mono opacity-80">
                ({syncedStocks.filter((s) => s.market === 'TW').length})
              </span>
            </button>
          </div>

          {/* Right Tools: Ambient Live Status + Sort & View Mode */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Ambient Live Sync Status Capsule */}
            <button
              type="button"
              onClick={() => handleRefreshQuotes(false, false)}
              disabled={isRefreshing}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-sm border ${
                liveSyncState === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : liveSyncState === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
              }`}
              title="行情每 5 秒自動靜默同步，點擊可立即重整"
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    liveSyncState === 'error'
                      ? 'bg-rose-400'
                      : liveSyncState === 'warning'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    liveSyncState === 'error'
                      ? 'bg-rose-500'
                      : liveSyncState === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
              </span>
              <span className="font-mono text-[11px]">
                {liveSyncState === 'error'
                  ? '連線異常'
                  : liveSyncState === 'warning'
                  ? '行情延遲'
                  : '連線正常'}
              </span>
            </button>

            {/* Fee Settings Button */}
            <button
              type="button"
              onClick={() => setIsFeeSettingsModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-sm border bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10"
              title="設定台股與美股預設交易手續費率 (%)"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-400" />
              <span>費率設定</span>
            </button>

            {/* Custom Glassmorphic Sort Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center gap-1.5 bg-black/60 hover:bg-white/10 border border-white/10 rounded-2xl px-3 py-1.5 text-xs font-bold text-gray-200 transition cursor-pointer active:scale-95 shadow-sm"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                <span>
                  {sortBy === 'value_desc' && '💎 市值最高'}
                  {sortBy === 'roi_desc' && '🚀 ROI% 最高'}
                  {sortBy === 'roi_asc' && '📉 ROI% 最低'}
                  {sortBy === 'today_desc' && '⏱️ 今日漲幅最高'}
                  {sortBy === 'symbol_asc' && '🔤 代號 A-Z'}
                </span>
                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isSortDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[60]"
                    onClick={() => setIsSortDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-[70] w-48 bg-[#141418] border border-white/15 rounded-2xl p-1.5 shadow-2xl space-y-0.5 animate-fadeIn">
                    {[
                      { id: 'value_desc', label: '市值最高', icon: '💎' },
                      { id: 'roi_desc', label: 'ROI% 最高', icon: '🚀' },
                      { id: 'roi_asc', label: 'ROI% 最低', icon: '📉' },
                      { id: 'today_desc', label: '今日漲幅最高', icon: '⏱️' },
                      { id: 'symbol_asc', label: '代號 A-Z', icon: '🔤' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.id as any);
                          setIsSortDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                          sortBy === opt.id
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'text-gray-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </div>
                        {sortBy === opt.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Layout Mode Switcher */}
            <div className="flex items-center p-1 bg-black/60 border border-white/10 rounded-2xl">
              <button
                onClick={() => setViewLayout('cards')}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  viewLayout === 'cards' ? 'bg-white/20 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
                title="卡片檢視"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewLayout('list')}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  viewLayout === 'list' ? 'bg-white/20 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
                title="精簡清單"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Instant Stock Search & Trend Chart Explorer */}
        <div className="relative pt-1">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="🔍 搜尋台美股代號或名稱查走勢圖 (如 2330, NVDA, 0050, 台積電)..."
              value={chartSearchQuery}
              onChange={(e) => handleChartSearchChange(e.target.value)}
              onFocus={() => {
                if (chartSearchResults.length > 0) setShowChartSearchResults(true);
              }}
              className="w-full bg-black/60 border border-white/10 hover:border-white/20 focus:border-cyan-500 rounded-2xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition shadow-inner font-medium"
            />
            {isChartSearching && (
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin absolute right-3" />
            )}
            {!isChartSearching && chartSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setChartSearchQuery('');
                  setChartSearchResults([]);
                  setShowChartSearchResults(false);
                }}
                className="absolute right-3 text-gray-400 hover:text-white p-0.5 rounded-lg cursor-pointer transition"
                title="清除搜尋"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown List */}
          {showChartSearchResults && chartSearchResults.length > 0 && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowChartSearchResults(false)}
              />
              <div className="absolute left-0 right-0 top-full mt-2 bg-[#141418]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-50 divide-y divide-white/5 max-h-72 overflow-y-auto">
                <div className="px-3.5 py-1.5 bg-white/[0.03] text-[10px] text-gray-400 font-bold flex justify-between items-center">
                  <span>點擊股票即可直接查看即時走勢圖與 K 線</span>
                  <span className="font-mono">{chartSearchResults.length} 筆結果</span>
                </div>
                {chartSearchResults.map((item) => (
                  <button
                    key={`${item.market}-${item.symbol}`}
                    type="button"
                    onClick={() => handleSelectChartSearchStock(item)}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-white/10 flex items-center justify-between transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                          item.market === 'TW'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {item.market === 'TW' ? '🇹🇼 台股' : '🇺🇸 美股'}
                      </span>
                      <div className="truncate">
                        <div className="font-mono font-bold text-white text-xs flex items-center gap-1.5">
                          <span>{item.symbol}</span>
                          <TrendingUp className="w-3 h-3 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[11px] text-gray-400 truncate">{item.name}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      {item.price && item.price > 0 ? (
                        <div className="font-mono font-bold text-white text-xs">
                          {item.market === 'TW' ? 'NT$' : '$'} {item.price.toFixed(2)}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500">查看走勢</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Row 3: Full Width Modern Primary Action Button */}
        <div className="pt-0.5">
          <button
            onClick={() => handleOpenAddModal()}
            className="w-full py-3 px-4 text-black font-black text-xs sm:text-sm rounded-2xl transition cursor-pointer shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 hover:brightness-110"
            style={{
              backgroundColor: currentTheme.primaryHex,
              boxShadow: `0 0 20px rgba(${currentTheme.bgGlowRgb}, 0.25)`,
            }}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>記一筆交易 (買入 / 賣出 / 除息)</span>
          </button>
        </div>
      </div>

      {/* Watchdog Alert Banner if prolonged sync error / offline */}
      {liveSyncState === 'error' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 text-xs text-amber-300 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">即時行情連線暫時延遲，已為您安全保留最近有效收盤價。</span>
          </div>
          <button
            onClick={() => handleRefreshQuotes(false, false)}
            className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer transition active:scale-95 border border-amber-500/30"
          >
            立即重試
          </button>
        </div>
      )}

      {/* Status Alert Banner if Manual Refreshing */}
      {refreshStatus && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-3.5 text-xs text-cyan-300 font-bold flex items-center gap-2.5 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>{refreshStatus}</span>
        </div>
      )}

      {/* Stock Holdings Rendering: Compact List vs Grid Cards */}
      {sortedStocks.length === 0 ? (
        <div className="bg-[#0c0c0c] border border-white/5 rounded-3xl p-12 text-center text-gray-500 text-sm">
          目前此分類下沒有持股紀錄，點擊「記一筆交易」新增買入或賣出紀錄！
        </div>
      ) : viewLayout === 'list' ? (
        /* Compact List View Mode (Ultra-clean Apple Stocks / Robinhood Style) */
        <div className="bg-[#0e0e0e] border border-white/10 rounded-3xl overflow-hidden shadow-xl divide-y divide-white/5">
          {sortedStocks.map((stock) => {
            const isUS = stock.market === 'US';
            const metrics = calculateStockMetrics(stock.transactions, stock.currentPrice);
            const currSymbol = isUS ? '$' : 'NT$';
            const todayChangeVal =
              stock.previousClose && stock.previousClose > 0 ? stock.currentPrice - stock.previousClose : 0;
            const todayChangePct =
              stock.previousClose && stock.previousClose > 0 ? (todayChangeVal / stock.previousClose) * 100 : 0;
            const pendingSplit = detectedSplitsMap[stock.id];
            const pendingDiv = detectedDividendsMap[stock.id];
            const pendingRight = detectedRightsMap[stock.id];

            return (
              <div
                key={stock.id}
                onClick={() => setActiveActionStock(stock)}
                className="p-3.5 sm:p-4 hover:bg-white/[0.04] active:bg-white/[0.08] active:scale-[0.99] transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 group"
              >
                {/* Left: Flag Badge + Symbol + Name & Position */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                    {isUS ? '🇺🇸' : '🇹🇼'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-white text-sm sm:text-base tracking-tight">{stock.symbol}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300">
                        {isUS ? '美股' : '台股'}
                      </span>
                      {pendingSplit && (
                        pendingSplit.status === 'upcoming' ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300">
                            ⏳ {pendingSplit.date} 分割
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSplitModal({ stock, splitEvent: pendingSplit });
                            }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/25 hover:bg-purple-500/40 border border-purple-500/50 text-purple-200 flex items-center gap-1 transition cursor-pointer animate-pulse"
                          >
                            <Scissors className="w-3 h-3" />
                            <span>待確認分割</span>
                          </button>
                        )
                      )}
                      {pendingDiv && (
                        pendingDiv.status === 'upcoming' ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300">
                            💰 {pendingDiv.date} 除息{pendingDiv.amount > 0 ? ` $${pendingDiv.amount}` : ''}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDividendModal({ stock, dividendEvent: pendingDiv });
                            }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-500/50 text-emerald-200 flex items-center gap-1 transition cursor-pointer animate-pulse"
                          >
                            <span>💰 待確認股息</span>
                          </button>
                        )
                      )}
                      {pendingRight && (
                        pendingRight.status === 'upcoming' ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300">
                            📈 {pendingRight.date} 除權{pendingRight.stockDividendPerShare > 0 ? ` 配${pendingRight.stockDividendPerShare}元` : ''}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRightModal({ stock, rightEvent: pendingRight });
                            }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/25 hover:bg-sky-500/40 border border-sky-500/50 text-sky-200 flex items-center gap-1 transition cursor-pointer animate-pulse"
                          >
                            <span>📈 待確認除權配股</span>
                          </button>
                        )
                      )}
                    </div>
                    <div className="text-xs text-gray-400 truncate max-w-[170px] xs:max-w-[220px] sm:max-w-[360px]" title={stock.name}>
                      {stock.name}
                    </div>
                    <div className="text-[11px] font-mono text-gray-500 mt-0.5">
                      {formatNum(metrics.shares)} 股 • 均價 ${formatDec(metrics.avgCost)}
                    </div>
                  </div>
                </div>

                {/* Right: Current Price + Market Value + Clean Compact ROI Pill */}
                <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
                  <div className="text-right">
                    <div className="font-mono font-black text-white text-sm sm:text-base">
                      {currSymbol}{formatDec(stock.currentPrice)}
                    </div>
                    <div className="text-[11px] font-mono text-gray-400">
                      市值 ${formatNum(metrics.marketValue)}
                    </div>
                    {stock.previousClose && stock.previousClose > 0 && (
                      <div
                        className={`text-[10px] font-mono font-semibold ${
                          todayChangeVal >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        今日 {todayChangeVal >= 0 ? '+' : ''}{todayChangePct.toFixed(2)}%
                      </div>
                    )}
                  </div>

                  {/* Clean Compact ROI Capsule Badge */}
                  <div
                    className={`min-w-[68px] sm:min-w-[78px] py-1.5 px-2 rounded-2xl font-mono text-xs font-black text-center shadow-md ${
                      metrics.unrealizedPnL >= 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    <div>{metrics.unrealizedPnL >= 0 ? '+' : ''}{formatDec(metrics.unrealizedRoiPercent)}%</div>
                    <div className="text-[10px] opacity-80 font-normal">
                      {metrics.unrealizedPnL >= 0 ? '+' : ''}${formatNum(metrics.unrealizedPnL)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed Grid Cards View Mode (Sleek 3-tier Financial Card) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedStocks.map((stock) => {
            const isUS = stock.market === 'US';
            const metrics = calculateStockMetrics(stock.transactions, stock.currentPrice);
            const currSymbol = isUS ? '$' : 'NT$';
            const todayChangeVal =
              stock.previousClose && stock.previousClose > 0 ? stock.currentPrice - stock.previousClose : 0;
            const todayChangePct =
              stock.previousClose && stock.previousClose > 0 ? (todayChangeVal / stock.previousClose) * 100 : 0;
            const pendingSplit = detectedSplitsMap[stock.id];
            const isUpcomingSplit = pendingSplit?.status === 'upcoming';
            const isPendingSplit = pendingSplit?.status === 'effective_pending';

            const pendingDiv = detectedDividendsMap[stock.id];
            const isUpcomingDiv = pendingDiv?.status === 'upcoming';
            const isPendingDiv = pendingDiv?.status === 'effective_pending';

            const pendingRight = detectedRightsMap[stock.id];
            const isUpcomingRight = pendingRight?.status === 'upcoming';
            const isPendingRight = pendingRight?.status === 'effective_pending';

            const isPendingBoth = isPendingDiv && isPendingRight;

            const cardBorderClass = isPendingSplit
              ? 'border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.35)]'
              : isPendingBoth
              ? 'border-teal-400 shadow-[0_0_30px_rgba(20,184,166,0.45),0_0_15px_rgba(14,165,233,0.3)]'
              : isPendingDiv
              ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
              : isPendingRight
              ? 'border-sky-500 shadow-[0_0_25px_rgba(14,165,233,0.35)]'
              : (isUpcomingSplit || isUpcomingDiv || isUpcomingRight)
              ? 'border-amber-500/70 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              : 'border-white/10 hover:border-white/20 shadow-xl';

            return (
              <div
                key={stock.id}
                className={`bg-[#0e0e0e] border rounded-3xl p-5 space-y-4 transition-all duration-200 active:scale-[0.99] group relative overflow-hidden ${cardBorderClass}`}
              >
                {/* Card Header: Symbol + Name (Left) ｜ Large Price & Today Change (Right) */}
                <div className="flex items-start justify-between border-b border-white/10 pb-3.5 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg shrink-0">
                      {isUS ? '🇺🇸' : '🇹🇼'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-lg font-black text-white font-mono tracking-tight">{stock.symbol}</h3>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300">
                          {isUS ? '美股' : '台股'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate max-w-[180px] xs:max-w-[240px] sm:max-w-[300px]" title={stock.name}>
                        {stock.name}
                      </p>
                    </div>
                  </div>

                  {/* Large Current Price on Top Right */}
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black font-mono text-white">
                      {currSymbol}{formatDec(stock.currentPrice)}
                    </div>
                    {stock.previousClose && stock.previousClose > 0 ? (
                      <span
                        className={`text-[11px] font-mono font-bold ${
                          todayChangeVal >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {todayChangeVal >= 0 ? '▲ +' : '▼ '}{todayChangePct.toFixed(2)}% 今日
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-500">最新即時價</span>
                    )}
                  </div>
                </div>

                {/* Option A: Stock Split Alert Bar */}
                {pendingSplit && (
                  isUpcomingSplit ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-2.5 flex items-center justify-between text-xs text-amber-300">
                      <div className="flex items-center gap-2">
                        <Scissors className="w-3.5 h-3.5 text-amber-400" />
                        <span>⏳ 預定 {pendingSplit.date} 進行 {pendingSplit.splitRatioText} 股票分割</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSplitModal({ stock, splitEvent: pendingSplit })}
                        className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-bold transition cursor-pointer"
                      >
                        試算
                      </button>
                    </div>
                  ) : (
                    <div className="bg-purple-500/15 border border-purple-500/40 rounded-2xl p-2.5 flex items-center justify-between text-xs text-purple-200 shadow-md">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded-lg bg-purple-500/20 text-purple-300 animate-pulse">
                          <Scissors className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-white">今日已分割！</span>
                          <span className="text-[11px] text-purple-300 ml-1">({pendingSplit.splitRatioText})</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSplitModal({ stock, splitEvent: pendingSplit })}
                        className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black text-xs transition shadow-md shadow-purple-600/30 cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <span>點此校正 ➔</span>
                      </button>
                    </div>
                  )
                )}

                {/* Option A: Stock Cash Dividend Alert Bar */}
                {pendingDiv && (
                  isUpcomingDiv ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-2.5 flex items-center justify-between text-xs text-amber-300">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">⏳</span>
                        <span>
                          預定 {pendingDiv.date} 除息
                          {pendingDiv.amount > 0 ? ` 每股 $${pendingDiv.amount}` : ' (金額待公告)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveDividendModal({ stock, dividendEvent: pendingDiv })}
                        className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-bold transition cursor-pointer"
                      >
                        預估
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-2.5 flex items-center justify-between text-xs text-emerald-200 shadow-md">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300 animate-pulse text-sm">
                          💰
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-white">今日已除息！</span>
                          <span className="text-[11px] text-emerald-300 ml-1">
                            ({pendingDiv.amount > 0 ? `每股 $${pendingDiv.amount}` : '點此確認入帳'})
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveDividendModal({ stock, dividendEvent: pendingDiv })}
                        className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs transition shadow-md shadow-emerald-600/30 cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <span>收到股息！確認入帳 ➔</span>
                      </button>
                    </div>
                  )
                )}

                {/* Option A: Stock Right (Stock Dividend / 配股) Alert Bar */}
                {pendingRight && (
                  isUpcomingRight ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-2.5 flex items-center justify-between text-xs text-amber-300">
                      <div className="flex items-center gap-2 truncate">
                        <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">
                          ⏳ 預定 {pendingRight.date} 除權
                          {pendingRight.stockDividendPerShare > 0 ? ` 每股配 $${pendingRight.stockDividendPerShare}元` : ' (股票股利)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveRightModal({ stock, rightEvent: pendingRight })}
                        className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-bold transition cursor-pointer shrink-0 ml-2"
                      >
                        試算
                      </button>
                    </div>
                  ) : (
                    <div className="bg-sky-500/15 border border-sky-500/40 rounded-2xl p-2.5 flex items-center justify-between text-xs text-sky-200 shadow-md">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded-lg bg-sky-500/20 text-sky-300 animate-pulse text-sm">
                          <Gift className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-white">今日已除權！</span>
                          <span className="text-[11px] text-sky-300 ml-1">
                            ({pendingRight.stockDividendPerShare > 0 ? `每股配 $${pendingRight.stockDividendPerShare}元` : '點此確認配股'})
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveRightModal({ stock, rightEvent: pendingRight })}
                        className="px-3 py-1 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-black text-xs transition shadow-md shadow-sky-600/30 cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <span>配股入帳確認 ➔</span>
                      </button>
                    </div>
                  )
                )}

                {/* Card Body: Structured Metrics 2x2 Grid */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  {/* Metric 1: Market Value vs Cost */}
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-3 space-y-1">
                    <span className="text-[10px] text-gray-400 block font-medium">💎 目前市值 / 投入成本</span>
                    <div className="text-sm font-black font-mono text-white">
                      {currSymbol}{formatNum(metrics.marketValue)}
                    </div>
                    <div className="text-[11px] font-mono text-gray-500">
                      成本: {currSymbol}{formatNum(metrics.totalCost)}
                    </div>
                  </div>

                  {/* Metric 2: Unrealized PnL & ROI% */}
                  <div
                    className={`bg-black/40 border rounded-2xl p-3 space-y-1 ${
                      metrics.unrealizedPnL >= 0
                        ? 'border-emerald-500/20 text-emerald-300 bg-emerald-500/[0.03]'
                        : 'border-rose-500/20 text-rose-300 bg-rose-500/[0.03]'
                    }`}
                  >
                    <span className="text-[10px] text-gray-400 block font-medium">📈 未實現損益 / ROI%</span>
                    <div className="text-sm font-black font-mono flex items-center gap-1">
                      {metrics.unrealizedPnL >= 0 ? '+' : ''}{currSymbol}{formatNum(metrics.unrealizedPnL)}
                    </div>
                    <div className="text-[11px] font-mono font-bold">
                      {metrics.unrealizedPnL >= 0 ? '+' : ''}{formatDec(metrics.unrealizedRoiPercent)}%
                    </div>
                  </div>

                  {/* Metric 3: Position Shares */}
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-2.5">
                    <span className="text-[10px] text-gray-400 block font-medium">📦 持有股數</span>
                    <div className="text-xs sm:text-sm font-mono font-bold text-gray-200 mt-0.5">
                      {formatNum(metrics.shares)} 股
                    </div>
                  </div>

                  {/* Metric 4: Avg Cost vs Current Price */}
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-2.5">
                    <span className="text-[10px] text-gray-400 block font-medium">⚖️ 加權平均持股成本</span>
                    <div className="text-xs sm:text-sm font-mono font-bold text-gray-200 mt-0.5">
                      {currSymbol}{formatDec(metrics.avgCost)} / 股
                    </div>
                  </div>

                  {/* Realized Profit/Loss if any */}
                  {metrics.realizedPnL !== 0 && (
                    <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-2.5 flex items-center justify-between text-xs">
                      <span className="text-amber-300 text-[11px] font-bold">已實現損益 (Realized PnL):</span>
                      <strong
                        className={`font-mono font-bold ${
                          metrics.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {metrics.realizedPnL >= 0 ? '+' : ''}{currSymbol}{formatNum(metrics.realizedPnL)}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Card Footer: 4 Equal-Width Clean Action Buttons */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    onClick={() => setActiveChartStock(stock)}
                    className="py-2 px-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                    title="歷史走勢與 K 線圖"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>走勢</span>
                  </button>
                  <button
                    onClick={() => handleOpenAddModal(stock)}
                    className="py-2 px-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/25 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                    title="加碼/減碼交易"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>交易</span>
                  </button>
                  <button
                    onClick={() => setActiveHistoryStock(stock)}
                    className="py-2 px-1 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="買賣交易明細"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>明細</span>
                  </button>
                  <button
                    onClick={() => setActiveActionStock(stock)}
                    className="py-2 px-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/25 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                    title="更多功能 (公司行動、除權息、分割、減資、刪除)"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                    <span>更多</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Modal: Quick Action Sheet for Compact List Row Tap */}
      <StockActionSheetModal
        stock={activeActionStock}
        detectedSplitsMap={detectedSplitsMap}
        detectedDividendsMap={detectedDividendsMap}
        detectedRightsMap={detectedRightsMap}
        onClose={() => setActiveActionStock(null)}
        onOpenChart={(stock) => setActiveChartStock(stock)}
        onOpenTrade={(stock) => handleOpenAddModal(stock)}
        onOpenHistory={(stock) => setActiveHistoryStock(stock)}
        onOpenSplit={(stock, splitEvent) => setActiveSplitModal({ stock, splitEvent })}
        onOpenReduction={(stock) => setActiveReductionStock(stock)}
        onOpenDividend={(stock, dividendEvent) => setActiveDividendModal({ stock, dividendEvent })}
        onOpenRight={(stock, rightEvent) => setActiveRightModal({ stock, rightEvent })}
        onViewDividendCalendar={() => setPortfolioSubTab('dividend_calendar')}
        onDeleteStock={(stockId) => handleDeleteStockEntirely(stockId)}
      />

      {/* Modal: Add / Edit Transaction Form */}
      <StockTradeModal
        isOpen={isAddModalOpen}
        editingStock={editingTradeStock}
        editingTx={editingTradeTx}
        defaultMarket={filterMarket === 'TW' ? 'TW' : 'US'}
        twStockFeeRate={fireConfig?.twStockFeeRate ?? 0.0399}
        usStockFeeRate={fireConfig?.usStockFeeRate ?? 0}
        themePrimaryHex={currentTheme.primaryHex}
        isSaving={isSaving}
        onOpenFeeSettings={() => setIsFeeSettingsModalOpen(true)}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTradeStock(null);
          setEditingTradeTx(null);
        }}
        onSave={(data, overrideInitialHoldings) => handleSaveTransaction(data, overrideInitialHoldings)}
      />

      {/* Modal: Stock Transaction History & Detail Breakdown */}
      <StockHistoryModal
        stock={activeHistoryStock}
        detectedSplitsMap={detectedSplitsMap}
        detectedDividendsMap={detectedDividendsMap}
        detectedRightsMap={detectedRightsMap}
        onClose={() => setActiveHistoryStock(null)}
        onOpenAddTrade={(stock) => handleOpenAddModal(stock)}
        onOpenEditTrade={(stock, tx) => handleOpenEditModal(stock, tx)}
        onDeleteTrade={(stockId, txId) => handleDeleteSingleTransaction(stockId, txId)}
        onOpenSplit={(stock, splitEvent) => setActiveSplitModal({ stock, splitEvent })}
        onOpenReduction={(stock) => setActiveReductionStock(stock)}
        onOpenDividend={(stock, dividendEvent) => setActiveDividendModal({ stock, dividendEvent })}
        onOpenRight={(stock, rightEvent) => setActiveRightModal({ stock, rightEvent })}
      />

      {/* Insufficient Cash Warning Dialog Modal */}
      <InsufficientCashModal
        isOpen={Boolean(cashAlertModal?.isOpen)}
        stockName={cashAlertModal?.stockName || ''}
        isUS={Boolean(cashAlertModal?.isUS)}
        tradeCost={cashAlertModal?.tradeCost || 0}
        currentCash={cashAlertModal?.currentCash || 0}
        shortage={cashAlertModal?.shortage || 0}
        onConfirmInitialHoldings={() => {
          if (cashAlertModal?.onConfirmInitialHoldings) {
            cashAlertModal.onConfirmInitialHoldings();
          }
        }}
        onConfirmForceDeduct={() => {
          if (cashAlertModal?.onConfirmForceDeduct) {
            cashAlertModal.onConfirmForceDeduct();
          }
        }}
        onClose={() => setCashAlertModal(null)}
      />

      {/* Styled Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmModal?.isOpen)}
        title={confirmModal?.title || '確定要執行？'}
        message={confirmModal?.message || ''}
        type={confirmModal?.type || 'danger'}
        isAlert={confirmModal?.isAlert}
        confirmText={confirmModal?.confirmText || '確定'}
        cancelText={confirmModal?.isAlert ? null : '取消'}
        onConfirm={() => {
          if (confirmModal?.onConfirm) {
            confirmModal.onConfirm();
          }
        }}
        onClose={() => setConfirmModal(null)}
      />

      {/* Interactive Stock Historical Chart & Candlestick Modal */}
      {activeChartStock && (
        <StockChartModal
          stock={activeChartStock}
          usdRate={usdRate}
          currencySymbol={activeChartStock.currency === 'USD' ? '$' : sym}
          onUpdateStockPrice={(stockSym, newPrice) => {
            const symUp = stockSym.toUpperCase();
            const rawCode = symUp.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
            const target = syncedStocks.find((s) => {
              const sUpper = s.symbol.toUpperCase();
              const sRaw = sUpper.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
              return sUpper === symUp || sRaw === rawCode;
            });
            if (!target || target.currentPrice === newPrice) return;

            const updated = syncedStocks.map((s) => {
              const sUpper = s.symbol.toUpperCase();
              const sRaw = sUpper.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
              if (sUpper === symUp || sRaw === rawCode) {
                return syncStockCalculations({
                  ...s,
                  currentPrice: newPrice,
                  lastUpdated: new Date().toISOString(),
                });
              }
              return s;
            });
            onUpdateStocks(updated, { syncToCloud: false });
          }}
          onBuyStock={(targetStock) => {
            setActiveChartStock(null);
            handleOpenAddModal(targetStock);
          }}
          onClose={() => setActiveChartStock(null)}
        />
      )}

      {/* Modal: Global Stock Trading Fee Settings Modal */}
      <StockFeeSettingsModal
        isOpen={isFeeSettingsModalOpen}
        initialTwFeeRate={fireConfig?.twStockFeeRate ?? 0.0399}
        initialUsFeeRate={fireConfig?.usStockFeeRate ?? 0}
        themePrimaryHex={currentTheme.primaryHex}
        onSave={(twRate, usRate) => {
          updateFIREConfig({
            ...fireConfig,
            twStockFeeRate: twRate,
            usStockFeeRate: usRate,
          });
        }}
        onClose={() => setIsFeeSettingsModalOpen(false)}
      />

      {/* Modal: Interactive Stock Split Modal */}
      {activeSplitModal && (
        <StockSplitModal
          isOpen={Boolean(activeSplitModal)}
          stock={activeSplitModal.stock}
          splitEvent={activeSplitModal.splitEvent}
          currencySymbol={activeSplitModal.stock.currency === 'USD' ? '$' : sym}
          onConfirm={(splitData) => handleConfirmSplit(activeSplitModal.stock, splitData)}
          onClose={() => setActiveSplitModal(null)}
        />
      )}

      {/* Modal: Interactive Stock Capital Reduction Modal */}
      {activeReductionStock && (
        <StockCapitalReductionModal
          isOpen={Boolean(activeReductionStock)}
          stock={activeReductionStock}
          currencySymbol={activeReductionStock.currency === 'USD' ? '$' : sym}
          onConfirm={(reductionData) => handleConfirmReduction(activeReductionStock, reductionData)}
          onClose={() => setActiveReductionStock(null)}
        />
      )}

      {/* Modal: Interactive Stock Cash Dividend Modal */}
      {activeDividendModal && (
        <StockDividendModal
          isOpen={Boolean(activeDividendModal)}
          stock={activeDividendModal.stock}
          dividendEvent={activeDividendModal.dividendEvent}
          currencySymbol={activeDividendModal.stock.currency === 'USD' ? '$' : sym}
          onConfirm={(divData) => handleConfirmDividend(activeDividendModal.stock, divData)}
          onClose={() => setActiveDividendModal(null)}
        />
      )}

      {/* Modal: Interactive Stock Right (Stock Dividend / 配股) Modal */}
      {activeRightModal && (
        <StockRightModal
          isOpen={Boolean(activeRightModal)}
          stock={activeRightModal.stock}
          rightEvent={activeRightModal.rightEvent}
          currencySymbol={activeRightModal.stock.currency === 'USD' ? '$' : sym}
          onConfirm={(rightData) => handleConfirmRight(activeRightModal.stock, rightData)}
          onClose={() => setActiveRightModal(null)}
        />
      )}
    </div>
  );
};
