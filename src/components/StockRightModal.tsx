import React, { useState, useMemo } from 'react';
import {
  X,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Gift,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Coins,
} from 'lucide-react';
import { PortfolioStock, StockRightEvent } from '../types/portfolio';
import { calculateStockMetrics } from '../utils/portfolioMath';

interface StockRightModalProps {
  isOpen: boolean;
  stock: PortfolioStock;
  rightEvent?: StockRightEvent | null;
  currencySymbol?: string;
  onConfirm: (data: {
    stockDividendRatio: number;
    stockDividendPerShare: number;
    bonusShares: number;
    exDate: string;
    notes?: string;
  }) => void;
  onClose: () => void;
}

const PRESET_RIGHTS = [
  { label: '配 0.5 元 (5% / 千股配50股)', perShare: 0.5, ratio: 0.05 },
  { label: '配 1.0 元 (10% / 千股配100股)', perShare: 1.0, ratio: 0.1 },
  { label: '配 1.5 元 (15% / 千股配150股)', perShare: 1.5, ratio: 0.15 },
  { label: '配 2.0 元 (20% / 千股配200股)', perShare: 2.0, ratio: 0.2 },
];

export const StockRightModal: React.FC<StockRightModalProps> = ({
  isOpen,
  stock,
  rightEvent,
  currencySymbol = 'NT$',
  onConfirm,
  onClose,
}) => {
  const isUS = stock.market === 'US';
  const currSym = stock.currency === 'USD' ? '$' : currencySymbol;

  // Ex-rights date defaults to event date or today
  const [exDate, setExDate] = useState<string>(() => {
    if (rightEvent?.date) return rightEvent.date;
    return new Date().toISOString().split('T')[0];
  });

  // Stock dividend per share (NT$ per share, par value 10)
  const [perShare, setPerShare] = useState<number>(() => {
    if (rightEvent?.stockDividendPerShare && rightEvent.stockDividendPerShare > 0) {
      return rightEvent.stockDividendPerShare;
    }
    if (rightEvent?.stockDividendRatio && rightEvent.stockDividendRatio > 0) {
      return parseFloat((rightEvent.stockDividendRatio * 10).toFixed(4));
    }
    return 1.0;
  });

  // Calculated stock dividend ratio (e.g. 1.0 元 = 0.1 ratio)
  const ratio = useMemo(() => {
    if (perShare <= 0) return 0;
    return parseFloat((perShare / 10).toFixed(6));
  }, [perShare]);

  // Holding shares on exDate cutoff
  // Financial Rule: Stock dividends are based on shares held prior to ex-date.
  const eligibleShares = useMemo(() => {
    const txs = stock.transactions || [];
    if (txs.length === 0) return 0;
    const txsBefore = txs.filter((t) => {
      if (t.date < exDate) return true;
      if (t.date === exDate) {
        return Boolean(t.isInitialHoldings);
      }
      return false;
    });
    const m = calculateStockMetrics(txsBefore, 0);
    if (m.shares > 0) return m.shares;

    // Fallback if initial position was logged on exDate
    const fallbackTxs = txs.filter((t) => t.date <= exDate && t.type !== 'STOCK_DIVIDEND' && t.type !== 'DIVIDEND');
    const fallbackM = calculateStockMetrics(fallbackTxs, 0);
    return Math.max(0, fallbackM.shares);
  }, [stock.transactions, exDate]);

  const hasEligibleShares = eligibleShares > 0;

  // Bonus shares calculated: eligibleShares * (perShare / 10)
  const calculatedBonusShares = useMemo(() => {
    if (!hasEligibleShares || ratio <= 0) return 0;
    const raw = eligibleShares * ratio;
    return Math.round(raw * 1000) / 1000;
  }, [eligibleShares, ratio, hasEligibleShares]);

  // Custom user override for bonus shares (in case of fractional odd lots rounding by broker)
  const [bonusSharesOverride, setBonusSharesOverride] = useState<number | null>(null);
  const finalBonusShares = bonusSharesOverride !== null ? bonusSharesOverride : calculatedBonusShares;

  // Notes
  const [notes, setNotes] = useState<string>(() => {
    return `${stock.symbol} 股票股利除權配發`;
  });

  // Metrics Before vs After Simulation
  const metricsBefore = useMemo(() => {
    const txs = (stock.transactions || []).filter((t) => t.date <= exDate);
    return calculateStockMetrics(txs, stock.currentPrice || 0);
  }, [stock.transactions, stock.currentPrice, exDate]);

  const metricsAfter = useMemo(() => {
    const txs = [...(stock.transactions || [])].filter((t) => t.date <= exDate);
    const simulatedTx = [
      ...txs,
      {
        id: 'sim_right',
        type: 'STOCK_DIVIDEND' as const,
        shares: finalBonusShares,
        price: 0,
        date: exDate,
        stockDividendPerShare: perShare,
        stockDividendRatio: ratio,
      },
    ];
    return calculateStockMetrics(simulatedTx, stock.currentPrice || 0);
  }, [stock.transactions, stock.currentPrice, exDate, finalBonusShares, perShare, ratio]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isUpcoming = exDate > todayStr || rightEvent?.status === 'upcoming';

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!hasEligibleShares || finalBonusShares <= 0 || isUpcoming) return;
    onConfirm({
      stockDividendRatio: ratio,
      stockDividendPerShare: perShare,
      bonusShares: finalBonusShares,
      exDate,
      notes: notes.trim() || undefined,
    });
  };

  const formatDec = (v: number, digits = 2) =>
    v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-right-title"
        className={`w-full max-w-lg bg-gradient-to-b from-slate-900 via-neutral-900 to-black border rounded-3xl shadow-2xl p-5 sm:p-6 my-auto text-white transition-all ${
          isUpcoming ? 'border-amber-500/40 shadow-amber-500/10' : 'border-sky-500/40 shadow-sky-500/15'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-2xl border ${
                isUpcoming
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
              }`}
            >
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="stock-right-title" className="text-lg font-black tracking-tight text-white">
                  台股除權（股票股利）校正
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isUpcoming
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  }`}
                >
                  {isUpcoming ? '⏳ 未到期預報試算' : '📈 到期除權配股'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {stock.name || stock.symbol} ({stock.symbol}) · 無償配發新股，均價自動除權
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upcoming Warning Banner */}
        {isUpcoming && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">⏳ 未到除權日預報提示：</span>
              此股票預定於 <span className="font-mono font-bold text-white underline underline-offset-2">{exDate}</span> 進行除權配股。目前處於「預報試算模式」，系統將於除權基準日當天解鎖開放入帳！
            </div>
          </div>
        )}

        {/* Zero Holding Warning Banner */}
        {!hasEligibleShares && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">在席持股不足：</span>
              您在除權基準日 ({exDate}) 當天在庫持股為 0 股。若您是在除權日後才買入，無需套用此次配股。
            </div>
          </div>
        )}

        {/* Form Inputs */}
        <div className="mt-4 space-y-3.5">
          {/* Ex-Rights Date */}
          <div>
            <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>除權生效基準日 (Ex-Rights Date)</span>
            </label>
            <input
              type="date"
              value={exDate}
              onChange={(e) => setExDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Preset Buttons */}
          <div>
            <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>常用除權配股方案快捷鈕</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_RIGHTS.map((p) => (
                <button
                  key={p.perShare}
                  type="button"
                  onClick={() => {
                    setPerShare(p.perShare);
                    setBonusSharesOverride(null);
                  }}
                  className={`text-[11px] px-2.5 py-1.5 rounded-xl border font-mono text-left transition-all ${
                    Math.abs(perShare - p.perShare) < 0.001
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold shadow-sm'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stock Dividend Input & Bonus Shares */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-300 block mb-1">
                每股配發股票股利 (元)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={perShare}
                  onChange={(e) => {
                    setPerShare(Math.max(0, parseFloat(e.target.value) || 0));
                    setBonusSharesOverride(null);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-sky-500 transition-colors"
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">元</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 font-mono">
                配股率: {(ratio * 100).toFixed(2)}% (每千股配 {Math.round(ratio * 1000)} 股)
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-300 block mb-1">
                預估無償配發新股數 (可微調)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={finalBonusShares}
                  onChange={(e) => setBonusSharesOverride(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-sky-500/10 border border-sky-500/30 rounded-xl px-3 py-2 text-sm text-sky-300 font-mono font-bold focus:outline-none focus:border-sky-500 transition-colors"
                />
                <span className="absolute right-3 top-2.5 text-xs text-sky-400 font-bold">股</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                依券商對帳單如有小數點零股可手動校準
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-bold text-gray-300 block mb-1">交易註記</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="股票股利除權配發"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
        </div>

        {/* Calculation Preview Sheet */}
        <div className="mt-4 bg-black/60 border border-sky-500/20 rounded-2xl overflow-hidden shadow-inner divide-y divide-white/5 text-xs">
          <div className="px-3.5 py-2 bg-sky-500/10 text-sky-300 font-bold text-[11px] flex justify-between items-center">
            <span>🧾 除權配股前後對比與成本守恆試算</span>
            <span className="text-[10px] text-sky-200/80">總投入成本不變 · 無現金異動</span>
          </div>

          <div className="p-3.5 space-y-2.5">
            {/* Row 1: Shares */}
            <div className="flex items-center justify-between text-gray-400">
              <span>持有股數變化</span>
              <div className="flex items-center gap-2 font-mono font-bold">
                <span className="text-gray-400">{formatDec(metricsBefore.shares, 0)} 股</span>
                <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-sky-300 text-sm">
                  {formatDec(metricsBefore.shares + finalBonusShares, 0)} 股
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300">
                  +{formatDec(finalBonusShares, 0)}
                </span>
              </div>
            </div>

            {/* Row 2: Average Cost */}
            <div className="flex items-center justify-between text-gray-400">
              <span>平均買入成本 (除權稀釋)</span>
              <div className="flex items-center gap-2 font-mono font-bold">
                <span className="text-gray-400">{currSym}{formatDec(metricsBefore.avgCost)}</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-emerald-300 text-sm">{currSym}{formatDec(metricsAfter.avgCost)}</span>
              </div>
            </div>

            {/* Row 3: Total Cost (Invariant) */}
            <div className="flex items-center justify-between text-gray-400">
              <span>總投入成本池 (守恆不變)</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-gray-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currSym}{formatDec(metricsBefore.totalCost)}</span>
                <span className="text-[10px] text-emerald-400 ml-1">(守恆)</span>
              </div>
            </div>

            {/* Row 4: Cash Impact */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-gray-400">
              <span className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-gray-400" />
                <span>現金活存變動</span>
              </span>
              <span className="font-mono font-bold text-gray-300">
                $0 (無償贈股，無現金進出)
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/10 text-xs font-bold text-gray-300 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!hasEligibleShares || finalBonusShares <= 0 || isUpcoming}
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              isUpcoming
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 cursor-not-allowed opacity-75'
                : !hasEligibleShares || finalBonusShares <= 0
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-sky-500 hover:bg-sky-400 text-black font-black shadow-lg shadow-sky-500/25 active:scale-95'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isUpcoming
                ? `待 ${exDate} 除權日開放入帳`
                : !hasEligibleShares
                ? '除權日無持股'
                : `確認股票股利入帳 (+${formatDec(finalBonusShares, 0)} 股)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
