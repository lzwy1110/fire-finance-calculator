import React, { useState, useMemo } from 'react';
import {
  X,
  Coins,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  PiggyBank,
  Percent,
} from 'lucide-react';
import { PortfolioStock, StockDividendEvent } from '../types/portfolio';
import { calculateStockMetrics } from '../utils/portfolioMath';

interface StockDividendModalProps {
  isOpen: boolean;
  stock: PortfolioStock;
  dividendEvent?: StockDividendEvent | null;
  currencySymbol?: string;
  onConfirm: (dividendData: {
    amountPerShare: number;
    eligibleShares: number;
    totalGross: number;
    taxWithheld: number;
    netCash: number;
    exDate: string;
    paymentDate: string;
    notes?: string;
  }) => void;
  onClose: () => void;
}

export const StockDividendModal: React.FC<StockDividendModalProps> = ({
  isOpen,
  stock,
  dividendEvent,
  currencySymbol = '$',
  onConfirm,
  onClose,
}) => {
  const isUS = stock.market === 'US';
  const currSym = stock.currency === 'USD' ? '$' : currencySymbol;

  // Ex-dividend date
  const [exDate, setExDate] = useState<string>(() => {
    if (dividendEvent?.date) return dividendEvent.date;
    return new Date().toISOString().split('T')[0];
  });

  // Cash payment / deposit date
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    if (dividendEvent?.paymentDate) return dividendEvent.paymentDate;
    return new Date().toISOString().split('T')[0];
  });

  // Dividend per share
  const [perShareAmount, setPerShareAmount] = useState<number>(() => {
    if (typeof dividendEvent?.amount === 'number' && dividendEvent.amount > 0) {
      return dividendEvent.amount;
    }
    return isUS ? 0.5 : 1.0;
  });

  // US 30% dividend withholding tax toggle (enabled by default for US stocks)
  const [withholdUsTax, setWithholdUsTax] = useState<boolean>(() => isUS);

  // Notes
  const [notes, setNotes] = useState<string>(() => {
    return `${stock.symbol} 現金股利發放入帳`;
  });

  // Calculate eligible holding shares on or before exDate
  const eligibleShares = useMemo(() => {
    const txs = stock.transactions || [];
    if (txs.length === 0) return 0;
    const txsBefore = txs.filter((t) => t.date <= exDate);
    const m = calculateStockMetrics(txsBefore, 0);
    return Math.max(0, m.shares);
  }, [stock.transactions, exDate]);

  const hasEligibleShares = eligibleShares > 0;

  // Gross dividend cash
  const grossDividend = useMemo(() => {
    if (!hasEligibleShares || perShareAmount <= 0) return 0;
    const raw = eligibleShares * perShareAmount;
    return isUS ? Number(raw.toFixed(2)) : Math.round(raw);
  }, [eligibleShares, perShareAmount, hasEligibleShares, isUS]);

  // Withholding tax
  const taxWithheld = useMemo(() => {
    if (!isUS || !withholdUsTax || grossDividend <= 0) return 0;
    return Number((grossDividend * 0.3).toFixed(2));
  }, [isUS, withholdUsTax, grossDividend]);

  // Net cash inflow
  const netCashInflow = useMemo(() => {
    return Math.max(0, Number((grossDividend - taxWithheld).toFixed(2)));
  }, [grossDividend, taxWithheld]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!hasEligibleShares || netCashInflow <= 0) return;
    onConfirm({
      amountPerShare: perShareAmount,
      eligibleShares,
      totalGross: grossDividend,
      taxWithheld,
      netCash: netCashInflow,
      exDate,
      paymentDate,
      notes: notes.trim() || undefined,
    });
  };

  const formatNum = (v: number) => new Intl.NumberFormat('zh-TW').format(Math.round(v));
  const formatDec = (v: number, digits = 2) =>
    v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#121216] border border-emerald-500/30 w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl text-gray-200 animate-scaleUp my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Coins className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">股票除息與現金入帳試算</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
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

        {/* Zero Shares Timeline Warning */}
        {!hasEligibleShares && (
          <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-3 text-xs text-amber-300 flex items-start gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-white">⚠️ 除息基準日當天持股為 0 股</div>
              <p className="leading-relaxed text-[11px] text-amber-200/90">
                您選擇的除息基準日（{exDate}）當天您尚未持有任何庫存，您的買入紀錄均在此日期之後。依交易法規，除息日之後買進之部位不具備領息資格。
              </p>
            </div>
          </div>
        )}

        {/* Inputs Grid: Ex-Date, Payment Date, Dividend Per Share */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/40 border border-white/5 rounded-2xl p-3 sm:p-3.5 text-xs">
          {/* Ex-Dividend Date */}
          <div className="space-y-1">
            <label className="text-gray-400 font-medium block flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-400" />
              <span>除息基準日 (Ex-Date)</span>
            </label>
            <input
              type="date"
              value={exDate}
              onChange={(e) => setExDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none transition"
            />
          </div>

          {/* Cash Payment Date */}
          <div className="space-y-1">
            <label className="text-gray-400 font-medium block flex items-center gap-1">
              <PiggyBank className="w-3 h-3 text-emerald-400" />
              <span>現金發放入帳日</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none transition"
            />
          </div>

          {/* Dividend Per Share input */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-gray-400 font-medium block flex items-center justify-between">
              <span>每股配發現金股利 ({currSym} / 股)</span>
              <span className="text-[10px] text-emerald-300 font-mono">
                資格股數: {formatDec(eligibleShares, isUS ? 4 : 0)} 股
              </span>
            </label>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-emerald-500">
              <span className="text-gray-400 font-bold text-xs mr-2">{currSym}</span>
              <input
                type="number"
                min="0.0001"
                step="any"
                value={perShareAmount}
                onChange={(e) => setPerShareAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* US 30% Tax Withholding Toggle */}
        {isUS && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <label
                htmlFor="usWithholdingTaxToggle"
                className="font-bold text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Percent className="w-3.5 h-3.5 text-cyan-400" />
                <span>預扣美股 30% 股息外國人稅款</span>
              </label>
              <p className="text-[11px] text-gray-400">
                美股券商通常於發放時自動扣繳 30% 稅額 (實收 70%)
              </p>
            </div>
            <input
              id="usWithholdingTaxToggle"
              type="checkbox"
              checked={withholdUsTax}
              onChange={(e) => setWithholdUsTax(e.target.checked)}
              className="w-5 h-5 accent-emerald-500 rounded cursor-pointer shrink-0"
            />
          </div>
        )}

        {/* Cash Dividend Payout Calculation Sheet */}
        <div className="bg-black/60 border border-emerald-500/20 rounded-2xl overflow-hidden shadow-inner divide-y divide-white/5 text-xs">
          <div className="px-3.5 py-2 bg-emerald-500/10 text-emerald-300 font-bold text-[11px] flex justify-between items-center">
            <span>🧾 股息交割與現金入帳試算明細</span>
            <span className="font-mono text-[10px] text-emerald-200/80">
              {isUS ? '入帳美金帳戶 (USD)' : '入帳台幣帳戶 (TWD)'}
            </span>
          </div>

          <div className="p-3.5 space-y-2.5">
            {/* Row 1: Eligible Shares */}
            <div className="flex items-center justify-between text-gray-400">
              <span>除息基準日持股資格</span>
              <span className="font-mono font-bold text-white">
                {formatDec(eligibleShares, isUS ? 4 : 0)} 股
              </span>
            </div>

            {/* Row 2: Gross Cash Dividend */}
            <div className="flex items-center justify-between text-gray-400">
              <span>配息毛額 (每股 {currSym}{perShareAmount}):</span>
              <span className="font-mono font-bold text-gray-200">
                {currSym}{formatDec(grossDividend)}
              </span>
            </div>

            {/* Row 3: US Withholding Tax (if applicable) */}
            {isUS && withholdUsTax && (
              <div className="flex items-center justify-between text-amber-300 bg-amber-500/10 px-2.5 py-1.5 rounded-xl">
                <span>美股 30% 預扣稅 (Withholding Tax):</span>
                <span className="font-mono font-bold">
                  - {currSym}{formatDec(taxWithheld)}
                </span>
              </div>
            )}

            {/* Row 4: Net Cash Inflow */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="font-bold text-gray-200 flex items-center gap-1.5">
                <PiggyBank className="w-4 h-4 text-emerald-400" />
                <span>預計現金實收入帳 (Net Inflow):</span>
              </span>
              <span className="font-mono text-base font-black text-emerald-400">
                + {currSym}{formatDec(netCashInflow)} {isUS ? 'USD' : 'TWD'}
              </span>
            </div>
          </div>
        </div>

        {/* Security & Passive Income Notice */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-[11px] text-emerald-200/90 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            確認入帳後，系統將自動為您的 <span className="font-bold text-white">{isUS ? '美金 (USD)' : '台幣 (TWD)'} 現金儲備</span> 增補此筆現金，並同步計入記帳本當月被動生活收入。持股股數與持股成本池保持不變。
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
            disabled={!hasEligibleShares || netCashInflow <= 0}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 ${
              !hasEligibleShares || netCashInflow <= 0
                ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed border border-white/5'
                : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-lg shadow-emerald-600/30 cursor-pointer'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>
              {!hasEligibleShares
                ? '除息日無持股，無法領息'
                : `確認股息入帳 (+${currSym}${formatDec(netCashInflow)})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
