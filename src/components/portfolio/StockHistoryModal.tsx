import React from 'react';
import { X, PlusCircle, Scissors, Trash2, Edit2 } from 'lucide-react';
import { PortfolioStock, StockTransaction, StockSplitEvent, StockDividendEvent, StockRightEvent } from '../../types';
import { calculateStockMetrics } from '../../utils/portfolioMath';

export interface StockHistoryModalProps {
  stock: PortfolioStock | null;
  detectedSplitsMap: Record<string, StockSplitEvent>;
  detectedDividendsMap: Record<string, StockDividendEvent>;
  detectedRightsMap: Record<string, StockRightEvent>;
  onClose: () => void;
  onOpenAddTrade: (stock: PortfolioStock) => void;
  onOpenEditTrade: (stock: PortfolioStock, tx: StockTransaction) => void;
  onDeleteTrade: (stockId: string, txId: string) => void;
  onOpenSplit: (stock: PortfolioStock, splitEvent: StockSplitEvent | null) => void;
  onOpenReduction: (stock: PortfolioStock) => void;
  onOpenDividend: (stock: PortfolioStock, dividendEvent: StockDividendEvent | null) => void;
  onOpenRight: (stock: PortfolioStock, rightEvent: StockRightEvent | null) => void;
}

export const StockHistoryModal: React.FC<StockHistoryModalProps> = ({
  stock,
  detectedSplitsMap,
  detectedDividendsMap,
  detectedRightsMap,
  onClose,
  onOpenAddTrade,
  onOpenEditTrade,
  onDeleteTrade,
  onOpenSplit,
  onOpenReduction,
  onOpenDividend,
  onOpenRight,
}) => {
  if (!stock) return null;

  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(Math.round(num));
  const formatDec = (num: number) =>
    num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const metrics = calculateStockMetrics(stock.transactions, stock.currentPrice);
  const currSym = stock.market === 'US' ? '$' : 'NT$';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#0e0e0e] border border-white/10 w-full max-w-xl rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl text-gray-200 relative my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{stock.market === 'US' ? '🇺🇸' : '🇹🇼'}</span>
            <div>
              <h3 className="text-lg font-black text-white font-mono flex items-center gap-2">
                <span>{stock.symbol}</span>
                <span className="text-xs font-normal text-gray-400">({stock.name})</span>
              </h3>
              <p className="text-xs text-cyan-300">買賣交易歷史與損益明細對帳單</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded-xl cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary Header inside Modal */}
        <div className="bg-black/60 border border-white/5 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-gray-400 text-[10px] block">目前持有股數</span>
            <strong className="text-white font-mono text-sm">{formatNum(metrics.shares)} 股</strong>
          </div>

          <div>
            <span className="text-gray-400 text-[10px] block">加權買入均價</span>
            <strong className="text-gray-200 font-mono text-sm">{currSym}{formatDec(metrics.avgCost)}</strong>
          </div>

          <div>
            <span className="text-gray-400 text-[10px] block">未實現損益</span>
            <strong
              className={`font-mono text-sm font-bold ${
                metrics.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {metrics.unrealizedPnL >= 0 ? '+' : ''}{currSym}{formatNum(metrics.unrealizedPnL)}
            </strong>
          </div>

          <div>
            <span className="text-gray-400 text-[10px] block">已實現損益</span>
            <strong
              className={`font-mono text-sm font-bold ${
                metrics.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {metrics.realizedPnL >= 0 ? '+' : ''}{currSym}{formatNum(metrics.realizedPnL)}
            </strong>
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 px-1">
            <span>交易明細紀錄 ({stock.transactions?.length || 0} 筆):</span>
            <button
              onClick={() => {
                onClose();
                onOpenAddTrade(stock);
              }}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 py-1 px-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 cursor-pointer font-bold transition active:scale-95 shadow-sm"
              title="新增買入或賣出交易"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>新增交易</span>
            </button>
          </div>

          {stock.transactions && stock.transactions.length > 0 ? (
            stock.transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-3 hover:border-white/15 transition text-xs"
              >
                {tx.type === 'DIVIDEND' ? (
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 rounded-xl font-mono font-black text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <span>💰 股息 DIVIDEND</span>
                    </span>

                    <div>
                      <div className="font-mono font-bold text-emerald-400">
                        每股 ${tx.dividendPerShare ?? tx.price} • 實收現金 +{stock.currency === 'USD' ? '$' : 'NT$'}{formatNum(tx.dividendTotalCash || (tx.shares * (tx.dividendPerShare || tx.price || 0)))}
                        {tx.taxWithheld && tx.taxWithheld > 0 ? (
                          <span className="text-[10px] text-gray-400 font-normal ml-1.5">(預扣稅 ${formatNum(tx.taxWithheld)})</span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-2">
                        <span>📅 {tx.date}</span>
                        <span className="text-emerald-300/80">除息持有 {formatNum(tx.shares)} 股</span>
                        {tx.note && <span className="text-gray-500">({tx.note})</span>}
                      </div>
                    </div>
                  </div>
                ) : tx.type === 'SPLIT' ? (
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 rounded-xl font-mono font-black text-[11px] bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                      <Scissors className="w-3 h-3" />
                      <span>分割 SPLIT</span>
                    </span>

                    <div>
                      <div className="font-mono font-bold text-white">
                        分割比例: {tx.splitRatio ? (tx.splitRatio >= 1 ? `1 拆 ${tx.splitRatio}` : `${1 / tx.splitRatio} 併 1`) : '1 拆 10'} ({tx.splitRatio || 1}x)
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-2">
                        <span>📅 {tx.date}</span>
                        <span className="text-purple-300/80">總投入成本保證不變</span>
                        {tx.note && <span className="text-gray-500">({tx.note})</span>}
                      </div>
                    </div>
                  </div>
                ) : tx.type === 'STOCK_DIVIDEND' ? (
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 rounded-xl font-mono font-black text-[11px] bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                      <span>📈 除權配股 STOCK DIV</span>
                    </span>

                    <div>
                      <div className="font-mono font-bold text-sky-400">
                        每股配 {tx.stockDividendPerShare ?? 1.0} 元 • 獲配新股 +{formatNum(tx.shares)} 股
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-2">
                        <span>📅 {tx.date}</span>
                        <span className="text-sky-300/80">成本0元(無償配發) • 均價稀釋除權</span>
                        {tx.note && <span className="text-gray-500">({tx.note})</span>}
                      </div>
                    </div>
                  </div>
                ) : tx.type === 'CAPITAL_REDUCTION' ? (
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 rounded-xl font-mono font-black text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Scissors className="w-3 h-3 text-amber-400" />
                      <span>減資 REDUCTION</span>
                    </span>

                    <div>
                      <div className="font-mono font-bold text-amber-300">
                        退還現金 +{stock.currency === 'USD' ? '$' : 'NT$'}{formatNum(tx.capitalReductionCashTotal || (tx.shares * (tx.capitalReductionCashPerShare || 0)))}
                        {tx.capitalReductionCashPerShare && tx.capitalReductionCashPerShare > 0 ? (
                          <span className="text-[10px] text-gray-400 font-normal ml-1.5">
                            (每股退 ${tx.capitalReductionCashPerShare} 元，免所得稅)
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-2">
                        <span>📅 {tx.date}</span>
                        <span className="text-amber-300/80">
                          減資比率 {Number(((tx.capitalReductionRatio || 0) * 100).toFixed(2))}% • 留存 {formatNum(tx.shares)} 股
                        </span>
                        {tx.note && <span className="text-gray-500">({tx.note})</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded-xl font-mono font-black text-[11px] border ${
                        tx.type === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {tx.type}
                    </span>

                    <div>
                      <div className="font-mono font-bold text-white flex items-center gap-2">
                        <span>
                          {formatNum(tx.shares)} 股 @ {stock.market === 'US' ? '$' : 'NT$'}
                          {formatDec(tx.price)}
                        </span>
                        {tx.isInitialHoldings && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-sans">
                            歷史原有
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-2">
                        <span>📅 {tx.date}</span>
                        {tx.note && <span className="text-gray-500">({tx.note})</span>}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  {tx.type === 'DIVIDEND' ? (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenDividend(stock, {
                          date: tx.date,
                          amount: tx.dividendPerShare || tx.price || 0,
                          status: 'applied',
                        });
                      }}
                      className="p-1.5 text-gray-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-xl transition cursor-pointer"
                      title="重新試算/校正股息"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  ) : tx.type === 'SPLIT' ? (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenSplit(stock, {
                          date: tx.date,
                          ratio: tx.splitRatio || 1,
                          numerator: tx.splitNumerator || (tx.splitRatio ? tx.splitRatio : 10),
                          denominator: tx.splitDenominator || 1,
                          splitRatioText: tx.splitRatio ? `1 拆 ${tx.splitRatio}` : '1 拆 10',
                          status: 'applied',
                        });
                      }}
                      className="p-1.5 text-gray-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-xl transition cursor-pointer"
                      title="重新試算/校正分割"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  ) : tx.type === 'STOCK_DIVIDEND' ? (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenRight(stock, {
                          date: tx.date,
                          stockDividendPerShare: tx.stockDividendPerShare || 1.0,
                          stockDividendRatio: tx.stockDividendRatio || 0.1,
                          status: 'applied',
                        });
                      }}
                      className="p-1.5 text-gray-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-xl transition cursor-pointer"
                      title="重新試算/校正配股"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  ) : tx.type === 'CAPITAL_REDUCTION' ? (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenReduction(stock);
                      }}
                      className="p-1.5 text-gray-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-xl transition cursor-pointer"
                      title="重新試算/校正減資"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenEditTrade(stock, tx);
                      }}
                      className="p-1.5 text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-xl transition cursor-pointer"
                      title="編輯此筆交易紀錄"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => onDeleteTrade(stock.id, tx.id)}
                    className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                    title="刪除此筆交易紀錄"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500 text-xs">尚無交易明細紀錄</div>
          )}
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
