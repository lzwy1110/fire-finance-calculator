import React, { useState, useMemo } from 'react';
import {
  X,
  Scissors,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Coins,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { PortfolioStock, StockSplitEvent } from '../types/portfolio';
import { calculateStockMetrics } from '../utils/portfolioMath';

interface StockSplitModalProps {
  isOpen: boolean;
  stock: PortfolioStock;
  splitEvent?: StockSplitEvent | null;
  currencySymbol?: string;
  onConfirm: (splitData: {
    ratio: number;
    numerator: number;
    denominator: number;
    date: string;
    notes?: string;
  }) => void;
  onClose: () => void;
}

const PRESET_RATIOS = [
  { label: '1 拆 10 (10:1)', num: 10, den: 1, ratio: 10 },
  { label: '1 拆 4 (4:1)', num: 4, den: 1, ratio: 4 },
  { label: '1 拆 2 (2:1)', num: 2, den: 1, ratio: 2 },
  { label: '1 拆 5 (5:1)', num: 5, den: 1, ratio: 5 },
  { label: '3 拆 1 (3:1)', num: 3, den: 1, ratio: 3 },
  { label: '1 拆 20 (20:1)', num: 20, den: 1, ratio: 20 },
  { label: '1 併 10 (1:10 併股)', num: 1, den: 10, ratio: 0.1 },
];

export const StockSplitModal: React.FC<StockSplitModalProps> = ({
  isOpen,
  stock,
  splitEvent,
  currencySymbol = '$',
  onConfirm,
  onClose,
}) => {
  const isUS = stock.market === 'US';
  const currSym = stock.currency === 'USD' ? '$' : currencySymbol;

  // Split date defaults to event date or today
  const [splitDate, setSplitDate] = useState<string>(() => {
    if (splitEvent?.date) return splitEvent.date;
    return new Date().toISOString().split('T')[0];
  });

  const [numerator, setNumerator] = useState<number>(() => splitEvent?.numerator || 10);
  const [denominator, setDenominator] = useState<number>(() => splitEvent?.denominator || 1);
  const [notes, setNotes] = useState<string>(() => {
    if (splitEvent?.splitRatioText) return `${stock.symbol} ${splitEvent.splitRatioText} 股票分割`;
    return `${stock.symbol} 1 拆 10 股票分割`;
  });

  const ratio = useMemo(() => {
    if (denominator <= 0) return 1;
    return numerator / denominator;
  }, [numerator, denominator]);

  // Current Metrics before split
  const preMetrics = useMemo(() => {
    return calculateStockMetrics(stock.transactions || [], stock.currentPrice);
  }, [stock.transactions, stock.currentPrice]);

  // Simulated Post-Split Metrics
  const postMetrics = useMemo(() => {
    const simulatedTxs = [
      ...(stock.transactions || []),
      {
        id: 'temp-preview-split',
        type: 'SPLIT' as const,
        shares: 0,
        price: 0,
        date: splitDate,
        splitRatio: ratio,
        splitNumerator: numerator,
        splitDenominator: denominator,
      },
    ];
    return calculateStockMetrics(simulatedTxs, stock.currentPrice);
  }, [stock.transactions, stock.currentPrice, splitDate, ratio, numerator, denominator]);

  // Check if the split date is before any holding existed (user held 0 shares on splitDate)
  const isSplitBeforeHolding = useMemo(() => {
    if (ratio === 1) return false;
    const txs = stock.transactions || [];
    if (txs.length === 0) return false;
    const txsBefore = txs.filter((t) => t.date <= splitDate);
    const m = calculateStockMetrics(txsBefore, 0);
    return m.shares <= 0;
  }, [stock.transactions, splitDate, ratio]);

  if (!isOpen) return null;

  const handleApplyPreset = (p: typeof PRESET_RATIOS[0]) => {
    setNumerator(p.num);
    setDenominator(p.den);
    setNotes(`${stock.symbol} ${p.label} 股票分割`);
  };

  const handleConfirm = () => {
    if (ratio <= 0 || isNaN(ratio) || isSplitBeforeHolding) return;
    onConfirm({
      ratio,
      numerator,
      denominator,
      date: splitDate,
      notes: notes.trim() || undefined,
    });
  };

  const formatNum = (v: number) => new Intl.NumberFormat('zh-TW').format(Math.round(v));
  const formatDec = (v: number, digits = 2) =>
    v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#121216] border border-purple-500/30 w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl text-gray-200 animate-scaleUp my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Scissors className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">股票分割試算與確認</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {stock.symbol}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300">
                  {isUS ? '🇺🇸 美股' : '🇹🇼 台股'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{stock.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Ratio Chips */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="text-gray-300 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>快速選擇常見分割比例</span>
            </label>
            <span className="text-[11px] text-purple-300 font-mono font-bold">
              比率: {ratio >= 1 ? `1 拆 ${ratio}` : `${1 / ratio} 併 1`} ({ratio}x)
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_RATIOS.map((p) => {
              const isSelected = numerator === p.num && denominator === p.den;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30 border border-purple-400'
                      : 'bg-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Inputs: Ratio & Date */}
        <div className="bg-black/40 border border-white/5 rounded-2xl p-3 sm:p-4 space-y-3.5 text-xs">
          {/* Ratio Transformation Card (原股 ➔ 拆換新股) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-gray-300 font-bold flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-purple-400" />
                <span>分割轉換比例 (原股 ➔ 拆換新股)</span>
              </label>
              <span className="text-[11px] font-mono font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-lg">
                {ratio >= 1 ? `1 拆 ${ratio} (${ratio}x 增股)` : `${denominator} 併 ${numerator} (${ratio}x 併股)`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Box 1: 原持股 (舊股) */}
              <div className="flex-1 bg-white/[0.04] border border-white/10 rounded-2xl p-2.5 sm:p-3 focus-within:border-purple-500 transition min-w-0">
                <div className="text-[11px] text-gray-400 font-bold mb-1 flex items-center justify-between">
                  <span>原持股 (舊股)</span>
                  <span className="text-[10px] text-gray-500 font-normal">Before</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={denominator}
                    onChange={(e) => setDenominator(Math.max(0.001, parseFloat(e.target.value) || 1))}
                    className="w-full bg-transparent text-white font-mono font-black text-sm sm:text-base focus:outline-none min-w-0"
                  />
                  <span className="text-gray-400 font-bold text-xs shrink-0">股</span>
                </div>
              </div>

              {/* Transition Indicator */}
              <div className="flex flex-col items-center justify-center shrink-0 px-1 text-purple-400">
                <span className="text-[10px] font-bold tracking-wider mb-0.5 whitespace-nowrap">
                  {ratio >= 1 ? '拆換為' : '併換為'}
                </span>
                <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shadow-sm">
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
              </div>

              {/* Box 2: 拆後新股 (新持股) */}
              <div className="flex-1 bg-purple-500/[0.08] border border-purple-500/30 rounded-2xl p-2.5 sm:p-3 focus-within:border-purple-400 transition min-w-0">
                <div className="text-[11px] text-purple-300 font-bold mb-1 flex items-center justify-between">
                  <span>拆後新股</span>
                  <span className="text-[10px] text-purple-400/80 font-normal">After</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={numerator}
                    onChange={(e) => setNumerator(Math.max(0.001, parseFloat(e.target.value) || 1))}
                    className="w-full bg-transparent text-purple-200 font-mono font-black text-sm sm:text-base focus:outline-none min-w-0"
                  />
                  <span className="text-purple-300 font-bold text-xs shrink-0">股</span>
                </div>
              </div>
            </div>
          </div>

          {/* Effective Date input */}
          <div className="pt-2 border-t border-white/5 space-y-1">
            <label className="text-gray-400 font-medium block flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>分割生效基準日</span>
            </label>
            <input
              type="date"
              value={splitDate}
              onChange={(e) => setSplitDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none transition"
            />
          </div>
        </div>

        {/* Zero Shares Timeline Warning */}
        {isSplitBeforeHolding && (
          <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-3 text-xs text-amber-300 flex items-start gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-white">⚠️ 分割基準日當天持股為 0 股</div>
              <p className="leading-relaxed text-[11px] text-amber-200/90">
                您選擇的分割基準日（{splitDate}）當天您尚未持有任何庫存，您的買入紀錄均在此日期之後。此歷史分割不會影響您後續買進的部位，因此試算數據保持不變。
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Before vs After Comparison Table */}
        <div className="bg-black/60 border border-purple-500/20 rounded-2xl overflow-hidden shadow-inner divide-y divide-white/5">
          <div className="px-3.5 py-2 bg-purple-500/10 text-purple-300 font-bold text-[11px] flex justify-between items-center">
            <span>📊 分割前後全數據即時試算對比</span>
            <span className="font-mono text-[10px] text-purple-200/80">總投入成本保持不變</span>
          </div>

          <div className="p-3 space-y-2 text-xs">
            {/* Row 1: Shares */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">持有股數</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-gray-500 line-through">{formatDec(preMetrics.shares, isUS ? 4 : 0)} 股</span>
                <ArrowRight className="w-3 h-3 text-purple-400" />
                <span className="font-bold text-purple-300 text-sm">{formatDec(postMetrics.shares, isUS ? 4 : 0)} 股</span>
              </div>
            </div>

            {/* Row 2: Average Cost */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">平均買入成本</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-gray-500 line-through">{currSym}{formatDec(preMetrics.avgCost)}</span>
                <ArrowRight className="w-3 h-3 text-purple-400" />
                <span className="font-bold text-white text-sm">{currSym}{formatDec(postMetrics.avgCost)}</span>
              </div>
            </div>

            {/* Row 3: Total Cost Basis (Invariant) */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">總投入成本</span>
              <div className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold">
                <span>{currSym}{formatNum(postMetrics.totalCost)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  不變 ✅
                </span>
              </div>
            </div>

            {/* Row 4: Current Price & Market Value */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">最新市價 / 當前總市值</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-gray-500 line-through text-[11px]">{currSym}{formatNum(preMetrics.marketValue)}</span>
                <ArrowRight className="w-3 h-3 text-purple-400" />
                <span className="font-bold text-white text-sm">{currSym}{formatNum(postMetrics.marketValue)}</span>
              </div>
            </div>

            {/* Row 5: Unrealized PnL & ROI */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">未實現損益 / 報酬率</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-gray-500 line-through text-[11px]">
                  {preMetrics.unrealizedPnL >= 0 ? '+' : ''}{currSym}{formatNum(preMetrics.unrealizedPnL)}
                </span>
                <ArrowRight className="w-3 h-3 text-purple-400" />
                <span
                  className={`font-bold ${
                    postMetrics.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {postMetrics.unrealizedPnL >= 0 ? '+' : ''}{currSym}{formatNum(postMetrics.unrealizedPnL)}
                  {' '}({postMetrics.unrealizedRoiPercent >= 0 ? '+' : ''}{postMetrics.unrealizedRoiPercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Row 6: Cash Impact */}
            <div className="flex items-center justify-between border-t border-white/5 pt-1.5 text-[11px]">
              <span className="text-gray-400 flex items-center gap-1">
                <Coins className="w-3 h-3 text-cyan-400" />
                <span>現金帳戶變動</span>
              </span>
              <span className="font-mono font-bold text-gray-300">{currSym}0 (不扣款、不入帳)</span>
            </div>
          </div>
        </div>

        {/* Security / Accounting Integrity Alert */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3 text-[11px] text-purple-200/90 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            系統將於時序中插入一筆 <span className="font-mono font-bold text-white">SPLIT</span> 分割事件記錄。歷史真實買入單價 100% 原樣保存，分割前歷史賣出的已實現損益不受任何干擾，亦支援隨時刪除還原。
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition cursor-pointer"
          >
            稍後再說
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={ratio <= 0 || isNaN(ratio) || isSplitBeforeHolding}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 ${
              isSplitBeforeHolding
                ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed border border-white/5'
                : 'bg-purple-600 hover:bg-purple-500 active:scale-95 text-white shadow-lg shadow-purple-600/30 cursor-pointer'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>{isSplitBeforeHolding ? '分割日無持股，無需套用' : '確認套用分割'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
