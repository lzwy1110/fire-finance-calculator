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
} from 'lucide-react';
import { FIREConfig, MarketType, PortfolioStock } from '../types';
import { getThemePreset } from '../utils/theme';
import {
  batchFetchStockQuotes,
  fetchSingleStockQuote,
  searchStockSuggestionsAsync,
  StockSearchResult,
} from '../services/stockPriceService';

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

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<PortfolioStock | null>(null);

  // Form State
  const [symbolInput, setSymbolInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [marketInput, setMarketInput] = useState<MarketType>('US');
  const [sharesInput, setSharesInput] = useState<number>(10);
  const [costInput, setCostInput] = useState<number>(100);
  const [priceInput, setPriceInput] = useState<number>(0);

  // Autocomplete Suggestions State
  const [searchSuggestions, setSearchSuggestions] = useState<StockSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sym = fireConfig.currencySymbol || 'NT$';
  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(Math.round(num));
  const formatDec = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Calculation Metrics
  const filteredStocks = stocks.filter((s) => {
    if (filterMarket === 'US') return s.market === 'US';
    if (filterMarket === 'TW') return s.market === 'TW';
    return true;
  });

  // Total Market Value Calculation
  let totalCostTWD = 0;
  let totalMarketValueTWD = 0;
  let usMarketValueUSD = 0;
  let twMarketValueTWD = 0;

  stocks.forEach((s) => {
    const cost = s.shares * s.avgCost;
    const value = s.shares * s.currentPrice;

    if (s.market === 'US') {
      totalCostTWD += cost * usdRate;
      totalMarketValueTWD += value * usdRate;
      usMarketValueUSD += value;
    } else {
      totalCostTWD += cost;
      totalMarketValueTWD += value;
      twMarketValueTWD += value;
    }
  });

  const totalProfitTWD = totalMarketValueTWD - totalCostTWD;
  const totalRoiPercent = totalCostTWD > 0 ? (totalProfitTWD / totalCostTWD) * 100 : 0;

  // Batch Refresh All Stock Quotes from Online Endpoints
  const handleRefreshQuotes = async () => {
    setIsRefreshing(true);
    setRefreshStatus('正在為您自線上數據源抓取最新股價...');

    try {
      const stockList = stocks.map((s) => ({ symbol: s.symbol, market: s.market }));
      const quotesMap = await batchFetchStockQuotes(stockList);

      let updatedCount = 0;
      const updatedStocks = stocks.map((s) => {
        const quote = quotesMap[s.symbol.toUpperCase()];
        if (quote && quote.currentPrice > 0) {
          updatedCount++;
          return {
            ...s,
            currentPrice: quote.currentPrice,
            previousClose: quote.previousClose || s.previousClose,
            lastUpdated: new Date().toISOString(),
          };
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

  // Debounced Search Input Change with Strict Market Filtering
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
      const matches = await searchStockSuggestionsAsync(val, currentMarket);
      setSearchSuggestions(matches);
      setShowSuggestions(matches.length > 0);
      setIsSearching(false);
    }, 250);
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

    // Auto fetch live quote in background
    setRefreshStatus(`正在取得 ${item.symbol} 最新價格...`);
    const quote = await fetchSingleStockQuote(item.symbol, item.market);
    if (quote && quote.currentPrice > 0) {
      setPriceInput(quote.currentPrice);
      setRefreshStatus(`✅ 找到 ${item.symbol} 最新價 $${quote.currentPrice}`);
    } else {
      setRefreshStatus(null);
    }
    setTimeout(() => setRefreshStatus(null), 2500);
  };

  // Open Modal for Add
  const handleOpenAddModal = () => {
    setEditingStock(null);
    setSymbolInput('NVDA');
    setNameInput('NVIDIA Corporation (輝達)');
    setMarketInput('US');
    setSharesInput(10);
    setCostInput(120);
    setPriceInput(128.5);
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setIsAddModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (stock: PortfolioStock) => {
    setEditingStock(stock);
    setSymbolInput(stock.symbol);
    setNameInput(stock.name);
    setMarketInput(stock.market);
    setSharesInput(stock.shares);
    setCostInput(stock.avgCost);
    setPriceInput(stock.currentPrice);
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setIsAddModalOpen(true);
  };

  // Save Stock (Add / Edit) with Instant Modal Close & Background Fetch
  const handleSaveStock = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSym = symbolInput.trim().toUpperCase();
    if (!cleanSym || sharesInput <= 0) return;

    const initialPrice = priceInput > 0 ? priceInput : Number(costInput);

    const stockData: PortfolioStock = {
      id: editingStock ? editingStock.id : `port-${Date.now()}`,
      symbol: cleanSym,
      name: nameInput.trim() || cleanSym,
      market: marketInput,
      shares: Number(sharesInput),
      avgCost: Number(costInput),
      currentPrice: initialPrice,
      currency: marketInput === 'US' ? 'USD' : 'TWD',
      lastUpdated: new Date().toISOString(),
    };

    // Update state instantly and close modal
    let updatedList: PortfolioStock[];
    if (editingStock) {
      updatedList = stocks.map((s) => (s.id === editingStock.id ? stockData : s));
    } else {
      updatedList = [stockData, ...stocks];
    }
    onUpdateStocks(updatedList);
    setIsAddModalOpen(false);

    // Background fetch live quote for the newly saved stock
    fetchSingleStockQuote(cleanSym, marketInput).then((quote) => {
      if (quote && quote.currentPrice > 0) {
        const refreshedList = updatedList.map((s) =>
          s.symbol === cleanSym ? { ...s, currentPrice: quote.currentPrice, name: quote.name || s.name } : s
        );
        onUpdateStocks(refreshedList);
      }
    });
  };

  // Delete Stock
  const handleDeleteStock = (id: string) => {
    if (window.confirm('確定要刪除這筆股票庫存紀錄嗎？')) {
      const updated = stocks.filter((s) => s.id !== id);
      onUpdateStocks(updated);
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
                追蹤美股與台股持股、平均成本、最新股價與未實現投資報酬率 (ROI)
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

            {/* Sync Net Worth to FIRE Model Button */}
            <button
              onClick={() => onSyncNetWorthToFIRE(totalMarketValueTWD)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 text-xs font-extrabold rounded-2xl transition cursor-pointer active:scale-95 shadow-md"
              title="將目前的投資總市值同步覆蓋為 FIRE 模型中的淨資產總額"
            >
              <Flame className="w-4 h-4 text-pink-400" />
              同步至 FIRE 淨資產
            </button>
          </div>
        </div>

        {/* 4 Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Market Value */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
            <span className="text-xs text-gray-400 font-medium block">目前投資總市值 (Market Value)</span>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {sym} {formatNum(totalMarketValueTWD)}
            </div>
            <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-white/5">
              <span>🇺🇸 美股: <strong className="text-cyan-400 font-mono">${formatNum(usMarketValueUSD)} USD</strong></span>
              <span>🇹🇼 台股: <strong className="text-emerald-400 font-mono">${formatNum(twMarketValueTWD)}</strong></span>
            </div>
          </div>

          {/* Card 2: Total Cost */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
            <span className="text-xs text-gray-400 font-medium block">投入總成本 (Total Principal)</span>
            <div className="text-xl sm:text-2xl font-black text-gray-200 font-mono">
              {sym} {formatNum(totalCostTWD)}
            </div>
            <p className="text-[11px] text-gray-500 pt-1 border-t border-white/5">實際掏出本金累積金額</p>
          </div>

          {/* Card 3: Unrealized Profit/Loss */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
            <span className="text-xs text-gray-400 font-medium block">未實現總損益 (Unrealized P&L)</span>
            <div className={`text-xl sm:text-2xl font-black font-mono flex items-center gap-1 ${totalProfitTWD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalProfitTWD >= 0 ? <ArrowUpRight className="w-6 h-6 stroke-[3]" /> : <ArrowDownRight className="w-6 h-6 stroke-[3]" />}
              {totalProfitTWD >= 0 ? '+' : ''}{sym} {formatNum(totalProfitTWD)}
            </div>
            <p className="text-[11px] text-gray-400 pt-1 border-t border-white/5">未賣出前預估價值損益</p>
          </div>

          {/* Card 4: Total ROI % */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-1">
            <span className="text-xs text-gray-400 font-medium block">投資總報酬率 (Total ROI %)</span>
            <div className={`text-xl sm:text-2xl font-black font-mono flex items-center gap-1.5 ${totalRoiPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              <Sparkles className="w-5 h-5 text-amber-400" />
              {totalRoiPercent >= 0 ? '+' : ''}{formatDec(totalRoiPercent)} %
            </div>
            <p className="text-[11px] text-gray-400 pt-1 border-t border-white/5">總損益與本金之比例 %</p>
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
            全部標的 ({stocks.length})
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
            <span className="text-[10px] font-mono opacity-80">({stocks.filter((s) => s.market === 'US').length})</span>
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
            <span className="text-[10px] font-mono opacity-80">({stocks.filter((s) => s.market === 'TW').length})</span>
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
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 text-black font-extrabold text-xs rounded-2xl transition cursor-pointer shadow-lg active:scale-95"
            style={{
              backgroundColor: currentTheme.primaryHex,
              boxShadow: `0 0 15px rgba(${currentTheme.bgGlowRgb}, 0.3)`,
            }}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            新增持股
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
            目前此分類下沒有持股紀錄，點擊「新增持股」搜尋美股 (NVDA/VOO) 或台股 (2330/0050)！
          </div>
        ) : (
          filteredStocks.map((stock) => {
            const isUS = stock.market === 'US';
            const costTotal = stock.shares * stock.avgCost;
            const marketValue = stock.shares * stock.currentPrice;
            const profit = marketValue - costTotal;
            const roiPercent = costTotal > 0 ? (profit / costTotal) * 100 : 0;
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

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(stock)}
                      className="p-1.5 text-gray-400 hover:text-cyan-300 hover:bg-white/5 rounded-xl transition cursor-pointer"
                      title="編輯持股"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteStock(stock.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                      title="刪除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Price & ROI Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-2.5">
                    <span className="text-gray-400 block text-[10px]">持股股數</span>
                    <strong className="text-white font-mono text-sm">{formatNum(stock.shares)} 股</strong>
                  </div>

                  <div className="bg-black/40 border border-white/5 rounded-2xl p-2.5">
                    <span className="text-gray-400 block text-[10px]">買入單價 vs 最新價</span>
                    <div className="font-mono font-bold text-gray-200">
                      <span className="text-gray-500">{currSymbol}{stock.avgCost}</span> ➜{' '}
                      <span className="text-cyan-300 font-bold">{currSymbol}{stock.currentPrice}</span>
                    </div>
                  </div>

                  <div className="bg-black/40 border border-white/5 rounded-2xl p-2.5">
                    <span className="text-gray-400 block text-[10px]">市值 (Market Value)</span>
                    <strong className="text-white font-mono text-sm">
                      {currSymbol} {formatNum(marketValue)}
                    </strong>
                  </div>

                  <div className={`bg-black/40 border border-white/5 rounded-2xl p-2.5 ${profit >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'}`}>
                    <span className="text-gray-400 block text-[10px]">未實現損益 & ROI</span>
                    <strong className={`font-mono text-xs sm:text-sm font-extrabold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {profit >= 0 ? '+' : ''}{currSymbol}{formatNum(profit)} ({profit >= 0 ? '+' : ''}{formatDec(roiPercent)}%)
                    </strong>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add / Edit Stock Holding with Strict Market Autocomplete Filter */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0e0e0e] border border-white/10 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl text-gray-200 relative overflow-visible">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {editingStock ? '編輯持股 ✏️' : '新增股票/ETF持股 📈'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStock} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-400 block mb-1 font-bold">市場類別:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarketInputSwitch('US')}
                    className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                      marketInput === 'US' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-black/40 border-white/5 text-gray-400'
                    }`}
                  >
                    🇺🇸 美股 (USD)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarketInputSwitch('TW')}
                    className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                      marketInput === 'TW' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-black/40 border-white/5 text-gray-400'
                    }`}
                  >
                    🇹🇼 台股 (TWD)
                  </button>
                </div>
              </div>

              {/* Symbol Input with Market Filtered Autocomplete */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-400 font-bold flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    {marketInput === 'US' ? '美股' : '台股'}關鍵字/代號:
                  </label>
                  {isSearching && (
                    <span className="text-[10px] text-cyan-400 animate-pulse font-bold">
                      搜尋中...
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  placeholder={marketInput === 'US' ? '例如: NVDA, VOO, ASTS, SPCX...' : '例如: 2330, 2377, 0050, 微星...'}
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

                {/* Autocomplete Suggestions Dropdown List */}
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
                            <strong className="text-cyan-300 font-mono font-bold text-xs group-hover:text-cyan-200">
                              {item.symbol}
                            </strong>
                            <p className="text-[11px] text-gray-300 truncate max-w-[210px]">{item.name}</p>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono font-bold">
                          點擊帶入
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-bold">股票/基金名稱:</label>
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
                  <label className="text-gray-400 block mb-1 font-bold">持股股數:</label>
                  <input
                    type="number"
                    step="any"
                    value={sharesInput}
                    onChange={(e) => setSharesInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-2 text-white font-mono font-bold focus:border-cyan-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1 font-bold">買入成本價:</label>
                  <input
                    type="number"
                    step="any"
                    value={costInput}
                    onChange={(e) => setCostInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-2 text-white font-mono font-bold focus:border-cyan-500 focus:outline-none"
                    required
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
                  className="px-5 py-2 font-black rounded-xl text-black shadow-lg cursor-pointer"
                  style={{ backgroundColor: currentTheme.primaryHex }}
                >
                  {editingStock ? '儲存修改' : '新增入庫'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
