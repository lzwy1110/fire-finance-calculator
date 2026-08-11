import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import { FIREConfig, MarketType, PortfolioStock, StockTransaction } from '../types';
import { getThemePreset } from '../utils/theme';
import {
  batchFetchStockQuotes,
  fetchSingleStockQuote,
  searchStockSuggestionsAsync,
  StockSearchResult,
} from '../services/stockPriceService';
import { calculateStockMetrics, syncStockCalculations } from '../utils/portfolioMath';

interface PortfolioViewProps {
  stocks: PortfolioStock[];
  fireConfig: FIREConfig;
  onUpdateStocks: (newStocks: PortfolioStock[]) => void;
  onSyncNetWorthToFIRE: (totalMarketValueTWD: number) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  stocks,
  fireConfig,
  onUpdateStocks,
  onSyncNetWorthToFIRE,
}) => {
  const currentTheme = getThemePreset(fireConfig.themeColor);
  const [filterMarket, setFilterMarket] = useState<'ALL' | 'US' | 'TW'>('ALL');
  const [usdRate, setUsdRate] = useState<number>(32.5); // USD to TWD exchange rate
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);

  // Add / Record Transaction Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [symbolInput, setSymbolInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [marketInput, setMarketInput] = useState<MarketType>('US');
  const [sharesInput, setSharesInput] = useState<string>('');
  const [costInput, setCostInput] = useState<string>('');
  const [priceInput, setPriceInput] = useState<number>(0);
  const [dateInput, setDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [noteInput, setNoteInput] = useState<string>('');

  // Transaction History Modal State
  const [activeHistoryStock, setActiveHistoryStock] = useState<PortfolioStock | null>(null);

  // Autocomplete Suggestions State
  const [searchSuggestions, setSearchSuggestions] = useState<StockSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sym = fireConfig.currencySymbol || 'NT$';
  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(Math.round(num));
  const formatDec = (num: number) =>
    num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Ensure all stock items are synced with proper calculations
  const syncedStocks = stocks.map((s) => syncStockCalculations(s));

  const filteredStocks = syncedStocks.filter((s) => {
    if (filterMarket === 'US') return s.market === 'US';
    if (filterMarket === 'TW') return s.market === 'TW';
    return true;
  });

  // Aggregate Portfolio Totals
  let totalCostTWD = 0;
  let totalMarketValueTWD = 0;
  let usMarketValueUSD = 0;
  let twMarketValueTWD = 0;
  let totalRealizedPnLTWD = 0;

  syncedStocks.forEach((s) => {
    const cost = s.shares * s.avgCost;
    const value = s.shares * s.currentPrice;
    const realized = s.realizedPnL || 0;

    if (s.market === 'US') {
      totalCostTWD += cost * usdRate;
      totalMarketValueTWD += value * usdRate;
      usMarketValueUSD += value;
      totalRealizedPnLTWD += realized * usdRate;
    } else {
      totalCostTWD += cost;
      totalMarketValueTWD += value;
      twMarketValueTWD += value;
      totalRealizedPnLTWD += realized;
    }
  });

  const totalUnrealizedProfitTWD = totalMarketValueTWD - totalCostTWD;
  const totalRoiPercent = totalCostTWD > 0 ? (totalUnrealizedProfitTWD / totalCostTWD) * 100 : 0;

  // Batch Refresh All Stock Quotes from Online Endpoints
  const handleRefreshQuotes = async () => {
    setIsRefreshing(true);
    setRefreshStatus('正在為您自線上數據源抓取最新股價...');

    try {
      const stockList = syncedStocks.map((s) => ({ symbol: s.symbol, market: s.market }));
      const quotesMap = await batchFetchStockQuotes(stockList);

      let updatedCount = 0;
      const updatedStocks = syncedStocks.map((s) => {
        const symUpper = s.symbol.toUpperCase();
        const rawCode = symUpper.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
        const quote = quotesMap[symUpper] || quotesMap[`${rawCode}.TW`] || quotesMap[rawCode];

        if (quote && quote.currentPrice > 0) {
          updatedCount++;
          const updatedStock = {
            ...s,
            currentPrice: quote.currentPrice,
            name: quote.name || s.name,
            previousClose: quote.previousClose || s.previousClose,
            lastUpdated: new Date().toISOString(),
          };
          return syncStockCalculations(updatedStock);
        }
        return s;
      });

      if (updatedCount > 0) {
        onUpdateStocks(updatedStocks);
        setRefreshStatus(`✅ 已成功更新 ${updatedCount} 檔最新線上行情報價！`);
      } else {
        setRefreshStatus('⚠️ 數據源連線繁忙，現有持股價格已完好保留。');
      }
    } catch (e) {
      setRefreshStatus('⚠️ 線上服務連線失敗，現有資料已保留。');
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        setRefreshStatus(null);
      }, 2500);
    }
  };

  // Pause-then-Search 350ms Debouncing (輸入停頓後觸發完整搜尋，確保讀取用戶完整輸入)
  const handleSymbolInputChange = (val: string, currentMarket: MarketType = marketInput) => {
    setSymbolInput(val);

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
      if (!finalVal) {
        setSearchSuggestions([]);
        setShowSuggestions(false);
        setIsSearching(false);
        return;
      }
      const matches = await searchStockSuggestionsAsync(finalVal, currentMarket);
      setSearchSuggestions(matches);
      setShowSuggestions(matches.length > 0);
      setIsSearching(false);
    }, 350);
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
      setRefreshStatus(`✅ 已帶入 ${item.symbol} 最新實時股價 $${item.price}`);
      setTimeout(() => setRefreshStatus(null), 2000);
      return;
    }

    setRefreshStatus(`正在連線數據源獲取 ${item.symbol} 最新成交價格...`);
    const quote = await fetchSingleStockQuote(item.symbol, item.market);
    if (quote && quote.currentPrice > 0) {
      setPriceInput(quote.currentPrice);
      if (quote.name) setNameInput(quote.name);
      setRefreshStatus(`✅ 已獲取 ${item.symbol} 最新市價 $${quote.currentPrice}`);
    } else {
      setRefreshStatus(null);
    }
    setTimeout(() => setRefreshStatus(null), 2000);
  };

  // Open Modal for Add New Transaction / Stock
  const handleOpenAddModal = (targetStock?: PortfolioStock) => {
    setTradeType('BUY');
    if (targetStock) {
      setSymbolInput(targetStock.symbol);
      setNameInput(targetStock.name);
      setMarketInput(targetStock.market);
      setPriceInput(targetStock.currentPrice);
    } else {
      setSymbolInput('');
      setNameInput('');
      setMarketInput(filterMarket === 'TW' ? 'TW' : 'US');
      setPriceInput(0);
    }
    setSharesInput('');
    setCostInput('');
    setDateInput(new Date().toISOString().split('T')[0]);
    setNoteInput('');
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setIsAddModalOpen(true);
  };

  // Save Transaction (BUY / SELL)
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSym = symbolInput.trim().toUpperCase();
    const parsedShares = parseFloat(sharesInput) || 0;
    const parsedCost = parseFloat(costInput) || 0;
    if (!cleanSym || parsedShares <= 0 || parsedCost <= 0) return;

    let initialPrice = priceInput;
    if (initialPrice <= 0) {
      const quote = await fetchSingleStockQuote(cleanSym, marketInput);
      initialPrice = quote && quote.currentPrice > 0 ? quote.currentPrice : parsedCost;
    }

    const newTx: StockTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: tradeType,
      shares: parsedShares,
      price: parsedCost,
      date: dateInput || new Date().toISOString().split('T')[0],
      note: noteInput.trim(),
    };

    // Check if stock already exists in portfolio
    const existingStockIndex = syncedStocks.findIndex(
      (s) => s.symbol.toUpperCase() === cleanSym.toUpperCase()
    );

    let updatedStocksList: PortfolioStock[];

    if (existingStockIndex >= 0) {
      // Append transaction to existing stock
      const existing = syncedStocks[existingStockIndex];
      const updatedTxArray = [newTx, ...(existing.transactions || [])];
      const updatedStockObj = syncStockCalculations({
        ...existing,
        name: nameInput.trim() || existing.name,
        currentPrice: initialPrice,
        transactions: updatedTxArray,
      });

      updatedStocksList = [...syncedStocks];
      updatedStocksList[existingStockIndex] = updatedStockObj;
    } else {
      // Create new stock entry with initial transaction
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

      updatedStocksList = [syncStockCalculations(newStockObj), ...syncedStocks];
    }

    onUpdateStocks(updatedStocksList);
    setIsAddModalOpen(false);

    // Keep active history modal updated if open
    if (activeHistoryStock) {
      const refreshedActive = updatedStocksList.find(
        (s) => s.symbol.toUpperCase() === cleanSym.toUpperCase()
      );
      if (refreshedActive) setActiveHistoryStock(refreshedActive);
    }
  };

  // Delete Single Transaction Record
  const handleDeleteTransaction = (stockId: string, txId: string) => {
    const targetStock = syncedStocks.find((s) => s.id === stockId);
    if (!targetStock) return;

    if (window.confirm('確定要刪除這筆買賣交易明細嗎？')) {
      const remainingTx = targetStock.transactions.filter((t) => t.id !== txId);
      const updatedStock = syncStockCalculations({
        ...targetStock,
        transactions: remainingTx,
      });

      let updatedList: PortfolioStock[];
      if (remainingTx.length === 0 && updatedStock.shares === 0) {
        // Remove stock entirely if no transactions left
        updatedList = syncedStocks.filter((s) => s.id !== stockId);
        setActiveHistoryStock(null);
      } else {
        updatedList = syncedStocks.map((s) => (s.id === stockId ? updatedStock : s));
        setActiveHistoryStock(updatedStock);
      }

      onUpdateStocks(updatedList);
    }
  };

  // Delete Entire Stock Card
  const handleDeleteStockEntirely = (id: string) => {
    if (window.confirm('確定要整檔刪除此股票及所有交易紀錄嗎？')) {
      const updated = syncedStocks.filter((s) => s.id !== id);
      onUpdateStocks(updated);
      if (activeHistoryStock?.id === id) {
        setActiveHistoryStock(null);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner: Total Portfolio Metrics */}
      <div
        className="bg-[#0e0e0e] border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-6"
        style={{
          boxShadow: `0 0 35px rgba(${currentTheme.bgGlowRgb}, 0.15)`,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-lg"
              style={{ backgroundColor: currentTheme.primaryHex, color: '#000' }}
            >
              <TrendingUp className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                美股 🇺🇸 / 台股 🇹🇼 投資庫存估值
              </h2>
              <p className="text-xs text-gray-400">
                追蹤美股與台股持股、加權買入均價、最新股價、已實現損益與未實現 ROI%
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* USD Exchange Rate Setting */}
            <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-2xl px-3 py-1.5 text-xs text-gray-300">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>美元匯率 USD/TWD:</span>
              <input
                type="number"
                step="0.1"
                value={usdRate}
                onChange={(e) => setUsdRate(parseFloat(e.target.value) || 32.5)}
                className="w-14 bg-white/10 border border-white/10 rounded-lg px-1.5 py-0.5 text-center font-mono font-bold text-amber-400 focus:outline-none"
              />
            </div>

            {/* Auto-sync Indicator */}
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-pink-500/15 text-pink-300 border border-pink-500/30 text-xs font-bold rounded-2xl shadow-sm">
              <Flame className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
              <span>✨ 已實時自動連動 FIRE 淨資產</span>
            </div>
          </div>
        </div>

        {/* Summary Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Total Market Value */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] text-gray-400 font-medium block">目前投資總市值 (Market Value)</span>
            <div className="text-xl font-black text-white font-mono">
              {sym} {formatNum(totalMarketValueTWD)}
            </div>
            <div className="text-[10px] text-gray-400 flex items-center justify-between pt-1 border-t border-white/5">
              <span>🇺🇸 美股: <strong className="text-cyan-400 font-mono">${formatNum(usMarketValueUSD)} USD</strong></span>
              <span>🇹🇼 台股: <strong className="text-emerald-400 font-mono">${formatNum(twMarketValueTWD)}</strong></span>
            </div>
          </div>

          {/* Card 2: Total Cost */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] text-gray-400 font-medium block">投入總成本 (Principal)</span>
            <div className="text-xl font-black text-gray-200 font-mono">
              {sym} {formatNum(totalCostTWD)}
            </div>
            <p className="text-[10px] text-gray-500 pt-1 border-t border-white/5">未賣出持股成本</p>
          </div>

          {/* Card 3: Realized PnL */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] text-gray-400 font-medium block">已實現總損益 (Realized P&L)</span>
            <div className={`text-xl font-black font-mono flex items-center gap-1 ${totalRealizedPnLTWD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalRealizedPnLTWD >= 0 ? '+' : ''}{sym} {formatNum(totalRealizedPnLTWD)}
            </div>
            <p className="text-[10px] text-gray-400 pt-1 border-t border-white/5">賣出賣掉落袋為安利潤</p>
          </div>

          {/* Card 4: Unrealized Profit/Loss */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] text-gray-400 font-medium block">未實現總損益 (Unrealized)</span>
            <div className={`text-xl font-black font-mono flex items-center gap-1 ${totalUnrealizedProfitTWD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalUnrealizedProfitTWD >= 0 ? <ArrowUpRight className="w-5 h-5 stroke-[3]" /> : <ArrowDownRight className="w-5 h-5 stroke-[3]" />}
              {totalUnrealizedProfitTWD >= 0 ? '+' : ''}{sym} {formatNum(totalUnrealizedProfitTWD)}
            </div>
            <p className="text-[10px] text-gray-400 pt-1 border-t border-white/5">持股未賣出估算盈虧</p>
          </div>

          {/* Card 5: Total ROI % */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] text-gray-400 font-medium block">投資未實現 ROI%</span>
            <div className={`text-xl font-black font-mono flex items-center gap-1.5 ${totalRoiPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              <Sparkles className="w-4 h-4 text-amber-400" />
              {totalRoiPercent >= 0 ? '+' : ''}{formatDec(totalRoiPercent)} %
            </div>
            <p className="text-[10px] text-gray-400 pt-1 border-t border-white/5">目前持股未實現投報率</p>
          </div>
        </div>
      </div>

      {/* Control Bar: Filter Tabs & Batch Refresh */}
      <div className="bg-[#0c0c0c] border border-white/5 p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Market Filter Tabs */}
        <div className="flex items-center gap-2 bg-black/60 border border-white/10 p-1.5 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setFilterMarket('ALL')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              filterMarket === 'ALL'
                ? 'bg-white/15 text-white border border-white/20 shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            全部標的 ({syncedStocks.length})
          </button>

          <button
            onClick={() => setFilterMarket('US')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
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
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
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

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={handleRefreshQuotes}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-extrabold rounded-2xl transition cursor-pointer active:scale-95 shadow-md disabled:opacity-50"
            title="從線上數據源自動更新價格"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            更新最新股價
          </button>

          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-1.5 px-4 py-2 text-black font-extrabold text-xs rounded-2xl transition cursor-pointer shadow-lg active:scale-95"
            style={{
              backgroundColor: currentTheme.primaryHex,
              boxShadow: `0 0 15px rgba(${currentTheme.bgGlowRgb}, 0.3)`,
            }}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            記一筆交易 (買入/賣出)
          </button>
        </div>
      </div>

      {/* Status Alert Banner if Refreshing */}
      {refreshStatus && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-3.5 text-xs text-cyan-300 font-bold flex items-center gap-2.5 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>{refreshStatus}</span>
        </div>
      )}

      {/* Stock Holdings Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStocks.length === 0 ? (
          <div className="col-span-full bg-[#0c0c0c] border border-white/5 rounded-3xl p-12 text-center text-gray-500 text-sm">
            目前此分類下沒有持股紀錄，點擊「記一筆交易」新增買入或賣出紀錄！
          </div>
        ) : (
          filteredStocks.map((stock) => {
            const isUS = stock.market === 'US';
            const metrics = calculateStockMetrics(stock.transactions, stock.currentPrice);
            const currSymbol = isUS ? '$' : 'NT$';

            return (
              <div
                key={stock.id}
                className="bg-[#0e0e0e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl hover:border-white/20 transition group relative overflow-hidden"
              >
                {/* Badge Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{isUS ? '🇺🇸' : '🇹🇼'}</span>
                    <div>
                      <h3 className="text-base font-black text-white flex items-center gap-2 font-mono">
                        {stock.symbol}
                      </h3>
                      <p className="text-xs text-gray-400 truncate max-w-[170px]">{stock.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setActiveHistoryStock(stock)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30 rounded-xl transition cursor-pointer flex items-center gap-1"
                      title="檢視此股票所有買賣交易明細"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>交易明細 ({stock.transactions?.length || 0})</span>
                    </button>

                    <button
                      onClick={() => handleDeleteStockEntirely(stock.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                      title="整檔刪除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Price & ROI Grid */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-2.5">
                    <span className="text-gray-400 block text-[10px]">持有股數</span>
                    <strong className="text-white font-mono text-sm">{formatNum(metrics.shares)} 股</strong>
                  </div>

                  <div className="bg-black/40 border border-white/5 rounded-2xl p-2.5">
                    <span className="text-gray-400 block text-[10px]">加權均價 vs 現在價格</span>
                    <div className="font-mono text-xs font-bold text-gray-200">
                      <span className="text-gray-400">{currSymbol}{formatDec(metrics.avgCost)}</span> ➜{' '}
                      <span className="text-cyan-300 font-bold">{currSymbol}{formatDec(stock.currentPrice)}</span>
                    </div>
                  </div>

                  <div className="bg-black/40 border border-white/5 rounded-2xl p-2.5">
                    <span className="text-gray-400 block text-[10px]">現值市值 (Market Value)</span>
                    <strong className="text-white font-mono text-xs sm:text-sm">
                      {currSymbol} {formatNum(metrics.marketValue)}
                    </strong>
                  </div>

                  <div
                    className={`bg-black/40 border rounded-2xl p-2.5 ${
                      metrics.unrealizedPnL >= 0
                        ? 'border-emerald-500/20 text-emerald-400'
                        : 'border-rose-500/20 text-rose-400'
                    }`}
                  >
                    <span className="text-gray-400 block text-[10px]">未實現損益 & ROI%</span>
                    <strong className="font-mono text-xs font-extrabold">
                      {metrics.unrealizedPnL >= 0 ? '+' : ''}
                      {currSymbol}
                      {formatNum(metrics.unrealizedPnL)} ({metrics.unrealizedPnL >= 0 ? '+' : ''}
                      {formatDec(metrics.unrealizedRoiPercent)}%)
                    </strong>
                  </div>

                  {/* Realized PnL Row if any sell transaction exists */}
                  {metrics.realizedPnL !== 0 && (
                    <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-2.5 flex items-center justify-between text-xs">
                      <span className="text-amber-300 text-[11px] font-bold">已實現獲利/虧損 (Realized PnL):</span>
                      <strong
                        className={`font-mono font-bold ${
                          metrics.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {metrics.realizedPnL >= 0 ? '+' : ''}
                        {currSymbol}
                        {formatNum(metrics.realizedPnL)}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Bottom Quick Action: Add Trade */}
                <button
                  onClick={() => handleOpenAddModal(stock)}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>對此個股加碼/減碼 (新增買賣紀錄)</span>
                </button>
              </div>
            );
          })
        )}
      </div>

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
                  className="px-5 py-2 font-black rounded-xl text-black shadow-lg cursor-pointer flex items-center gap-1.5"
                  style={{ backgroundColor: currentTheme.primaryHex }}
                >
                  <span>{tradeType === 'BUY' ? '確認新增買入紀錄' : '確認新增賣出紀錄'}</span>
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

                    <button
                      onClick={() => handleDeleteTransaction(activeHistoryStock.id, tx.id)}
                      className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                      title="刪除此筆交易紀錄"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
    </div>
  );
};
