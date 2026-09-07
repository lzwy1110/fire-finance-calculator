import React, { useState, useMemo } from 'react';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Percent,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Coins,
  Receipt,
  PieChart,
  BarChart3,
  Flame,
} from 'lucide-react';
import {
  PortfolioStock,
  FIREConfig,
  MarketType,
  DividendCalendarItem,
  StockDividendEvent,
} from '../types';
import {
  calculateDividendCalendar,
  getFIRECoverageMilestone,
} from '../utils/dividendMath';
import { DividendRecoveryTracker } from './DividendRecoveryTracker';

interface DividendCalendarViewProps {
  stocks: PortfolioStock[];
  fireConfig: FIREConfig;
  usdRate?: number;
  onOpenDividendModal?: (stock: PortfolioStock, event?: StockDividendEvent) => void;
  onSelectStock?: (stock: PortfolioStock) => void;
}

export const DividendCalendarView: React.FC<DividendCalendarViewProps> = ({
  stocks,
  fireConfig,
  usdRate = 32.0,
  onOpenDividendModal,
  onSelectStock,
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [marketFilter, setMarketFilter] = useState<'ALL' | 'US' | 'TW'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'recovery'>('calendar');

  const sym = fireConfig?.currencySymbol || 'NT$';
  const formatTWD = (num: number) => new Intl.NumberFormat('zh-TW').format(Math.round(num));

  // 1. Core Dividend Summary Calculation
  const summary = useMemo(() => {
    return calculateDividendCalendar(stocks, selectedYear, usdRate, fireConfig, marketFilter);
  }, [stocks, selectedYear, usdRate, fireConfig, marketFilter]);

  // 2. Filtered Items for Display
  const displayedItems = useMemo(() => {
    if (selectedMonth === null) {
      return summary.items;
    }
    return summary.items.filter((item) => {
      const d = item.paymentDate || item.exDate;
      return parseInt(d.slice(5, 7), 10) === selectedMonth;
    });
  }, [summary.items, selectedMonth]);

  // 3. Milestone calculation
  const milestone = useMemo(() => {
    return getFIRECoverageMilestone(summary.expenseCoverageRatio);
  }, [summary.expenseCoverageRatio]);

  // 4. Max Monthly Amount for Bar Scaling
  const maxMonthlyTotal = useMemo(() => {
    const maxVal = Math.max(...summary.monthlyBuckets.map((b) => b.totalTWD), 0);
    return Math.max(maxVal, 1000); // Avoid divide-by-zero
  }, [summary.monthlyBuckets]);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Top Header & Sub-Navigation Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#111114] border border-white/10 rounded-2xl p-3 shadow-xl">
        {/* Left: View Mode Switcher */}
        <div className="flex items-center p-1 bg-black/60 border border-white/10 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('calendar')}
            className={`flex-1 sm:flex-initial px-3.5 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubTab === 'calendar'
                ? 'bg-white/20 text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>12 個月日曆與流向</span>
          </button>
          <button
            onClick={() => setActiveSubTab('recovery')}
            className={`flex-1 sm:flex-initial px-3.5 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubTab === 'recovery'
                ? 'bg-white/20 text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>除權息填息追蹤榜</span>
          </button>
        </div>

        {/* Right: Year Selector & Market Filter */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          {/* Year Switcher */}
          <div className="flex items-center bg-black/60 border border-white/10 rounded-xl px-1 py-0.5">
            <button
              onClick={() => setSelectedYear((prev) => prev - 1)}
              className="p-1.5 text-gray-400 hover:text-white transition cursor-pointer"
              title="前一年"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black text-white px-2 tracking-wide">
              {selectedYear} 年
            </span>
            <button
              onClick={() => setSelectedYear((prev) => prev + 1)}
              className="p-1.5 text-gray-400 hover:text-white transition cursor-pointer"
              title="後一年"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Market Filter */}
          <div className="flex items-center p-0.5 bg-black/60 border border-white/10 rounded-xl">
            <button
              onClick={() => setMarketFilter('ALL')}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                marketFilter === 'ALL'
                  ? 'bg-white/20 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setMarketFilter('US')}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                marketFilter === 'US'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              美股
            </button>
            <button
              onClick={() => setMarketFilter('TW')}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                marketFilter === 'TW'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              台股
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'recovery' ? (
        /* Sub-View 2: Dividend Recovery Tracker */
        <DividendRecoveryTracker
          stocks={stocks}
          usdRate={usdRate}
          marketFilter={marketFilter}
          onSelectStock={onSelectStock}
        />
      ) : (
        /* Sub-View 1: Calendar & Passive Income Dashboard */
        <>
          {/* 4 Hero FIRE Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: YTD Confirmed Dividends */}
            <div className="bg-[#121216] border border-emerald-500/30 rounded-2xl p-4 shadow-xl bg-emerald-500/5 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-emerald-400 mb-1.5">
                <span className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  今年已領股息 (實收)
                </span>
                <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 font-extrabold">
                  已入帳
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {sym} {formatTWD(summary.totalConfirmedTWD)}
              </div>
              <div className="text-[11px] text-gray-400 mt-2 flex items-center justify-between">
                <span>共 {summary.items.filter((i) => i.status === 'confirmed').length} 筆配息入帳</span>
                <span className="text-emerald-400 font-bold">100% 已入庫</span>
              </div>
            </div>

            {/* Card 2: Projected Annual Dividend Income */}
            <div className="bg-[#121216] border border-sky-500/30 rounded-2xl p-4 shadow-xl bg-sky-500/5 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-sky-400 mb-1.5">
                <span className="font-bold flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  預估全年被動收入
                </span>
                <span className="text-[10px] bg-sky-500/20 px-2 py-0.5 rounded-full border border-sky-500/30 font-extrabold">
                  年度總計
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {sym} {formatTWD(summary.totalAnnualTWD)}
              </div>
              <div className="text-[11px] text-gray-400 mt-2 flex items-center justify-between">
                <span>月均被動流：{sym} {formatTWD(summary.avgMonthlyDividendTWD)}</span>
                <span className="text-sky-400 font-bold">
                  {summary.totalAnnualTWD > 0
                    ? `${Math.round((summary.totalConfirmedTWD / summary.totalAnnualTWD) * 100)}% 已達成`
                    : '0%'}
                </span>
              </div>
            </div>

            {/* Card 3: Monthly Living Expense Coverage Ratio */}
            <div className="bg-[#121216] border border-amber-500/30 rounded-2xl p-4 shadow-xl bg-amber-500/5 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-amber-400 mb-1.5">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  每月生活費覆蓋率
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-extrabold ${milestone.badgeColor}`}>
                  {milestone.label.split(' ')[1] || milestone.label}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-baseline gap-1.5">
                <span>{summary.expenseCoverageRatio}%</span>
                <span className="text-xs text-gray-400 font-normal">
                  / 月支出 {sym} {formatTWD(summary.monthlyExpenseTWD)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, summary.expenseCoverageRatio)}%` }}
                  />
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  {milestone.description}
                </div>
              </div>
            </div>

            {/* Card 4: Portfolio Dividend Yield */}
            <div className="bg-[#121216] border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                <span className="font-bold flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-cyan-400" />
                  投組年化現金殖利率
                </span>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-zinc-300 font-extrabold">
                  Yield %
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {summary.portfolioYieldPercent}%
              </div>
              <div className="text-[11px] text-gray-400 mt-2 flex items-center justify-between">
                <span>總庫存被動回報率</span>
                <span className="text-cyan-400 font-bold">高於通膨標準</span>
              </div>
            </div>
          </div>

          {/* 12-Month Passive Income Projection Bar Chart */}
          <div className="bg-[#121216] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span>{selectedYear} 年度 1~12 月股息現金流分佈</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  點選任一月份長條圖可即時篩選該月發放之個股明細與入帳時序
                </p>
              </div>

              {/* Chart Legend & Reset Button */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-gray-300">
                  <div className="w-3 h-3 rounded bg-emerald-500 shadow-sm shadow-emerald-500/40" />
                  <span>已入帳</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-300">
                  <div className="w-3 h-3 rounded bg-sky-500 shadow-sm shadow-sky-500/40" />
                  <span>即將發放</span>
                </div>
                {selectedMonth !== null && (
                  <button
                    onClick={() => setSelectedMonth(null)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition cursor-pointer"
                  >
                    顯示全部月份
                  </button>
                )}
              </div>
            </div>

            {/* 12-Month Bar Columns Container */}
            <div className="grid grid-cols-12 gap-1.5 sm:gap-3 items-end h-56 pt-6 pb-2 px-1 border-b border-white/10">
              {summary.monthlyBuckets.map((bucket) => {
                const isSelected = selectedMonth === bucket.month;
                const totalPct = (bucket.totalTWD / maxMonthlyTotal) * 100;
                const confirmedPct = bucket.totalTWD > 0 ? (bucket.confirmedTWD / bucket.totalTWD) * 100 : 0;
                const declaredPct = bucket.totalTWD > 0 ? (bucket.declaredTWD / bucket.totalTWD) * 100 : 0;

                return (
                  <div
                    key={bucket.month}
                    onClick={() => setSelectedMonth(isSelected ? null : bucket.month)}
                    className={`flex flex-col items-center h-full justify-end group cursor-pointer transition-all ${
                      isSelected ? 'scale-105' : 'hover:scale-102'
                    }`}
                  >
                    {/* Amount Label on top of bar */}
                    <div
                      className={`text-[9px] sm:text-[11px] font-bold mb-1.5 transition whitespace-nowrap ${
                        isSelected
                          ? 'text-cyan-300 font-extrabold scale-110'
                          : bucket.totalTWD > 0
                          ? 'text-gray-300 group-hover:text-white'
                          : 'text-zinc-600'
                      }`}
                    >
                      {bucket.totalTWD > 0
                        ? bucket.totalTWD >= 10000
                          ? `${(bucket.totalTWD / 1000).toFixed(1)}k`
                          : formatTWD(bucket.totalTWD)
                        : '-'}
                    </div>

                    {/* Stacked Vertical Bar */}
                    <div
                      className={`w-full max-w-[36px] rounded-xl overflow-hidden transition-all duration-300 flex flex-col justify-end ${
                        isSelected
                          ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/20'
                          : 'group-hover:opacity-90'
                      }`}
                      style={{
                        height: `${Math.max(4, totalPct)}%`,
                        backgroundColor: bucket.totalTWD === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                      }}
                    >
                      {bucket.totalTWD > 0 && (
                        <>
                          {/* Top portion: Declared / Upcoming */}
                          {declaredPct > 0 && (
                            <div
                              className="w-full bg-gradient-to-t from-sky-500 to-cyan-400 transition-all"
                              style={{ height: `${declaredPct}%` }}
                            />
                          )}
                          {/* Bottom portion: Confirmed / Received */}
                          {confirmedPct > 0 && (
                            <div
                              className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all"
                              style={{ height: `${confirmedPct}%` }}
                            />
                          )}
                        </>
                      )}
                    </div>

                    {/* Month Label below bar */}
                    <div
                      className={`text-[10px] sm:text-xs font-bold mt-2 transition ${
                        isSelected
                          ? 'text-cyan-400 font-extrabold'
                          : 'text-gray-400 group-hover:text-gray-200'
                      }`}
                    >
                      {bucket.month}月
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top Paying Contributors Horizontal Pill Strip */}
            {summary.topContributors.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 overflow-x-auto text-[11px] text-gray-400">
                <span className="shrink-0 font-bold text-gray-300 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  主力貢獻標的：
                </span>
                {summary.topContributors.slice(0, 5).map((c) => (
                  <div
                    key={c.symbol}
                    className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 shrink-0"
                  >
                    <span className="font-extrabold text-white">{c.symbol}</span>
                    <span className="text-gray-400 truncate max-w-[90px]">{c.name}</span>
                    <span className="text-cyan-400 font-bold">{sym}{formatTWD(c.totalTWD)}</span>
                    <span className="text-gray-500 text-[10px]">({c.percentage}%)</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly Dividend Cash Flow Stream / Schedule List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-cyan-400" />
                <span>
                  {selectedMonth !== null ? `${selectedMonth} 月` : `${selectedYear} 全年`} 股息明細與發放排程
                </span>
                <span className="text-xs font-normal text-gray-400">
                  (共 {displayedItems.length} 筆)
                </span>
              </h3>

              {selectedMonth !== null && (
                <button
                  onClick={() => setSelectedMonth(null)}
                  className="text-xs text-cyan-400 hover:underline cursor-pointer"
                >
                  解除月份篩選
                </button>
              )}
            </div>

            {displayedItems.length === 0 ? (
              <div className="bg-[#121216] border border-white/10 rounded-2xl p-8 text-center text-gray-400">
                <Calendar className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">
                  {selectedMonth !== null ? `${selectedMonth} 月無股息發放紀錄` : '該年度無配息紀錄'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  持有之台美股若有公告配息或已除息記錄，將自動在此歸戶呈現
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {displayedItems.map((item) => {
                  const isConfirmed = item.status === 'confirmed';
                  const nativePrefix = item.currency === 'USD' ? '$' : 'NT$';
                  const isDue = !isConfirmed && item.exDate <= todayStr;
                  const matchingStock = stocks.find((s) => s.id === item.stockId || s.symbol === item.symbol);

                  return (
                    <div
                      key={item.id}
                      className={`bg-[#121216] border rounded-2xl p-4 shadow-xl transition relative overflow-hidden ${
                        isConfirmed
                          ? 'border-emerald-500/20 bg-emerald-500/2'
                          : isDue
                          ? 'border-sky-500/40 shadow-sky-500/5'
                          : 'border-white/10'
                      }`}
                    >
                      {/* Top Bar: Stock Symbol & Status Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => matchingStock && onSelectStock?.(matchingStock)}
                            className="text-base font-black text-white hover:text-cyan-400 transition cursor-pointer text-left"
                          >
                            {item.symbol}
                          </button>
                          <span className="text-xs text-gray-400 truncate max-w-[120px] sm:max-w-[160px]">
                            {item.name}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${
                              item.market === 'TW'
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}
                          >
                            {item.market}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isConfirmed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              已入帳
                            </span>
                          ) : isDue ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 animate-pulse">
                              <Clock className="w-3 h-3" />
                              已除息待入帳
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/10 text-gray-300 border border-white/10">
                              <Calendar className="w-3 h-3" />
                              預告發放
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detail Data Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-white/5">
                        <div>
                          <div className="text-[11px] text-gray-500">除息日 / 發放日</div>
                          <div className="text-gray-200 font-medium mt-0.5">
                            {item.exDate} {item.paymentDate && item.paymentDate !== item.exDate && `➔ ${item.paymentDate}`}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[11px] text-gray-500">每股配息 × 在庫股數</div>
                          <div className="text-gray-200 font-medium mt-0.5">
                            {nativePrefix} {item.amountPerShare.toFixed(2)} × {formatTWD(item.shares)} 股
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-gray-500">稅費預扣</div>
                          <div className="text-gray-300 mt-0.5">
                            {item.taxWithheld > 0 ? (
                              <span className="text-rose-400 font-bold">
                                -{nativePrefix} {item.taxWithheld.toFixed(2)}{' '}
                                <span className="text-[10px] text-gray-400 font-normal">
                                  ({item.market === 'US' ? '美股30%預扣' : '二代健保2.11%'})
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-400 font-normal">
                                {item.market === 'TW' ? '免扣補充保費' : '$0.00'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[11px] text-gray-500">實收淨股息 (TWD)</div>
                          <div className="text-base font-black text-white mt-0.5">
                            {sym} {formatTWD(item.netAmountTWD)}
                            {item.currency === 'USD' && (
                              <span className="text-[10px] text-gray-400 font-normal ml-1">
                                (${item.netAmount.toFixed(2)})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Bar (Direct Confirm button if due) */}
                      {!isConfirmed && (
                        <div className="pt-2.5 flex items-center justify-between">
                          <span className="text-[10px] text-gray-500">
                            {isDue ? '⚡ 已到除息基準日，可手動校正或確認入帳' : '尚未到達除息日'}
                          </span>

                          <button
                            onClick={() => {
                              if (matchingStock) {
                                onOpenDividendModal?.(matchingStock, {
                                  date: item.exDate,
                                  amount: item.amountPerShare,
                                  status: isDue ? 'effective_pending' : 'upcoming',
                                  paymentDate: item.paymentDate,
                                });
                              }
                            }}
                            className={`px-3 py-1 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1 ${
                              isDue
                                ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md hover:from-sky-400 hover:to-cyan-400'
                                : 'bg-white/10 hover:bg-white/15 text-gray-300'
                            }`}
                          >
                            <span>{isDue ? '立即入帳確認' : '查看除息詳情'}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
