import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { FIREConfig, MarketType, PortfolioStock, StockTransaction } from '../types';
import { getThemePreset } from '../utils/theme';
import { ConfirmModal } from './ConfirmModal';
import { StockChartModal } from './StockChartModal';
import {
  batchFetchStockQuotes,
  fetchSingleStockQuote,
  searchStockSuggestionsAsync,
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
  onSaveSingleStock,
  onDeleteSingleStock,
  onSyncNetWorthToFIRE,
  onAdjustCashSavings,
  onOpenCurrencyExchange,
}) => {
  const currentTheme = getThemePreset(fireConfig.themeColor);
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

  // Add / Record Transaction Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [symbolInput, setSymbolInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [marketInput, setMarketInput] = useState<MarketType>('US');
  const [sharesInput, setSharesInput] = useState<string>('');
  const [costInput, setCostInput] = useState<string>('');
  const [priceInput, setPriceInput] = useState<number>(0);
  const [dateInput, setDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [noteInput, setNoteInput] = useState<string>('');
  const [isInitialHoldingsInput, setIsInitialHoldingsInput] = useState<boolean>(false);
  const [feeDiscountInput, setFeeDiscountInput] = useState<number>(() => {
    return typeof fireConfig?.twStockFeeDiscount === 'number' ? fireConfig.twStockFeeDiscount : 0.28;
  });
  const [customFeeRateInput, setCustomFeeRateInput] = useState<string>('0.1425');
  const [isCustomFee, setIsCustomFee] = useState<boolean>(false);

  // Computed live transaction fee & net total
  const parsedSharesNum = parseFloat(sharesInput) || 0;
  const parsedCostNum = parseFloat(costInput) || 0;
  const rawTradeTotal = parsedSharesNum * parsedCostNum;
  const isTWTrade = marketInput === 'TW';
  const isETFTrade = isTWTrade && (symbolInput.startsWith('00') || nameInput.includes('ETF') || symbolInput.includes('00'));
  const twTaxRate = isETFTrade ? 0.001 : 0.003;

  const calculatedFee = useMemo(() => {
    if (!rawTradeTotal || rawTradeTotal <= 0) return 0;
    if (isTWTrade) {
      const discount = isCustomFee ? (parseFloat(customFeeRateInput) || 0.1425) / 0.1425 : feeDiscountInput;
      const baseFee = rawTradeTotal * 0.001425 * discount;
      return Math.max(1, Math.round(baseFee));
    }
    return 0;
  }, [rawTradeTotal, isTWTrade, isCustomFee, customFeeRateInput, feeDiscountInput]);

  const calculatedTax = useMemo(() => {
    if (!rawTradeTotal || rawTradeTotal <= 0 || tradeType !== 'SELL') return 0;
    if (isTWTrade) {
      return Math.round(rawTradeTotal * twTaxRate);
    }
    return 0;
  }, [rawTradeTotal, tradeType, isTWTrade, twTaxRate]);

  const netTradeTotal = useMemo(() => {
    if (tradeType === 'BUY') {
      return rawTradeTotal + calculatedFee;
    } else {
      return Math.max(0, rawTradeTotal - calculatedFee - calculatedTax);
    }
  }, [rawTradeTotal, calculatedFee, calculatedTax, tradeType]);

  // Transaction History Modal State
  const [activeHistoryStock, setActiveHistoryStock] = useState<PortfolioStock | null>(null);

  // Stock Chart & K-Line Modal State
  const [activeChartStock, setActiveChartStock] = useState<PortfolioStock | null>(null);

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

  // Autocomplete Suggestions State
  const [searchSuggestions, setSearchSuggestions] = useState<StockSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchSeqRef = useRef<number>(0);

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
        onUpdateStocks(updatedStocks, { syncToCloud });
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

  // Fast Live Search Input Change (Connected via /api/search Proxy on Web & CapacitorHttp on Mobile)
  const handleSymbolInputChange = (val: string, currentMarket: MarketType = marketInput) => {
    setSymbolInput(val);
    const currentSeq = ++searchSeqRef.current;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!val.trim()) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const finalVal = val.trim();
      if (!finalVal || currentSeq !== searchSeqRef.current) {
        if (currentSeq === searchSeqRef.current) setIsSearching(false);
        return;
      }
      try {
        const matches = await searchStockSuggestionsAsync(finalVal, currentMarket);
        if (currentSeq === searchSeqRef.current) {
          setSearchSuggestions(matches);
          setShowSuggestions(matches.length > 0);
          setIsSearching(false);
        }
      } catch (e) {
        if (currentSeq === searchSeqRef.current) {
          setSearchSuggestions([]);
          setShowSuggestions(false);
          setIsSearching(false);
        }
      }
    }, 80);
  };

  // Market Tab Switch in Modal
  const handleMarketInputSwitch = (newMarket: MarketType) => {
    setMarketInput(newMarket);
    if (symbolInput.trim()) {
      handleSymbolInputChange(symbolInput, newMarket);
    }
  };

  // Select Suggestion Item from Autocomplete Dropdown List
  const handleSelectSuggestion = async (item: StockSearchResult) => {
    setSymbolInput(item.symbol);
    setNameInput(item.name);
    setMarketInput(item.market);
    setShowSuggestions(false);

    if (item.price && item.price > 0) {
      setPriceInput(item.price);
      if (!costInput || parseFloat(costInput) <= 0) {
        setCostInput(String(item.price));
      }
      setRefreshStatus(`✅ 已帶入 ${item.symbol} 最新實時股價 $${item.price}`);
      setTimeout(() => setRefreshStatus(null), 2000);
      return;
    }

    setRefreshStatus(`正在連線數據源獲取 ${item.symbol} 最新成交價格...`);
    const quote = await fetchSingleStockQuote(item.symbol, item.market);
    if (quote && quote.currentPrice > 0) {
      setPriceInput(quote.currentPrice);
      if (!costInput || parseFloat(costInput) <= 0) {
        setCostInput(String(quote.currentPrice));
      }
      if (quote.name) setNameInput(quote.name);
      setRefreshStatus(`✅ 已獲取 ${item.symbol} 最新市價 $${quote.currentPrice}`);
    } else {
      setRefreshStatus(null);
    }
    setTimeout(() => setRefreshStatus(null), 2000);
  };

  // Open Modal for Add New Transaction / Stock
  const handleOpenAddModal = (targetStock?: PortfolioStock) => {
    setEditingTxId(null);
    setTradeType('BUY');
    if (targetStock) {
      setSymbolInput(targetStock.symbol);
      setNameInput(targetStock.name);
      setMarketInput(targetStock.market);
      setPriceInput(targetStock.currentPrice);
      setCostInput(targetStock.currentPrice > 0 ? String(targetStock.currentPrice) : '');
    } else {
      setSymbolInput('');
      setNameInput('');
      setMarketInput(filterMarket === 'TW' ? 'TW' : 'US');
      setPriceInput(0);
      setCostInput('');
    }
    setSharesInput('');
    setDateInput(new Date().toISOString().split('T')[0]);
    setNoteInput('');
    setIsInitialHoldingsInput(false);
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setIsAddModalOpen(true);
  };

  // Open Modal for Editing an Existing Transaction Record
  const handleOpenEditModal = (targetStock: PortfolioStock, tx: StockTransaction) => {
    setEditingTxId(tx.id);
    setTradeType(tx.type);
    setSymbolInput(targetStock.symbol);
    setNameInput(targetStock.name);
    setMarketInput(targetStock.market);
    setSharesInput(String(tx.shares));
    setCostInput(String(tx.price));
    setDateInput(tx.date || new Date().toISOString().split('T')[0]);
    setNoteInput(tx.note || '');
    setIsInitialHoldingsInput(Boolean(tx.isInitialHoldings));
    setPriceInput(targetStock.currentPrice);
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setIsAddModalOpen(true);
  };

  // Save Transaction (BUY / SELL / EDIT)
  const handleSaveTransaction = async (e?: React.FormEvent, overrideInitialHoldings?: boolean) => {
    if (e) e.preventDefault();
    const cleanSym = symbolInput.trim().toUpperCase();
    const parsedShares = parseFloat(sharesInput) || 0;
    let parsedCost = parseFloat(costInput) || 0;
    if (parsedCost <= 0 && priceInput > 0) {
      parsedCost = priceInput;
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

    const useInitialHoldings =
      typeof overrideInitialHoldings === 'boolean'
        ? overrideInitialHoldings
        : tradeType === 'BUY'
        ? isInitialHoldingsInput
        : false;

    // Validate cash balance for BUY trade if deducting cash (only on new add)
    if (!editingTxId && tradeType === 'BUY' && !useInitialHoldings && typeof overrideInitialHoldings === 'undefined') {
      const isUS = marketInput === 'US';
      const tradeCost = parsedShares * parsedCost;
      const availableCash = isUS ? currentUSD : currentTWD;

      if (availableCash < tradeCost) {
        const shortage = tradeCost - availableCash;
        setCashAlertModal({
          isOpen: true,
          stockName: nameInput.trim() || cleanSym,
          isUS,
          tradeCost,
          currentCash: availableCash,
          shortage,
          onConfirmInitialHoldings: () => {
            setCashAlertModal(null);
            handleSaveTransaction(undefined, true);
          },
          onConfirmForceDeduct: () => {
            setCashAlertModal(null);
            handleSaveTransaction(undefined, false);
          },
        });
        return;
      }
    }

    const initialPrice = priceInput > 0 ? priceInput : parsedCost;

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
        const oldTradeAmt = oldTx ? (oldTx.shares || 0) * (oldTx.price || 0) : 0;
        const newTradeAmt = parsedShares * parsedCost;
        const isUS = marketInput === 'US';

        const updatedTxs = (existingStock.transactions || []).map((t) => {
          if (t.id === editingTxId) {
            return {
              ...t,
              type: tradeType,
              shares: parsedShares,
              price: parsedCost,
              date: dateInput || t.date,
              note: noteInput.trim(),
              isInitialHoldings: useInitialHoldings,
            };
          }
          return t;
        });

        const updatedStockObj = syncStockCalculations({
          ...existingStock,
          name: nameInput.trim() || existingStock.name,
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

        // Cash reconciliation
        if (onAdjustCashSavings && oldTx) {
          if (oldTx.type === 'BUY' && !oldTx.isInitialHoldings) {
            onAdjustCashSavings(+oldTradeAmt, isUS ? 'USD' : 'TWD');
          } else if (oldTx.type === 'SELL') {
            onAdjustCashSavings(-oldTradeAmt, isUS ? 'USD' : 'TWD');
          }
          if (tradeType === 'BUY' && !useInitialHoldings) {
            onAdjustCashSavings(-newTradeAmt, isUS ? 'USD' : 'TWD');
          } else if (tradeType === 'SELL') {
            onAdjustCashSavings(+newTradeAmt, isUS ? 'USD' : 'TWD');
          }
        }

        setIsAddModalOpen(false);
        setEditingTxId(null);

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
        date: dateInput || new Date().toISOString().split('T')[0],
        note: noteInput.trim(),
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
          name: nameInput.trim() || existingStock.name,
          currentPrice: initialPrice,
          transactions: updatedTxArray,
        });
      } else {
        const newStockObj: PortfolioStock = {
          id: `port-${Date.now()}`,
          symbol: cleanSym,
          name: nameInput.trim() || cleanSym,
          market: marketInput,
          shares: parsedShares,
          avgCost: parsedCost,
          currentPrice: initialPrice,
          currency: marketInput === 'US' ? 'USD' : 'TWD',
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
      const isUS = marketInput === 'US';
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

      if (filterMarket !== 'ALL' && filterMarket !== marketInput) {
        setFilterMarket('ALL');
      }
      setIsAddModalOpen(false);
      setEditingTxId(null);

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
    const txDesc = targetTx ? `${targetTx.type === 'BUY' ? '買入' : '賣出'} ${targetTx.shares} 股 @ $${targetTx.price}` : '這筆交易';

    setConfirmModal({
      isOpen: true,
      title: '確定要刪除這筆交易明細？',
      message: `確定要刪除股票「${targetStock.name} (${targetStock.symbol})」的 ${txDesc} 交易紀錄嗎？刪除後持股與買入均價將重新計算。`,
      onConfirm: async () => {
        const remainingTx = targetStock.transactions.filter((t) => t.id !== txId);
        const updatedStock = syncStockCalculations({
          ...targetStock,
          transactions: remainingTx,
        });

        // Refund/revert cash if deleting trade in matching currency
        if (targetTx && onAdjustCashSavings) {
          const isUS = targetStock.market === 'US';
          const tradeAmt = (targetTx.shares || 0) * (targetTx.price || 0);
          if (targetTx.type === 'BUY' && !targetTx.isInitialHoldings) {
            onAdjustCashSavings(+tradeAmt, isUS ? 'USD' : 'TWD');
          } else if (targetTx.type === 'SELL') {
            onAdjustCashSavings(-tradeAmt, isUS ? 'USD' : 'TWD');
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

          {/* Col 2: Cash Reserves (Full Dual-Currency Display, NEVER truncated) */}
          <div className="bg-[#121216] border border-white/5 rounded-2xl p-3 flex sm:flex-col items-center sm:items-start justify-between">
            <span className="text-[11px] text-emerald-400/90 block font-medium">雙幣現金儲備</span>
            <div className="text-sm sm:text-base font-black text-emerald-300 font-mono mt-0.5 whitespace-nowrap flex items-center gap-1.5">
              <span>NT$ {formatNum(currentTWD)}</span>
              {currentUSD > 0 && (
                <span className="text-xs text-gray-400 font-mono font-normal">
                  (${formatNum(currentUSD)} USD)
                </span>
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

        {/* Row 2: Full Width Modern Primary Action Button */}
        <div className="pt-1">
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

            return (
              <div
                key={stock.id}
                onClick={() => setActiveActionStock(stock)}
                className="p-3.5 sm:p-4 hover:bg-white/[0.04] active:bg-white/[0.08] transition cursor-pointer flex items-center justify-between gap-3 group"
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

            return (
              <div
                key={stock.id}
                className="bg-[#0e0e0e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl hover:border-white/20 transition group relative overflow-hidden"
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
                    onClick={() => handleDeleteStockEntirely(stock.id)}
                    className="py-2 px-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="刪除此股票"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>刪除</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Quick Action Sheet for Compact List Row Tap */}
      {activeActionStock && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setActiveActionStock(null)}
        >
          <div
            className="bg-[#0e0e0e] border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl text-gray-200 relative animate-slideUp sm:animate-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Indicator Handle */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{activeActionStock.market === 'US' ? '🇺🇸' : '🇹🇼'}</span>
                <div>
                  <h3 className="text-lg font-black font-mono text-white tracking-tight">
                    {activeActionStock.symbol}
                  </h3>
                  <p className="text-xs text-gray-400 truncate max-w-[220px]">{activeActionStock.name}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveActionStock(null)}
                className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-2xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4 Large Action Buttons */}
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              <button
                onClick={() => {
                  const s = activeActionStock;
                  setActiveActionStock(null);
                  setActiveChartStock(s);
                }}
                className="p-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-2xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-white">查看歷史走勢與 K 線圖</div>
                    <div className="text-xs text-emerald-400 font-normal">即時報價、分時與均線分析</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  const s = activeActionStock;
                  setActiveActionStock(null);
                  handleOpenAddModal(s);
                }}
                className="p-3.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-2xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-white">記錄買入 / 賣出交易</div>
                    <div className="text-xs text-cyan-400 font-normal">加碼存股或獲利減碼</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  const s = activeActionStock;
                  setActiveActionStock(null);
                  setActiveHistoryStock(s);
                }}
                className="p-3.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 rounded-2xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-gray-300">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-white">檢視歷史交易明細</div>
                    <div className="text-xs text-gray-400 font-normal">共 {activeActionStock.transactions?.length || 0} 筆過往買賣紀錄</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  const s = activeActionStock;
                  setActiveActionStock(null);
                  handleDeleteStockEntirely(s.id);
                }}
                className="p-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-2xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-white">刪除此股票持股</div>
                    <div className="text-xs text-rose-400 font-normal">從庫存中完整移除</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Add / Record Transaction Form */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0e0e0e] border border-white/10 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl text-gray-200 relative overflow-visible">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                記一筆交易紀錄 📝
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4 text-xs">
              {/* Buy / Sell Toggle Buttons */}
              <div>
                <label className="text-gray-400 block mb-1 font-bold">交易類型 (BUY / SELL):</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTradeType('BUY')}
                    className={`py-2 rounded-xl font-extrabold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      tradeType === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg'
                        : 'bg-black/40 border-white/5 text-gray-400'
                    }`}
                  >
                    <span>🟢 買入 (BUY)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeType('SELL')}
                    className={`py-2 rounded-xl font-extrabold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      tradeType === 'SELL'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-lg'
                        : 'bg-black/40 border-white/5 text-gray-400'
                    }`}
                  >
                    <span>🔴 賣出 (SELL)</span>
                  </button>
                </div>
              </div>

              {/* Market Type Switch */}
              <div>
                <label className="text-gray-400 block mb-1 font-bold">市場類別:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarketInputSwitch('US')}
                    className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                      marketInput === 'US'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-black/40 border-white/5 text-gray-400'
                    }`}
                  >
                    🇺🇸 美股 (USD)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarketInputSwitch('TW')}
                    className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                      marketInput === 'TW'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-black/40 border-white/5 text-gray-400'
                    }`}
                  >
                    🇹🇼 台股 (TWD)
                  </button>
                </div>
              </div>

              {/* Symbol Input with Autocomplete */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-400 font-bold flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    {marketInput === 'US' ? '美股' : '台股'}關鍵字/代號:
                  </label>
                  {isSearching && (
                    <span className="text-[10px] text-cyan-400 animate-pulse font-bold">搜尋中...</span>
                  )}
                </div>

                <input
                  type="text"
                  placeholder={
                    marketInput === 'US' ? '例如: NVDA, VOO, ASTS...' : '例如: 2330, 2377, 0050...'
                  }
                  value={symbolInput}
                  onChange={(e) => handleSymbolInputChange(e.target.value)}
                  onFocus={() => {
                    if (symbolInput.trim()) {
                      handleSymbolInputChange(symbolInput);
                    }
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold uppercase focus:border-cyan-500 focus:outline-none"
                  required
                />

                {/* Suggestions Dropdown List */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#141414] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden divide-y divide-white/5 max-h-56 overflow-y-auto animate-fadeIn">
                    {searchSuggestions.map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-cyan-500/15 flex items-center justify-between transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{item.market === 'US' ? '🇺🇸' : '🇹🇼'}</span>
                          <div>
                            <strong className="text-cyan-300 font-mono font-bold text-xs group-hover:text-cyan-200 flex items-center gap-1.5">
                              <span>{item.symbol}</span>
                              {item.price ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  ${item.price}
                                </span>
                              ) : null}
                            </strong>
                            <p className="text-[11px] text-gray-300 truncate max-w-[210px]">{item.name}</p>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono font-bold">
                          {item.price ? '帶入最新價' : '點擊帶入'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-bold">股票/基金全名:</label>
                <input
                  type="text"
                  placeholder="可自動帶入或自行修改名稱"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1 font-bold">
                    {tradeType === 'BUY' ? '買入股數:' : '賣出股數:'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="例如: 1000"
                    value={sharesInput}
                    onChange={(e) => setSharesInput(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-2 text-white font-mono font-bold focus:border-cyan-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1 font-bold">
                    {tradeType === 'BUY' ? '買入單價:' : '賣出單價:'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="例如: 150.5"
                    value={costInput}
                    onChange={(e) => setCostInput(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-2 text-white font-mono font-bold focus:border-cyan-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1 font-bold flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-cyan-400" />
                    交易日期:
                  </label>
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-2 text-white font-mono font-bold focus:border-cyan-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1 font-bold">備註 (可選):</label>
                  <input
                    type="text"
                    placeholder="例如: 分批加碼"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-2 text-white font-bold focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Trading Fee & Tax Breakdown Box for Taiwan Stocks */}
              {isTWTrade && rawTradeTotal > 0 && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                      <span>🏷️ 券商手續費折數</span>
                    </span>
                    {/* Discount Selector Pills */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { label: '2.8折', val: 0.28 },
                        { label: '5折', val: 0.5 },
                        { label: '6折', val: 0.6 },
                        { label: '1折', val: 0.1 },
                        { label: '免手續費', val: 0 },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setFeeDiscountInput(item.val);
                            setIsCustomFee(false);
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold font-mono transition cursor-pointer ${
                            !isCustomFee && feeDiscountInput === item.val
                              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-sm'
                              : 'bg-white/5 text-gray-400 hover:text-gray-200 border border-transparent'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Real-time Fee & Tax Calculation Breakdown */}
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-400">
                      <span>成交總金額:</span>
                      <span className="font-mono font-bold text-white">NT$ {formatNum(rawTradeTotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>
                        預估券商手續費 ({feeDiscountInput === 0 ? '免手續費' : `${Math.round(feeDiscountInput * 100) / 10}折`}):
                      </span>
                      <span className="font-mono text-cyan-300">
                        {tradeType === 'BUY' ? '+' : '-'} NT$ {formatNum(calculatedFee)}
                      </span>
                    </div>
                    {tradeType === 'SELL' && (
                      <div className="flex justify-between text-gray-400">
                        <span>證券交易稅 ({isETFTrade ? 'ETF 0.1%' : '個股 0.3%'}):</span>
                        <span className="font-mono text-amber-300">- NT$ {formatNum(calculatedTax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline pt-1.5 border-t border-white/10 text-xs font-bold text-gray-200">
                      <span>{tradeType === 'BUY' ? '預計扣除總現金:' : '預計實收淨額:'}</span>
                      <span className={`font-mono text-sm font-black ${tradeType === 'BUY' ? 'text-white' : 'text-emerald-400'}`}>
                        NT$ {formatNum(netTradeTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Option to skip cash balance deduction for pre-existing stock holdings */}
              {tradeType === 'BUY' && (
                <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <label htmlFor="isInitialHoldingsToggle" className="text-xs font-black text-white flex items-center gap-1.5 cursor-pointer">
                      <span>📦 歷史現有持股建倉 (不扣除現金儲蓄)</span>
                    </label>
                    <p className="text-[11px] text-cyan-300/80">若為使用 App 前已擁有的舊持股，請勾選以避免重複扣除現金</p>
                  </div>
                  <input
                    id="isInitialHoldingsToggle"
                    type="checkbox"
                    checked={isInitialHoldingsInput}
                    onChange={(e) => setIsInitialHoldingsInput(e.target.checked)}
                    className="w-5 h-5 accent-cyan-400 rounded cursor-pointer shrink-0"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold cursor-pointer"
                >
                  取消
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 font-black rounded-xl text-black shadow-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  style={{ backgroundColor: currentTheme.primaryHex }}
                >
                  {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{isSaving ? '儲存同步中...' : tradeType === 'BUY' ? '確認新增買入紀錄' : '確認新增賣出紀錄'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Stock Transaction History & Detail Breakdown */}
      {activeHistoryStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0e0e0e] border border-white/10 w-full max-w-xl rounded-3xl p-6 space-y-5 shadow-2xl text-gray-200 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{activeHistoryStock.market === 'US' ? '🇺🇸' : '🇹🇼'}</span>
                <div>
                  <h3 className="text-lg font-black text-white font-mono flex items-center gap-2">
                    <span>{activeHistoryStock.symbol}</span>
                    <span className="text-xs font-normal text-gray-400">({activeHistoryStock.name})</span>
                  </h3>
                  <p className="text-xs text-cyan-300">買賣交易歷史與損益明細對帳單</p>
                </div>
              </div>

              <button
                onClick={() => setActiveHistoryStock(null)}
                className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Header inside Modal */}
            {(() => {
              const m = calculateStockMetrics(
                activeHistoryStock.transactions,
                activeHistoryStock.currentPrice
              );
              const currSym = activeHistoryStock.market === 'US' ? '$' : 'NT$';

              return (
                <div className="bg-black/60 border border-white/5 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] block">目前持有股數</span>
                    <strong className="text-white font-mono text-sm">{formatNum(m.shares)} 股</strong>
                  </div>

                  <div>
                    <span className="text-gray-400 text-[10px] block">加權買入均價</span>
                    <strong className="text-gray-200 font-mono text-sm">{currSym}{formatDec(m.avgCost)}</strong>
                  </div>

                  <div>
                    <span className="text-gray-400 text-[10px] block">未實現損益</span>
                    <strong
                      className={`font-mono text-sm font-bold ${
                        m.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {m.unrealizedPnL >= 0 ? '+' : ''}{currSym}{formatNum(m.unrealizedPnL)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-gray-400 text-[10px] block">已實現損益</span>
                    <strong
                      className={`font-mono text-sm font-bold ${
                        m.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {m.realizedPnL >= 0 ? '+' : ''}{currSym}{formatNum(m.realizedPnL)}
                    </strong>
                  </div>
                </div>
              );
            })()}

            {/* Transactions List */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              <div className="flex items-center justify-between text-xs font-bold text-gray-400 px-1">
                <span>交易明細紀錄列表 ({activeHistoryStock.transactions?.length || 0} 筆):</span>
                <button
                  onClick={() => {
                    const st = activeHistoryStock;
                    setActiveHistoryStock(null);
                    handleOpenAddModal(st);
                  }}
                  className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>新增一筆交易</span>
                </button>
              </div>

              {activeHistoryStock.transactions && activeHistoryStock.transactions.length > 0 ? (
                activeHistoryStock.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-3 hover:border-white/15 transition text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded-xl font-mono font-black text-[11px] ${
                          tx.type === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {tx.type === 'BUY' ? '買入 BUY' : '賣出 SELL'}
                      </span>

                      <div>
                        <div className="font-mono font-bold text-white">
                          {formatNum(tx.shares)} 股 @ ${tx.price} = ${formatNum(tx.shares * tx.price)}
                        </div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-2">
                          <span>📅 {tx.date}</span>
                          {tx.note && <span className="text-gray-500">({tx.note})</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const st = activeHistoryStock;
                          setActiveHistoryStock(null);
                          handleOpenEditModal(st, tx);
                        }}
                        className="p-1.5 text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-xl transition cursor-pointer"
                        title="編輯此筆交易紀錄"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteTransaction(activeHistoryStock.id, tx.id)}
                        className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                        title="刪除此筆交易紀錄"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 text-xs">尚無交易明細紀錄</div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-white/10">
              <button
                onClick={() => setActiveHistoryStock(null)}
                className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl cursor-pointer"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-End Modern Warning Alert Dialog Modal */}
      {warningModal?.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#121216] border border-rose-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 relative overflow-hidden transform transition-all scale-100">
            {/* Background Ambient Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-500/10">
                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="space-y-1 pr-6">
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  {warningModal.title}
                </h3>
                <p className="text-xs text-rose-400 font-semibold uppercase tracking-wider">
                  現股庫存與交易時序安全校驗
                </p>
              </div>
              <button
                onClick={() => setWarningModal(null)}
                className="absolute top-0 right-0 p-1.5 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-950/30 border border-rose-500/20 rounded-2xl p-4 space-y-2 text-sm text-gray-200 relative z-10">
              <p className="leading-relaxed font-medium">{warningModal.message}</p>
              {warningModal.details && (
                <p className="text-xs text-gray-400 pt-2 border-t border-rose-500/15 leading-relaxed">
                  💡 {warningModal.details}
                </p>
              )}
            </div>

            <div className="pt-2 relative z-10">
              <button
                onClick={() => setWarningModal(null)}
                className="w-full py-3.5 px-6 rounded-2xl font-bold text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 shadow-lg shadow-rose-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>知道了，重新調整</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-End Modern Cash Balance Warning Alert Dialog Modal */}
      {cashAlertModal?.isOpen && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#121216] border border-amber-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 relative overflow-hidden transform transition-all scale-100">
            {/* Background Ambient Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                <Coins className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="space-y-1 pr-6">
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  現金帳戶餘額不足提示 ⚠️
                </h3>
                <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
                  買入交易與現金扣除選擇
                </p>
              </div>
              <button
                onClick={() => setCashAlertModal(null)}
                className="absolute top-0 right-0 p-1.5 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-4 space-y-3 text-sm text-gray-200 relative z-10">
              <p className="leading-relaxed font-medium">
                您預計買入 <span className="text-white font-bold">{cashAlertModal.stockName}</span> 總金額為{' '}
                <span className="text-amber-300 font-bold">
                  {cashAlertModal.isUS ? '$' : 'NT$'} {formatNum(cashAlertModal.tradeCost)} {cashAlertModal.isUS ? 'USD' : ''}
                </span>，但當前{cashAlertModal.isUS ? '美金' : '台幣'}現金儲備僅有{' '}
                <span className="text-gray-300 font-bold">
                  {cashAlertModal.isUS ? '$' : 'NT$'} {formatNum(cashAlertModal.currentCash)} {cashAlertModal.isUS ? 'USD' : ''}
                </span>（尚缺 {cashAlertModal.isUS ? '$' : 'NT$'} {formatNum(cashAlertModal.shortage)}）。
              </p>
              <p className="text-xs text-amber-400 font-medium pt-2 border-t border-amber-500/15 leading-relaxed">
                💡 若這是加入 FIRE 計算器之前已持有的股票，建議選擇「轉為歷史已有倉位」而不扣除現金；若手上有台幣可先透過「💱 雙幣換匯」轉入美金。
              </p>
            </div>

            <div className="space-y-2.5 pt-1 relative z-10">
              <button
                onClick={cashAlertModal.onConfirmInitialHoldings}
                className="w-full py-3.5 px-5 rounded-2xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <span>🔘 轉為歷史已有倉位 (不扣除現金)</span>
              </button>
              <button
                onClick={cashAlertModal.onConfirmForceDeduct}
                className="w-full py-3 px-5 rounded-2xl font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <span>🔘 強制扣除現金 (允許餘額為負)</span>
              </button>
              <button
                onClick={() => setCashAlertModal(null)}
                className="w-full py-2.5 px-5 rounded-2xl font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all text-xs cursor-pointer"
              >
                取消並重新調整
              </button>
            </div>
          </div>
        </div>
      )}

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
          onClose={() => setActiveChartStock(null)}
        />
      )}
    </div>
  );
};
