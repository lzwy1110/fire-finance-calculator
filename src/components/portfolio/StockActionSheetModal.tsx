import React from 'react';
import { X, PlusCircle, History, Scissors, Trash2 } from 'lucide-react';
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
  onOpenDividend,
  onOpenRight,
  onViewDividendCalendar,
  onDeleteStock,
}) => {
  if (!stock) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#0e0e0e] border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl text-gray-200 relative animate-slideUp sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{stock.market === 'US' ? '🇺🇸' : '🇹🇼'}</span>
            <div>
              <h3 className="text-lg font-black font-mono text-white tracking-tight">
                {stock.symbol}
              </h3>
              <p className="text-xs text-gray-400 truncate max-w-[220px]">{stock.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-2xl cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-2.5 pt-1">
          <button
            onClick={() => {
              onClose();
              onOpenChart(stock);
            }}
            className="p-3.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 rounded-2xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-base">
                📈
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">股票走勢圖 & K線圖表</div>
                <div className="text-xs text-gray-400 font-normal">技術指標與即時報價查看</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenTrade(stock);
            }}
            className="p-3.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-2xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">記錄買入 / 賣出交易</div>
                <div className="text-xs text-cyan-400 font-normal">加碼存股或獲利減碼</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenHistory(stock);
            }}
            className="p-3.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 rounded-2xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-gray-300">
                <History className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">檢視歷史交易明細</div>
                <div className="text-xs text-gray-400 font-normal">共 {stock.transactions?.length || 0} 筆過往買賣紀錄</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenSplit(stock, detectedSplitsMap[stock.id] || null);
            }}
            className="p-3.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-2xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Scissors className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">記錄股票分割 (Stock Split)</div>
                <div className="text-xs text-purple-400 font-normal">
                  {detectedSplitsMap[stock.id]
                    ? `待確認：${detectedSplitsMap[stock.id].splitRatioText}`
                    : '自訂比例如 1 拆 10、反向併股試算與校正'}
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenDividend(stock, detectedDividendsMap[stock.id] || null);
            }}
            className="p-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-2xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-base">
                💰
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">記錄除息與現金入帳 (Cash Dividend)</div>
                <div className="text-xs text-emerald-400 font-normal">
                  {detectedDividendsMap[stock.id]
                    ? `待確認：每股 $${detectedDividendsMap[stock.id].amount}`
                    : '輸入配息金額與入帳試算'}
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenRight(stock, detectedRightsMap[stock.id] || null);
            }}
            className="p-3.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-2xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center text-base">
                📈
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">記錄除權與配股 (Stock Dividend)</div>
                <div className="text-xs text-sky-400 font-normal">
                  {detectedRightsMap[stock.id]
                    ? `待確認：每股配 $${detectedRightsMap[stock.id].stockDividendPerShare} 元`
                    : '無償配發新股、成本守恆與均價除權'}
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onViewDividendCalendar();
            }}
            className="p-3.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-2xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center text-base">
                📅
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">查看股息日曆與填息分析</div>
                <div className="text-xs text-sky-400 font-normal">
                  年度被動現金流與除權息復原力追蹤
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onDeleteStock(stock.id);
            }}
            className="p-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-2xl font-bold flex items-center justify-between transition cursor-pointer active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-white">刪除此股票持股</div>
                <div className="text-xs text-rose-400 font-normal">從庫存中完整移除</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
