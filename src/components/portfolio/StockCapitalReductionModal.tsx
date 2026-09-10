import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Scissors, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { PortfolioStock } from '../../types';

export interface StockCapitalReductionModalProps {
  isOpen: boolean;
  stock: PortfolioStock | null;
  currencySymbol?: string;
  onConfirm: (reductionData: {
    date: string;
    reductionRatio: number;
    cashRefundPerShare: number;
    cashRefundTotal: number;
    reducedShares: number;
    newShares: number;
    newAvgCost: number;
    note?: string;
  }) => void;
  onClose: () => void;
}

export const StockCapitalReductionModal: React.FC<StockCapitalReductionModalProps> = ({
  isOpen,
  stock,
  currencySymbol = 'NT$',
  onConfirm,
  onClose,
}) => {
  const [reductionDate, setReductionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [ratioPercentInput, setRatioPercentInput] = useState<string>('20');
  const [refundPerShareInput, setRefundPerShareInput] = useState<string>('2.0');
  const [noteInput, setNoteInput] = useState<string>('公司現金減資退還股款');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !stock) return null;

  const originalShares = stock.shares || 0;
  const originalAvgCost = stock.avgCost || 0;
  const originalTotalCost = originalShares * originalAvgCost;

  const ratioPercent = parseFloat(ratioPercentInput) || 0;
  const reductionRatio = ratioPercent / 100;
  const refundPerShare = parseFloat(refundPerShareInput) || 0;

  // Taiwan market round shares
  const isTW = stock.market === 'TW';
  const reducedShares = isTW
    ? Math.round(originalShares * reductionRatio)
    : Number((originalShares * reductionRatio).toFixed(4));
  const newShares = Math.max(0, originalShares - reducedShares);

  const cashRefundTotal = isTW
    ? Math.round(originalShares * refundPerShare)
    : Number((originalShares * refundPerShare).toFixed(2));

  const newTotalCost = Math.max(0, originalTotalCost - cashRefundTotal);
  const newAvgCost = newShares > 0 ? newTotalCost / newShares : 0;

  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(Math.round(num));
  const formatDec = (num: number) =>
    num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleRatioChange = (val: string) => {
    setRatioPercentInput(val);
    const parsed = parseFloat(val) || 0;
    // For TW stock with NT$10 par value, refund is usually 10 * ratio
    if (isTW) {
      setRefundPerShareInput(String(Number((10 * (parsed / 100)).toFixed(2))));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reductionRatio <= 0 || reductionRatio >= 1) return;

    setIsSubmitting(true);
    try {
      onConfirm({
        date: reductionDate,
        reductionRatio,
        cashRefundPerShare: refundPerShare,
        cashRefundTotal,
        reducedShares,
        newShares,
        newAvgCost,
        note: noteInput.trim() || '現金減資退還股款',
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0e0e0e] border border-white/10 w-full max-w-lg rounded-3xl shadow-2xl text-gray-200 relative animate-scaleUp max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>記錄現金減資 (退還股款)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 font-mono">
                  {stock.market === 'US' ? '🇺🇸 美股' : '🇹🇼 台股'}
                </span>
              </h3>
              <p className="text-xs text-gray-400 font-mono">
                {stock.symbol} • {stock.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded-xl cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4 text-xs">
            {/* Inputs Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 block mb-1 font-bold">減資基準日:</label>
              <input
                type="date"
                value={reductionDate}
                onChange={(e) => setReductionDate(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1 font-bold">減資比率 (%):</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="99.99"
                  placeholder="例如: 20"
                  value={ratioPercentInput}
                  onChange={(e) => handleRatioChange(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono">
                  %
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 block mb-1 font-bold">每股退還現金:</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="例如: 2.0"
                  value={refundPerShareInput}
                  onChange={(e) => setRefundPerShareInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono">
                  元
                </span>
              </div>
            </div>

            <div>
              <label className="text-gray-400 block mb-1 font-bold">備註 (可選):</label>
              <input
                type="text"
                placeholder="例如: 2026 現金減資退款"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Quick ratio chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] text-gray-400">常用比率:</span>
            {[
              { label: '減資 10% (退 1 元)', ratio: '10', refund: '1.0' },
              { label: '減資 20% (退 2 元)', ratio: '20', refund: '2.0' },
              { label: '減資 30% (退 3 元)', ratio: '30', refund: '3.0' },
              { label: '減資 60% (長榮式 退 6 元)', ratio: '60', refund: '6.0' },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setRatioPercentInput(item.ratio);
                  setRefundPerShareInput(item.refund);
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition cursor-pointer ${
                  ratioPercentInput === item.ratio
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                    : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Before vs After Live Calculation Card */}
          <div className="bg-white/[0.03] border border-amber-500/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300 border-b border-white/5 pb-2">
              <span>📊 減資前後財務試算與現金入帳預覽</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                每仟股換發 {Math.round(1000 * (1 - reductionRatio))} 股
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Left: Shares Change */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-gray-400 block">在庫持股數量</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-gray-400">{formatNum(originalShares)} 股</span>
                  <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-white font-bold">{formatNum(newShares)} 股</span>
                </div>
                <span className="text-[10px] text-rose-400 font-mono block">
                  銷除 -{formatNum(reducedShares)} 股 (-{ratioPercent}%)
                </span>
              </div>

              {/* Right: Cash Refund */}
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-emerald-300 font-bold block">
                  實收退還現金 (直接入帳活存)
                </span>
                <div className="font-mono text-base font-black text-emerald-300">
                  +{currencySymbol} {formatNum(cashRefundTotal)}
                </div>
                <span className="text-[10px] text-emerald-400/80 block">
                  🛡️ 資本返還，免納所得稅
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              {/* Total Cost Pool */}
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400">總投入成本池:</span>
                <div className="font-mono text-gray-300 flex items-center gap-1.5">
                  <span className="line-through text-gray-500">
                    {currencySymbol} {formatNum(originalTotalCost)}
                  </span>
                  <ArrowRight className="w-2.5 h-2.5 text-gray-400" />
                  <span className="font-bold text-white">
                    {currencySymbol} {formatNum(newTotalCost)}
                  </span>
                </div>
              </div>

              {/* Avg Buy Cost Per Share */}
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400">每股買入均價:</span>
                <div className="font-mono text-gray-300 flex items-center gap-1.5">
                  <span className="text-gray-500">
                    {currencySymbol} {formatDec(originalAvgCost)}
                  </span>
                  <ArrowRight className="w-2.5 h-2.5 text-gray-400" />
                  <span className="font-bold text-amber-300">
                    {currencySymbol} {formatDec(newAvgCost)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-300/90 leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <p>
              💡 <strong>現金減資法規說明</strong>：由公司註銷部分資本並將股款退還給股東。確認執行後，退還現金將自動加入您的現金儲備，且總投資成本相應扣減，確保報酬率與淨值精確無誤。
            </p>
          </div>

          </div>

          <div className="flex items-center justify-end gap-2.5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/10 bg-black/40 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold cursor-pointer transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || newShares <= 0}
              className="px-5 py-2 font-black rounded-xl text-black bg-amber-400 hover:bg-amber-300 shadow-lg shadow-amber-400/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 transition active:scale-95"
            >
              {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>確認執行現金減資與退款入帳</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
