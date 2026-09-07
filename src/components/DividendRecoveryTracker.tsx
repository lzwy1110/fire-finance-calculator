import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { PortfolioStock, DividendRecoveryInfo, MarketType } from '../types';
import { fetchDividendRecoveryData } from '../services/stockPriceService';
import { calculateDividendRecovery } from '../utils/dividendMath';

interface DividendRecoveryTrackerProps {
  stocks: PortfolioStock[];
  usdRate?: number;
  marketFilter?: 'ALL' | 'US' | 'TW';
  onSelectStock?: (stock: PortfolioStock) => void;
}

export const DividendRecoveryTracker: React.FC<DividendRecoveryTrackerProps> = ({
  stocks,
  usdRate = 32.0,
  marketFilter = 'ALL',
  onSelectStock,
}) => {
  const [recoveryDataMap, setRecoveryDataMap] = useState<Record<string, DividendRecoveryInfo>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'recovered' | 'recovering' | 'discount'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Identify stocks with eligible ex-dividend events (from pendingDividend or latest DIVIDEND tx)
  const candidateStocks = useMemo(() => {
    const list: {
      stock: PortfolioStock;
      exDate: string;
      dividendAmount: number;
      stockDividendRatio?: number;
    }[] = [];

    for (const stock of stocks) {
      if (stock.shares <= 0) continue;
      if (marketFilter !== 'ALL' && stock.market !== marketFilter) continue;

      let foundExDate = '';
      let foundDivAmt = 0;

      // Priority 1: Recent pending or recorded dividend
      if (stock.pendingDividend && stock.pendingDividend.amount > 0) {
        foundExDate = stock.pendingDividend.date;
        foundDivAmt = stock.pendingDividend.amount;
      }

      // Priority 2: Latest DIVIDEND transaction if no pendingDividend
      if (!foundExDate && Array.isArray(stock.transactions)) {
        const divTxs = stock.transactions
          .filter((t) => t.type === 'DIVIDEND' && (t.dividendPerShare || t.price))
          .sort((a, b) => b.date.localeCompare(a.date));

        if (divTxs.length > 0) {
          foundExDate = divTxs[0].date;
          foundDivAmt = divTxs[0].dividendPerShare || divTxs[0].price || 0;
        }
      }

      let foundRightRatio = 0;
      if (stock.pendingRight && stock.pendingRight.date === foundExDate) {
        foundRightRatio = stock.pendingRight.stockDividendRatio || 0;
      } else if (Array.isArray(stock.transactions)) {
        const sameDayRightTx = stock.transactions.find(
          (t) => t.type === 'STOCK_DIVIDEND' && t.date === foundExDate
        );
        if (sameDayRightTx && sameDayRightTx.stockDividendRatio) {
          foundRightRatio = sameDayRightTx.stockDividendRatio;
        }
      }

      if (foundExDate && foundDivAmt > 0) {
        list.push({
          stock,
          exDate: foundExDate,
          dividendAmount: foundDivAmt,
          stockDividendRatio: foundRightRatio,
        });
      }
    }

    return list;
  }, [stocks, marketFilter]);

  // 2. Fetch or compute live recovery status for candidate stocks
  const refreshRecoveryData = async () => {
    if (candidateStocks.length === 0) return;
    setIsLoading(true);

    const newMap: Record<string, DividendRecoveryInfo> = {};

    await Promise.all(
      candidateStocks.map(async ({ stock, exDate, dividendAmount, stockDividendRatio }) => {
        try {
          const info = await fetchDividendRecoveryData(
            stock.symbol,
            exDate,
            dividendAmount,
            stock.currentPrice || stock.avgCost,
            stock.name,
            stockDividendRatio
          );

          if (info) {
            newMap[stock.symbol] = info;
          } else {
            // Immediate local mathematical fallback
            const preClose = stock.previousClose || stock.currentPrice || stock.avgCost;
            newMap[stock.symbol] = calculateDividendRecovery(
              stock.currentPrice || stock.avgCost,
              dividendAmount,
              preClose,
              {
                symbol: stock.symbol,
                name: stock.name,
                market: stock.market,
                currency: stock.currency,
                exDate,
                stockDividendRatio,
              }
            );
          }
        } catch (e) {
          const preClose = stock.previousClose || stock.currentPrice || stock.avgCost;
          newMap[stock.symbol] = calculateDividendRecovery(
            stock.currentPrice || stock.avgCost,
            dividendAmount,
            preClose,
            {
              symbol: stock.symbol,
              name: stock.name,
              market: stock.market,
              currency: stock.currency,
              exDate,
              stockDividendRatio,
            }
          );
        }
      })
    );

    setRecoveryDataMap(newMap);
    setIsLoading(false);
  };

  useEffect(() => {
    refreshRecoveryData();
  }, [candidateStocks.length, marketFilter]);

  // 3. Filter and sort results
  const items = useMemo(() => {
    return candidateStocks
      .map(({ stock, exDate, dividendAmount, stockDividendRatio }) => {
        const info = recoveryDataMap[stock.symbol] || calculateDividendRecovery(
          stock.currentPrice || stock.avgCost,
          dividendAmount,
          stock.previousClose || stock.currentPrice || stock.avgCost,
          {
            symbol: stock.symbol,
            name: stock.name,
            market: stock.market,
            currency: stock.currency,
            exDate,
            stockDividendRatio,
          }
        );
        return { stock, info };
      })
      .filter(({ stock, info }) => {
        if (statusFilter !== 'ALL' && info.status !== statusFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            stock.symbol.toLowerCase().includes(q) ||
            stock.name.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Sort recovered first, then by recovery rate descending
        if (a.info.status === 'recovered' && b.info.status !== 'recovered') return -1;
        if (b.info.status === 'recovered' && a.info.status !== 'recovered') return 1;
        return b.info.recoveryRate - a.info.recoveryRate;
      });
  }, [candidateStocks, recoveryDataMap, statusFilter, searchQuery]);

  // Summary counts
  const summaryCounts = useMemo(() => {
    let recovered = 0;
    let recovering = 0;
    let discount = 0;

    for (const { stock } of candidateStocks) {
      const info = recoveryDataMap[stock.symbol];
      if (info) {
        if (info.status === 'recovered') recovered++;
        else if (info.status === 'recovering') recovering++;
        else discount++;
      }
    }

    return { total: candidateStocks.length, recovered, recovering, discount };
  }, [candidateStocks, recoveryDataMap]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Overview Metric Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#121216] border border-white/10 rounded-2xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>追蹤除息標的</span>
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-xl font-black text-white">{summaryCounts.total} 檔</div>
          <div className="text-[10px] text-gray-500 mt-1">在庫持有且已除息</div>
        </div>

        <div className="bg-[#121216] border border-emerald-500/30 rounded-2xl p-3.5 shadow-lg bg-emerald-500/5">
          <div className="flex items-center justify-between text-xs text-emerald-400 mb-1">
            <span>已成功填息</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400">{summaryCounts.recovered} 檔</div>
          <div className="text-[10px] text-emerald-500/80 mt-1">
            {summaryCounts.total > 0
              ? `${Math.round((summaryCounts.recovered / summaryCounts.total) * 100)}% 填息成功率`
              : '0%'}
          </div>
        </div>

        <div className="bg-[#121216] border border-cyan-500/30 rounded-2xl p-3.5 shadow-lg bg-cyan-500/5">
          <div className="flex items-center justify-between text-xs text-cyan-400 mb-1">
            <span>進行中 (填息中)</span>
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-cyan-400">{summaryCounts.recovering} 檔</div>
          <div className="text-[10px] text-cyan-500/80 mt-1">股價正逐步回升</div>
        </div>

        <div className="bg-[#121216] border border-rose-500/30 rounded-2xl p-3.5 shadow-lg bg-rose-500/5">
          <div className="flex items-center justify-between text-xs text-rose-400 mb-1">
            <span>貼息震盪</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-black text-rose-400">{summaryCounts.discount} 檔</div>
          <div className="text-[10px] text-rose-500/80 mt-1">低於除息參考價</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111114] border border-white/10 rounded-2xl p-2.5">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-white/20 text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            全部 ({summaryCounts.total})
          </button>
          <button
            onClick={() => setStatusFilter('recovered')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${
              statusFilter === 'recovered'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            ✅ 已填息 ({summaryCounts.recovered})
          </button>
          <button
            onClick={() => setStatusFilter('recovering')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${
              statusFilter === 'recovering'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            ⚡ 填息中 ({summaryCounts.recovering})
          </button>
          <button
            onClick={() => setStatusFilter('discount')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${
              statusFilter === 'discount'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            🔻 貼息中 ({summaryCounts.discount})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋代號或名稱..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>
          <button
            onClick={refreshRecoveryData}
            disabled={isLoading}
            className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 transition cursor-pointer disabled:opacity-50"
            title="重新整理走勢與填息數據"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Recovery Cards List */}
      {items.length === 0 ? (
        <div className="bg-[#121216] border border-white/10 rounded-2xl p-8 text-center text-gray-400">
          <AlertCircle className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">目前尚無符合篩選條件的除息標的</p>
          <p className="text-xs text-gray-600 mt-1">當持有股票有除息紀錄或已除息公告時，將自動在此即時追蹤</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(({ stock, info }) => {
            const symPrefix = info.currency === 'USD' ? '$' : 'NT$';
            const progressPercent = Math.min(100, Math.max(0, info.recoveryRate));

            return (
              <div
                key={stock.id}
                onClick={() => onSelectStock?.(stock)}
                className="bg-[#121216] border border-white/10 hover:border-white/20 rounded-2xl p-4.5 shadow-xl transition hover:shadow-cyan-500/5 group cursor-pointer relative overflow-hidden"
              >
                {/* Status Indicator Stripe */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    info.status === 'recovered'
                      ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                      : info.status === 'recovering'
                      ? 'bg-cyan-500 shadow-sm shadow-cyan-500/50'
                      : 'bg-rose-500 shadow-sm shadow-rose-500/50'
                  }`}
                />

                {/* Header: Stock Info & Status Badge */}
                <div className="flex items-start justify-between gap-2 mb-3 pt-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white group-hover:text-cyan-400 transition">
                        {stock.symbol}
                      </span>
                      <span className="text-xs text-gray-400 truncate max-w-[140px] sm:max-w-[180px]">
                        {stock.name}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${
                          stock.market === 'TW'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}
                      >
                        {stock.market}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3 h-3 text-zinc-500" />
                      <span>除息日：{info.exDate}</span>
                      <span>•</span>
                      <span>配息：{symPrefix} {info.dividendAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {info.status === 'recovered' ? (
                      <div className="flex flex-col items-end">
                        <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          已填息
                        </span>
                        {typeof info.daysToRecover === 'number' && (
                          <span className="text-[10px] font-bold text-emerald-500 mt-1 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            歷時 {info.daysToRecover} 個交易日
                          </span>
                        )}
                      </div>
                    ) : info.status === 'recovering' ? (
                      <div className="flex flex-col items-end">
                        <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                          填息 {info.recoveryRate}%
                        </span>
                        <span className="text-[10px] text-cyan-500 mt-1">差 {symPrefix} {Math.abs(info.priceGap).toFixed(2)} 填息</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                          貼息中
                        </span>
                        <span className="text-[10px] text-rose-500 mt-1">跌破參考價 {symPrefix} {Math.abs(info.currentPrice - info.exRefPrice).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Three-Tier Visual Meter */}
                <div className="space-y-1.5 my-3">
                  <div className="flex justify-between text-[11px] font-medium text-gray-400">
                    <span>除息參考價：{symPrefix} {info.exRefPrice.toFixed(2)}</span>
                    <span className="text-white font-bold">現價：{symPrefix} {info.currentPrice.toFixed(2)}</span>
                    <span>除息前價：{symPrefix} {info.preClosePrice.toFixed(2)}</span>
                  </div>

                  {/* Meter Bar */}
                  <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-white/5 relative">
                    {/* Background segments: red (discount) / cyan (filling) / emerald (recovered) */}
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        info.status === 'recovered'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : info.status === 'recovering'
                          ? 'bg-gradient-to-r from-cyan-600 to-cyan-400'
                          : 'bg-rose-500/60'
                      }`}
                      style={{ width: `${info.status === 'recovered' ? 100 : progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Footer Insight Note */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400/80" />
                    <span>
                      {info.status === 'recovered'
                        ? info.recoveredDate
                          ? `於 ${info.recoveredDate} 完成填息目標`
                          : '已全數收復除息跌幅'
                        : info.status === 'recovering'
                        ? `再上漲 ${(((info.preClosePrice - info.currentPrice) / info.currentPrice) * 100).toFixed(1)}% 即可填息`
                        : '股價在除息參考價下方震盪整理'}
                    </span>
                  </div>
                  <span className="text-cyan-400 text-[10px] group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                    查看走勢 <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
