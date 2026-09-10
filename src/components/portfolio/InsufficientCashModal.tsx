import React from 'react';
import { createPortal } from 'react-dom';
import { X, Coins } from 'lucide-react';

export interface InsufficientCashModalProps {
  isOpen: boolean;
  stockName: string;
  isUS: boolean;
  tradeCost: number;
  currentCash: number;
  shortage: number;
  onConfirmInitialHoldings: () => void;
  onConfirmForceDeduct: () => void;
  onClose: () => void;
}

export const InsufficientCashModal: React.FC<InsufficientCashModalProps> = ({
  isOpen,
  stockName,
  isUS,
  tradeCost,
  currentCash,
  shortage,
  onConfirmInitialHoldings,
  onConfirmForceDeduct,
  onClose,
}) => {
  if (!isOpen) return null;

  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(Math.round(num));

  const modalContent = (
    <div className="fixed inset-0 z-[125] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#121216] border border-amber-500/30 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 sm:space-y-5 relative overflow-hidden animate-scaleUp">
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
            onClick={onClose}
            className="absolute top-0 right-0 p-1.5 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-4 space-y-3 text-sm text-gray-200 relative z-10">
          <p className="leading-relaxed font-medium">
            您預計買入 <span className="text-white font-bold">{stockName}</span> 總金額為{' '}
            <span className="text-amber-300 font-bold">
              {isUS ? '$' : 'NT$'} {formatNum(tradeCost)} {isUS ? 'USD' : ''}
            </span>，但當前{isUS ? '美金' : '台幣'}現金儲備僅有{' '}
            <span className="text-gray-300 font-bold">
              {isUS ? '$' : 'NT$'} {formatNum(currentCash)} {isUS ? 'USD' : ''}
            </span>（尚缺 {isUS ? '$' : 'NT$'} {formatNum(shortage)}）。
          </p>
          <p className="text-xs text-amber-400 font-medium pt-2 border-t border-amber-500/15 leading-relaxed">
            💡 若這是加入 FIRE 計算器之前已持有的股票，建議選擇「轉為歷史已有倉位」而不扣除現金；若手上有台幣可先透過「💱 雙幣換匯」轉入美金。
          </p>
        </div>

        <div className="space-y-2.5 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] relative z-10">
          <button
            onClick={onConfirmInitialHoldings}
            className="w-full py-3.5 px-5 rounded-2xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <span>🔘 轉為歷史已有倉位 (不扣除現金)</span>
          </button>
          <button
            onClick={onConfirmForceDeduct}
            className="w-full py-3 px-5 rounded-2xl font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
          >
            <span>🔘 強制扣除現金 (允許餘額為負)</span>
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-5 rounded-2xl font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all text-xs cursor-pointer"
          >
            取消並重新調整
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
