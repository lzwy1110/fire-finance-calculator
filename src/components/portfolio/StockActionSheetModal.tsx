import React from 'react';
import { createPortal } from 'react-dom';
import { X, PlusCircle, History, Scissors, Trash2, Calendar, TrendingUp, ArrowDownCircle } from 'lucide-react';
import { PortfolioStock, StockSplitEvent, StockDividendEvent, StockRightEvent } from '../../types';

export interface StockActionSheetModalProps {
  stock: PortfolioStock | null;
  detectedSplitsMap: Record<string, StockSplitEvent>;
  detectedDividendsMap: Record<string, StockDividendEvent>;
  detectedRightsMap: Record<string, StockRightEvent>;
  onClose: () => void;
  onOpenChart: (stock: PortfolioStock) => void;
  onOpenTrade: (stock: PortfolioStock) => void;
  onOpenHistory: (stock: PortfolioStock) => void;
  onOpenSplit: (stock: PortfolioStock, splitEvent: StockSplitEvent | null) => void;
  onOpenReduction: (stock: PortfolioStock) => void;
  onOpenDividend: (stock: PortfolioStock, dividendEvent: StockDividendEvent | null) => void;
  onOpenRight: (stock: PortfolioStock, rightEvent: StockRightEvent | null) => void;
  onViewDividendCalendar: () => void;
  onDeleteStock: (stockId: string) => void;
}

