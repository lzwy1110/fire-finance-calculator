import React from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  CheckCircle2,
  Calendar,
  Wallet,
  ArrowRight,
  X,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import { RecurringExpense, Transaction } from '../types';

interface RecurringDeductionAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToLedger: () => void;
  deductedItems: Array<{
    expense: RecurringExpense;
    transaction: Transaction;
  }>;
  totalDeductedTWD: number;
  totalDeductedUSD: number;
  remainingCashTWD?: number;
  remainingCashUSD?: number;
}

export const RecurringDeductionAlertModal: React.FC<RecurringDeductionAlertModalProps> = ({
  isOpen,
  onClose,
  onGoToLedger,
  deductedItems,
  totalDeductedTWD,
  totalDeductedUSD,
  remainingCashTWD,
  remainingCashUSD,
}) => {
  if (!isOpen || deductedItems.length === 0) return null;

  const formatNum = (v: number) => new Intl.NumberFormat('zh-TW').format(Math.round(v));
  const formatDec = (v: number) =>
    v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleGoToLedger = () => {
    onClose();
    onGoToLedger();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#131318] border border-indigo-500/30 w-full max-w-md rounded-3xl p-5 sm:p-6 flex flex-col max-h-[85vh] shadow-2xl shadow-indigo-500/10 text-gray-200 animate-scaleUp overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 pb-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 relative">
              <Bell className="w-5 h-5 stroke-[2.5]" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base sm:text-lg font-black text-white">今日自動扣款完成</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {deductedItems.length} 筆已記帳
                </span>
              </div>
              <p className="text-xs text-zinc-400">已自動新增至收支明細，並自活存中扣除</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-1 pr-1">
          {/* Deducted Items list */}
          <div className="space-y-2">
            {deductedItems.map((item, idx) => {
              const exp = item.expense;
              const isUSD = exp.currency === 'USD';
              return (
                <div
                  key={item.transaction.id || idx}
                  className="bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-3 flex items-center justify-between transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white truncate">{exp.name}</span>
                      <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                        {exp.subCategory || exp.mainCategory}
                      </span>
                    </div>
                    {exp.note && <div className="text-[11px] text-zinc-400 truncate">{exp.note}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-black text-rose-400">
                      -{isUSD ? `$${formatDec(exp.amount)}` : `NT$ ${formatNum(exp.amount)}`}
                    </div>
                    <div className="text-[10px] text-emerald-400 flex items-center justify-end gap-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>已扣繳</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Summary Box */}
          <div className="bg-gradient-to-br from-zinc-900 via-indigo-950/20 to-zinc-900 p-3.5 rounded-2xl border border-indigo-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                本日總扣款金額
              </span>
              <span className="text-sm font-black text-white">
                NT$ {formatNum(totalDeductedTWD)}
                {totalDeductedUSD > 0 && (
                  <span className="text-xs text-indigo-300 ml-1.5 font-bold">
                    + ${formatDec(totalDeductedUSD)} USD
                  </span>
                )}
              </span>
            </div>

            {(remainingCashTWD !== undefined || remainingCashUSD !== undefined) && (
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-zinc-800/80">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  活存扣款後餘額
                </span>
                <span className="font-bold text-emerald-400">
                  {remainingCashTWD !== undefined && `NT$ ${formatNum(remainingCashTWD)}`}
                  {remainingCashUSD !== undefined && remainingCashUSD > 0 && (
                    <span className="ml-1.5 text-emerald-300">
                      / ${formatDec(remainingCashUSD)} USD
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2.5 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={handleGoToLedger}
            className="flex-1 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 font-bold text-xs sm:text-sm text-indigo-300 border border-indigo-500/30 flex items-center justify-center gap-1.5 transition-all"
          >
            <span>查看明細流水帳</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs sm:text-sm text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
