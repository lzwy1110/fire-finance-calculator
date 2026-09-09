import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Calendar, Settings, RefreshCw } from 'lucide-react';
import { MarketType, PortfolioStock, StockTransaction } from '../../types';
import { searchStockSuggestionsAsync, StockSearchResult } from '../../services/stockPriceService';

export interface StockTradeFormData {
  editingTxId: string | null;
  tradeType: 'BUY' | 'SELL';
  symbol: string;
  name: string;
  market: MarketType;
  shares: number;
  cost: number;
  price: number;
  date: string;
  note: string;
  isInitialHoldings: boolean;
  netTradeTotal: number;
}

export interface StockTradeModalProps {
  isOpen: boolean;
  editingStock: PortfolioStock | null;
  editingTx: StockTransaction | null;
  defaultMarket: MarketType;
  twStockFeeRate: number;
  usStockFeeRate: number;
  themePrimaryHex: string;
  isSaving: boolean;
  onOpenFeeSettings: () => void;
  onClose: () => void;
  onSave: (data: StockTradeFormData) => void;
}

export const StockTradeModal: React.FC<StockTradeModalProps> = ({
  isOpen,
  editingStock,
  editingTx,
  defaultMarket,
  twStockFeeRate,
  usStockFeeRate,
  themePrimaryHex,
  isSaving,
  onOpenFeeSettings,
  onClose,
  onSave,
}) => {
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [symbolInput, setSymbolInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [marketInput, setMarketInput] = useState<MarketType>(defaultMarket);
  const [sharesInput, setSharesInput] = useState<string>('');
  const [costInput, setCostInput] = useState<string>('');
  const [priceInput, setPriceInput] = useState<number>(0);
  const [dateInput, setDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [noteInput, setNoteInput] = useState<string>('');
  const [isInitialHoldingsInput, setIsInitialHoldingsInput] = useState<boolean>(false);
  const [feeRateInput, setFeeRateInput] = useState<string>('0');
  const [showFeeDetails, setShowFeeDetails] = useState(false);

  // Cash Capital Increase (現增認股) Calculator State
  const [showIncreaseCalc, setShowIncreaseCalc] = useState(false);
  const [sharesPerThousandInput, setSharesPerThousandInput] = useState<string>('50');
  const [subPriceInput, setSubPriceInput] = useState<string>('');

  // Autocomplete Suggestions State
  const [searchSuggestions, setSearchSuggestions] = useState<StockSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchSeqRef = useRef<number>(0);

  // Initialize or reset when modal opens or target changes
  useEffect(() => {
    if (isOpen) {
      if (editingTx && editingStock) {
        setTradeType(editingTx.type === 'SELL' ? 'SELL' : 'BUY');
        setSymbolInput(editingStock.symbol);
        setNameInput(editingStock.name);
        setMarketInput(editingStock.market);
        setSharesInput(String(editingTx.shares));
        setCostInput(String(editingTx.price));
        setDateInput(editingTx.date || new Date().toISOString().split('T')[0]);
        setNoteInput(editingTx.note || '');
        setIsInitialHoldingsInput(Boolean(editingTx.isInitialHoldings));
        setPriceInput(editingStock.currentPrice);
        setFeeRateInput(String(editingStock.market === 'TW' ? twStockFeeRate : usStockFeeRate));
      } else if (editingStock) {
        setTradeType('BUY');
        setSymbolInput(editingStock.symbol);
        setNameInput(editingStock.name);
        setMarketInput(editingStock.market);
        setPriceInput(editingStock.currentPrice);
        setCostInput(editingStock.currentPrice > 0 ? String(editingStock.currentPrice) : '');
        setSharesInput('');
        setDateInput(new Date().toISOString().split('T')[0]);
        setNoteInput('');
        setIsInitialHoldingsInput(false);
        setFeeRateInput(String(editingStock.market === 'TW' ? twStockFeeRate : usStockFeeRate));
      } else {
        const mkt = defaultMarket === 'TW' ? 'TW' : 'US';
        setTradeType('BUY');
        setSymbolInput('');
        setNameInput('');
        setMarketInput(mkt);
        setPriceInput(0);
        setCostInput('');
        setSharesInput('');
        setDateInput(new Date().toISOString().split('T')[0]);
        setNoteInput('');
        setIsInitialHoldingsInput(false);
        setFeeRateInput(String(mkt === 'TW' ? twStockFeeRate : usStockFeeRate));
      }
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  }, [isOpen, editingStock, editingTx, defaultMarket, twStockFeeRate, usStockFeeRate]);

  // Handle symbol input change with debounce autocomplete
  const handleSymbolInputChange = (val: string, currentMarket: MarketType = marketInput) => {
    setSymbolInput(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = val.trim();
    if (!trimmed) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const thisSeq = ++searchSeqRef.current;

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchStockSuggestionsAsync(trimmed, currentMarket);
        if (thisSeq === searchSeqRef.current) {
          setSearchSuggestions(results);
          setShowSuggestions(results.length > 0);
        }
      } catch (e) {
        // Search error silently handled
      } finally {
        if (thisSeq === searchSeqRef.current) {
          setIsSearching(false);
        }
      }
    }, 280);
  };

  const handleMarketInputSwitch = (newMarket: MarketType) => {
    setMarketInput(newMarket);
    setFeeRateInput(String(newMarket === 'TW' ? twStockFeeRate : usStockFeeRate));
    handleSymbolInputChange(symbolInput, newMarket);
  };

  const handleSelectSuggestion = (item: StockSearchResult) => {
    setSymbolInput(item.symbol);
    setNameInput(item.name);
    setMarketInput(item.market);
    setFeeRateInput(String(item.market === 'TW' ? twStockFeeRate : usStockFeeRate));

    if (item.price && item.price > 0) {
      setPriceInput(item.price);
      if (!costInput || costInput === '0') {
        setCostInput(String(item.price));
      }
    }

    setShowSuggestions(false);
  };

  // Live fee & net total calculations
  const parsedSharesNum = parseFloat(sharesInput) || 0;
  const parsedCostNum = parseFloat(costInput) || 0;
  const rawTradeTotal = parsedSharesNum * parsedCostNum;
  const isTWTrade = marketInput === 'TW';
  const isETFTrade = isTWTrade && (symbolInput.startsWith('00') || nameInput.includes('ETF') || symbolInput.includes('00'));
  const twTaxRate = isETFTrade ? 0.001 : 0.003;
  const parsedFeeRateNum = parseFloat(feeRateInput) || 0;

  const calculatedFee = useMemo(() => {
    if (!rawTradeTotal || rawTradeTotal <= 0) return 0;
    const fee = rawTradeTotal * (parsedFeeRateNum / 100);
    if (isTWTrade) {
      return Math.max(1, Math.round(fee));
    }
    return Number(fee.toFixed(2));
  }, [rawTradeTotal, isTWTrade, parsedFeeRateNum]);

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

  if (!isOpen) return null;

  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(Math.round(num));
  const formatDec = (num: number) =>
    num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      editingTxId: editingTx?.id || null,
      tradeType,
      symbol: symbolInput,
      name: nameInput,
      market: marketInput,
      shares: parsedSharesNum,
      cost: parsedCostNum,
      price: priceInput,
      date: dateInput,
      note: noteInput,
      isInitialHoldings: isInitialHoldingsInput,
      netTradeTotal,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <form
        onSubmit={handleSubmit}
        className="bg-[#0e0e0e] border border-white/10 w-full max-w-md rounded-3xl p-4 sm:p-5 shadow-2xl text-gray-200 relative max-h-[85vh] flex flex-col animate-scaleUp"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            {editingTx ? '編輯買賣交易明細 ✏️' : '記一筆交易紀錄 📝'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded-xl cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs overflow-y-auto flex-1 min-h-0 pr-0.5 py-1">
          {editingTx ? (
            /* Edit Mode: Compact Header Banner */
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{marketInput === 'US' ? '🇺🇸' : '🇹🇼'}</span>
                <div>
                  <div className="text-sm font-black font-mono text-white flex items-center gap-2">
                    <span>{symbolInput}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      tradeType === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {tradeType === 'BUY' ? '🟢 買入紀錄' : '🔴 賣出紀錄'}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 truncate max-w-[210px]">
                    {nameInput || symbolInput}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-gray-400 font-mono px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                {marketInput === 'US' ? 'USD 美元' : 'TWD 台幣'}
              </span>
            </div>
          ) : editingStock ? (
            /* Quick Add Mode for Specified Stock */
            <div className="space-y-2.5">
              <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{marketInput === 'US' ? '🇺🇸' : '🇹🇼'}</span>
                  <div>
                    <div className="text-sm font-black font-mono text-white flex items-center gap-2">
                      <span>{symbolInput}</span>
                      {editingStock.currentPrice > 0 && (
                        <span className="text-[11px] text-emerald-400 font-normal">
                          現價 ${editingStock.currentPrice}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate max-w-[200px]">
                      {nameInput || symbolInput}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 font-mono px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                  {marketInput === 'US' ? 'USD 美元' : 'TWD 台幣'}
                </span>
              </div>

              {/* Buy / Sell Toggle Buttons */}
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
          ) : (
            /* Add Mode: Full selectors for Type, Market, Symbol, Name */
            <>
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

              {/* Stock Symbol Autocomplete Input */}
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
            </>
          )}

          {/* Cash Capital Increase (現增認股) Calculator Helper */}
          {tradeType === 'BUY' && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowIncreaseCalc(!showIncreaseCalc)}
                  className="text-xs font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>💡 現金增資認股試算</span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    {showIncreaseCalc ? '▲ 收合' : '▼ 依每仟股認購快速試算'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!noteInput.includes('現增認股')) {
                      setNoteInput((prev) => (prev ? `${prev} (現增認股)` : '現金增資認股'));
                    }
                  }}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition cursor-pointer border border-cyan-500/20"
                >
                  + 標註「現增認股」
                </button>
              </div>

              {showIncreaseCalc && (
                <div className="pt-2 border-t border-white/5 space-y-2.5 text-xs animate-fadeIn">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">
                        每仟股認購股數:
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="例如: 53"
                        value={sharesPerThousandInput}
                        onChange={(e) => setSharesPerThousandInput(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">
                        現增認購價:
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="例如: 15.0"
                        value={subPriceInput}
                        onChange={(e) => setSubPriceInput(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {editingStock && editingStock.shares > 0 ? (
                    <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl text-[11px]">
                      <span className="text-gray-400">
                        依目前在席 {formatNum(editingStock.shares)} 股：
                        <strong className="text-cyan-300 ml-1">
                          可認購 {formatNum(Math.floor((editingStock.shares / 1000) * (parseFloat(sharesPerThousandInput) || 0)))} 股
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const perK = parseFloat(sharesPerThousandInput) || 0;
                          const subP = parseFloat(subPriceInput) || 0;
                          const calculatedShares = Math.floor((editingStock.shares / 1000) * perK);
                          if (calculatedShares > 0) {
                            setSharesInput(String(calculatedShares));
                          }
                          if (subP > 0) {
                            setCostInput(String(subP));
                          }
                          if (!noteInput.includes('現增認股')) {
                            setNoteInput((prev) => (prev ? `${prev} (現增認股)` : '現金增資認股'));
                          }
                          setShowIncreaseCalc(false);
                        }}
                        className="px-2.5 py-1 rounded-lg font-bold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition border border-cyan-500/40 cursor-pointer"
                      >
                        帶入表單
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400">
                      💡 提示：輸入每仟股認購數與認購價後，可自行填入買入股數與單價並標註「現增認股」。
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 block mb-1 font-bold">
                {tradeType === 'BUY' ? '買入股數:' : '賣出股數:'}
              </label>
              <input
                type="number"
                step={marketInput === 'TW' ? '1' : 'any'}
                min="0"
                placeholder={marketInput === 'TW' ? '例如: 1000' : '例如: 1.5'}
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

          {/* Trading Settlement & Fee Calculation Breakdown Sheet */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 space-y-2 text-xs">
            {/* 1-Line Summary with Expand Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-gray-200">
                <span className="text-[11px] text-gray-400">
                  {tradeType === 'BUY' ? '💳 預估交割扣款:' : '💰 預估交割入帳:'}
                </span>
                <span className={`font-mono text-sm font-black ${tradeType === 'BUY' ? 'text-white' : 'text-emerald-400'}`}>
                  {isTWTrade ? 'NT$' : '$'} {formatNum(netTradeTotal)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowFeeDetails(!showFeeDetails)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer py-0.5 px-1.5 rounded-lg hover:bg-cyan-500/10 transition"
                >
                  <span>{showFeeDetails ? '收合 ▲' : '明細 ▼'}</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenFeeSettings}
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition cursor-pointer"
                  title="手續費率設定"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Collapsible Details */}
            {showFeeDetails && (
              <div className="space-y-1.5 pt-2 border-t border-white/5 animate-fadeIn">
                <div className="flex justify-between items-center text-gray-400 text-[11px]">
                  <span>成交總金額:</span>
                  <span className="font-mono text-white">
                    {isTWTrade ? 'NT$' : '$'} {formatNum(rawTradeTotal)}
                    {rawTradeTotal > 0 && (
                      <span className="text-[10px] text-gray-500 ml-1">
                        ({formatNum(parsedSharesNum)} 股 × ${formatDec(parsedCostNum)})
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-400 text-[11px]">
                  <span>預估券商手續費 ({feeRateInput || 0}%):</span>
                  <span className="font-mono text-cyan-300">
                    {rawTradeTotal > 0 && calculatedFee > 0
                      ? `${tradeType === 'BUY' ? '+' : '-'} ${isTWTrade ? 'NT$' : '$'} ${formatNum(calculatedFee)}`
                      : '免手續費 ($0)'}
                  </span>
                </div>

                {isTWTrade && tradeType === 'SELL' && (
                  <div className="flex justify-between items-center text-amber-300 text-[11px] bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-1">
                    <span>🏷️ 證券交易稅 ({isETFTrade ? '0.1%' : '0.3%'}):</span>
                    <span className="font-mono font-bold">- NT$ {formatNum(calculatedTax)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Option to skip cash balance deduction for pre-existing stock holdings (only for new BUY trades) */}
          {!editingTx && tradeType === 'BUY' && (
            <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-2xl p-3 flex items-center justify-between gap-3">
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
        </div>

        {/* Pinned Action Buttons Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold cursor-pointer transition"
          >
            取消
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 font-black rounded-xl text-black shadow-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50 transition active:scale-95"
            style={{ backgroundColor: themePrimaryHex }}
          >
            {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>{isSaving ? '儲存同步中...' : editingTx ? '儲存修改' : tradeType === 'BUY' ? '確認新增買入' : '確認新增賣出'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