export const StockActionSheetModal: React.FC<StockActionSheetModalProps> = ({
  stock,
  detectedSplitsMap,
  detectedDividendsMap,
  detectedRightsMap,
  onClose,
  onOpenChart,
  onOpenTrade,
  onOpenHistory,
  onOpenSplit,
  onOpenReduction,
  onOpenDividend,
  onOpenRight,
  onViewDividendCalendar,
  onDeleteStock,
}) => {
  if (!stock) return null;

  const hasPendingDiv = Boolean(detectedDividendsMap[stock.id]);
  const hasPendingRight = Boolean(detectedRightsMap[stock.id]);
  const hasPendingSplit = Boolean(detectedSplitsMap[stock.id]);

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#111115] border-t sm:border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-3.5 shadow-2xl text-gray-200 relative animate-slideUp sm:animate-scaleUp max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">{stock.market === 'US' ? '🇺🇸' : '🇹🇼'}</span>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black font-mono text-white tracking-tight flex items-center gap-2">
                <span>{stock.symbol}</span>
                <span className="text-xs font-normal text-gray-400 font-sans truncate max-w-[160px] sm:max-w-[200px]">
                  {stock.name}
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">
                現有持股: <strong className="text-gray-200 font-mono">{stock.shares.toLocaleString()}</strong> 股 • 現價 {stock.currency === 'USD' ? '$' : 'NT$'}{stock.currentPrice}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded-xl cursor-pointer shrink-0 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Action Content */}
        <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-0.5">
          {/* Section 1: 🏢 公司行動與除權息 (2x2 Grid) */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-purple-300/90 px-0.5 flex items-center justify-between">
              <span>🏢 公司行動與除權息</span>
              {(hasPendingDiv || hasPendingRight || hasPendingSplit) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  有待確認事件
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* 1. 現金除息 */}
              <button
                onClick={() => {
                  onClose();
                  onOpenDividend(stock, detectedDividendsMap[stock.id] || null);
                }}
                className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-2xl flex flex-col justify-between transition cursor-pointer active:scale-95 text-left relative group min-h-[76px]"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center text-sm">
                    💰
                  </div>
                  {hasPendingDiv && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
                <div className="pt-1.5">
                  <div className="text-xs font-black text-white group-hover:text-emerald-300 transition">現金除息</div>
                  <div className="text-[10px] text-emerald-400/90 truncate">
                    {detectedDividendsMap[stock.id]
                      ? `待認領: $${detectedDividendsMap[stock.id].amount}`
                      : '股息入帳試算'}
                  </div>
                </div>
              </button>

              {/* 2. 除權配股 */}
              <button
                onClick={() => {
                  onClose();
                  onOpenRight(stock, detectedRightsMap[stock.id] || null);
                }}
                className="p-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-2xl flex flex-col justify-between transition cursor-pointer active:scale-95 text-left relative group min-h-[76px]"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-7 h-7 rounded-xl bg-sky-500/20 flex items-center justify-center text-sm">
                    📈
                  </div>
                  {hasPendingRight && (
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  )}
                </div>
                <div className="pt-1.5">
                  <div className="text-xs font-black text-white group-hover:text-sky-300 transition">除權配股</div>
                  <div className="text-[10px] text-sky-400/90 truncate">
                    {detectedRightsMap[stock.id]
                      ? `待確認: 配$${detectedRightsMap[stock.id].stockDividendPerShare}`
                      : '無償配發新股'}
                  </div>
                </div>
              </button>

              {/* 3. 股票分割 */}
              <button
                onClick={() => {
                  onClose();
                  onOpenSplit(stock, detectedSplitsMap[stock.id] || null);
                }}
                className="p-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-2xl flex flex-col justify-between transition cursor-pointer active:scale-95 text-left relative group min-h-[76px]"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-7 h-7 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300">
                    <Scissors className="w-3.5 h-3.5" />
                  </div>
                  {hasPendingSplit && (
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  )}
                </div>
                <div className="pt-1.5">
                  <div className="text-xs font-black text-white group-hover:text-purple-300 transition">股票分割</div>
                  <div className="text-[10px] text-purple-400/90 truncate">
                    {detectedSplitsMap[stock.id]
                      ? detectedSplitsMap[stock.id].splitRatioText
                      : '自訂比例 1拆多'}
                  </div>
                </div>
              </button>

              {/* 4. 現金減資 */}
              <button
                onClick={() => {
                  onClose();
                  onOpenReduction(stock);
                }}
                className="p-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-2xl flex flex-col justify-between transition cursor-pointer active:scale-95 text-left relative group min-h-[76px]"
              >
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <ArrowDownCircle className="w-3.5 h-3.5" />
                </div>
                <div className="pt-1.5">
                  <div className="text-xs font-black text-white group-hover:text-amber-300 transition">現金減資</div>
                  <div className="text-[10px] text-amber-400/90 truncate">退還股款與縮減</div>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: 快捷操作 (走勢 / 交易 / 明細 / 日曆) */}
          <div className="space-y-1.5 pt-1 border-t border-white/10">
            <div className="text-[11px] font-bold text-gray-400 px-0.5">常用捷徑</div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => {
                  onClose();
                  onOpenChart(stock);
                }}
                className="py-2 px-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 flex items-center justify-center gap-1 transition cursor-pointer active:scale-95"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>走勢K線</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onOpenTrade(stock);
                }}
                className="py-2 px-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 rounded-xl text-xs font-bold text-cyan-300 flex items-center justify-center gap-1 transition cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>買入/賣出</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onOpenHistory(stock);
                }}
                className="py-2 px-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 flex items-center justify-center gap-1 transition cursor-pointer active:scale-95"
              >
                <History className="w-3.5 h-3.5 text-gray-400" />
                <span>明細對帳</span>
              </button>
            </div>

            {/* Dividend Calendar link */}
            <button
              onClick={() => {
                onClose();
                onViewDividendCalendar();
              }}
              className="w-full py-2 px-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 rounded-xl text-xs text-gray-300 flex items-center justify-between transition cursor-pointer active:scale-98 mt-1"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-white">年度股息日曆與填息天數分析</span>
              </div>
              <span className="text-[11px] text-gray-400">查看 &rarr;</span>
            </button>
          </div>

          {/* Section 3: ⚠️ 刪除持股 (Danger Zone) */}
          <div className="pt-1 pb-1 border-t border-white/10">
            <button
              onClick={() => {
                onClose();
                onDeleteStock(stock.id);
              }}
              className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98 text-xs"
            >
              <div className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" />
                <span>刪除此持股紀錄</span>
              </div>
              <span className="text-[10px] text-rose-400/80">移除庫存</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
