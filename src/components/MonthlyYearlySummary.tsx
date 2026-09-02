import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  CalendarRange,
  Wallet,
  ArrowDownRight,
  ReceiptText,
  TrendingUp,
  ShieldCheck,
  PieChart,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
} from 'lucide-react';
import { FIREConfig, Transaction, PortfolioStock } from '../types';
import { calculateMonthlyStats, calculateYearlyStats } from '../utils/fireCalculator';
import { getThemePreset } from '../utils/theme';

interface MonthlyYearlySummaryProps {
  transactions: Transaction[];
  portfolioStocks?: PortfolioStock[];
  usdRate?: number;
  fireConfig: FIREConfig;
  initialMode?: 'monthly' | 'yearly';
}

export const MonthlyYearlySummary: React.FC<MonthlyYearlySummaryProps> = ({
  transactions,
  portfolioStocks = [],
  usdRate = 32.0,
  fireConfig,
  initialMode = 'monthly',
}) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>(initialMode);
  const currentTheme = getThemePreset(fireConfig.themeColor);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  useEffect(() => {
    setViewMode(initialMode);
  }, [initialMode]);

  // Available Months & Years extracted from transactions
  const availableMonths = Array.from(
    new Set<string>(transactions.map((t) => t.date.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a));

  const availableYears = Array.from(
    new Set<string>(transactions.map((t) => t.date.slice(0, 4)))
  ).sort((a, b) => b.localeCompare(a));

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const currentYearStr = new Date().getFullYear().toString();

  const [selectedMonth, setSelectedMonth] = useState<string>(
    availableMonths[0] || currentMonthStr
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    availableYears[0] || currentYearStr
  );

  const sym = fireConfig.currencySymbol || 'NT$';
  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(num);

  // Month & Year Steppers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    if (selectedMonth >= currentMonthStr) return;
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const handlePrevYear = () => {
    const y = parseInt(selectedYear, 10);
    setSelectedYear((y - 1).toString());
  };

  const handleNextYear = () => {
    const y = parseInt(selectedYear, 10);
    if (y >= parseInt(currentYearStr, 10)) return;
    setSelectedYear((y + 1).toString());
  };

  // Stats calculation
  const mStats = calculateMonthlyStats(transactions, selectedMonth);
  const yStats = calculateYearlyStats(transactions, selectedYear);

  // Include stock trades into monthly & yearly investment totals
  const monthlyStockInvestment = useMemo(() => {
    let total = 0;
    portfolioStocks.forEach((stock) => {
      stock.transactions?.forEach((tx) => {
        if (tx.type === 'BUY' && tx.date.startsWith(selectedMonth)) {
          const rate = stock.currency === 'USD' ? usdRate : 1;
          total += Math.round(tx.shares * tx.price * rate);
        }
      });
    });
    return total;
  }, [portfolioStocks, selectedMonth, usdRate]);

  const yearlyStockInvestment = useMemo(() => {
    let total = 0;
    portfolioStocks.forEach((stock) => {
      stock.transactions?.forEach((tx) => {
        if (tx.type === 'BUY' && tx.date.startsWith(selectedYear)) {
          const rate = stock.currency === 'USD' ? usdRate : 1;
          total += Math.round(tx.shares * tx.price * rate);
        }
      });
    });
    return total;
  }, [portfolioStocks, selectedYear, usdRate]);

  const totalMonthlyInvest = mStats.totalInvestment + monthlyStockInvestment;
  const totalYearlyInvest = yStats.totalInvestment + yearlyStockInvestment;

  const totalMonthlyNetSavings = mStats.totalIncome - mStats.totalExpense;
  const monthlySavingsPct = mStats.totalIncome > 0 ? ((totalMonthlyNetSavings / mStats.totalIncome) * 100).toFixed(1) : '0.0';

  const totalYearlyNetSavings = yStats.totalIncome - yStats.totalExpense;
  const yearlySavingsPct = yStats.totalIncome > 0 ? ((totalYearlyNetSavings / yStats.totalIncome) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header & View Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0c0c0c] border border-white/5 p-5 rounded-3xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {viewMode === 'monthly' ? (
              <>
                <Calendar className="w-5 h-5" style={{ color: currentTheme.primaryHex }} />
                <span>月度財務總結 (Monthly Summary)</span>
              </>
            ) : (
              <>
                <CalendarRange className="w-5 h-5" style={{ color: currentTheme.primaryHex }} />
                <span>年度財務總結 (Yearly Summary)</span>
              </>
            )}
          </h2>
          <p className="text-xs text-gray-400">
            整合結算收入、生活支出細類與證券投資累積績效
          </p>
        </div>

        {/* Glassmorphic Stepper + Custom Popover Picker */}
        <div className="flex items-center gap-2 relative">
          <div className="flex items-center bg-black/60 border border-white/10 p-1 rounded-2xl shadow-inner">
            <button
              onClick={viewMode === 'monthly' ? handlePrevMonth : handlePrevYear}
              className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer active:scale-95"
              title="前一個週期"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Middle Trigger */}
            <button
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className="px-3 py-1 text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer hover:bg-white/5 rounded-xl"
              style={{ color: viewMode === 'monthly' ? currentTheme.primaryHex : '#67e8f9' }}
            >
              <span>{viewMode === 'monthly' ? `${selectedMonth} 月結` : `${selectedYear} 年結`}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <button
              onClick={viewMode === 'monthly' ? handleNextMonth : handleNextYear}
              disabled={viewMode === 'monthly' ? selectedMonth >= currentMonthStr : parseInt(selectedYear, 10) >= parseInt(currentYearStr, 10)}
              className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
              title="後一個週期"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Custom Popover Dropdown */}
          {isDateDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-[60]"
                onClick={() => setIsDateDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 z-[70] w-48 max-h-60 overflow-y-auto bg-[#141418] border border-white/15 rounded-2xl p-1.5 shadow-2xl space-y-1 animate-fadeIn scrollbar-thin">
                {viewMode === 'monthly' ? (
                  availableMonths.length > 0 ? (
                    availableMonths.map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setSelectedMonth(m);
                          setIsDateDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono font-bold transition text-left cursor-pointer ${
                          selectedMonth === m
                            ? 'bg-white/15 text-white shadow-sm'
                            : 'text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                        style={selectedMonth === m ? { color: currentTheme.primaryHex } : {}}
                      >
                        <span>{m} 月度總結</span>
                        {selectedMonth === m && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-gray-500 text-center font-mono">
                      {selectedMonth}
                    </div>
                  )
                ) : (
                  availableYears.length > 0 ? (
                    availableYears.map((y) => (
                      <button
                        key={y}
                        onClick={() => {
                          setSelectedYear(y);
                          setIsDateDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono font-bold transition text-left cursor-pointer ${
                          selectedYear === y
                            ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                            : 'text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span>{y} 年度總結</span>
                        {selectedYear === y && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-gray-500 text-center font-mono">
                      {selectedYear}
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MONTHLY SUMMARY VIEW */}
      {viewMode === 'monthly' && (
        <div className="space-y-6">
          {/* Monthly High-level Summary Cards (Unified 4-Card Matrix) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-[#111111] border border-white/5 p-4 rounded-2xl space-y-1">
              <span className="text-xs text-gray-400">當月總收入</span>
              <div className="text-lg font-bold font-mono" style={{ color: currentTheme.primaryHex }}>
                {sym} {formatNum(mStats.totalIncome)}
              </div>
              <p className="text-[10px] text-gray-500 truncate">薪資與各類收入總和</p>
            </div>

            <div className="bg-[#111111] border border-white/5 p-4 rounded-2xl space-y-1">
              <span className="text-xs text-gray-400">生活總支出</span>
              <div className="text-lg font-bold font-mono text-orange-400">
                {sym} {formatNum(mStats.totalExpense)}
              </div>
              <p className="text-[10px] text-orange-400/80 truncate">
                占收入 {mStats.totalIncome > 0 ? ((mStats.totalExpense / mStats.totalIncome) * 100).toFixed(1) : 0}%
              </p>
            </div>

            <div className="bg-[#111111] border border-white/5 p-4 rounded-2xl space-y-1">
              <span className="text-xs text-gray-400">投資資產投入</span>
              <div className="text-lg font-bold font-mono text-cyan-400">
                {sym} {formatNum(totalMonthlyInvest)}
              </div>
              <p className="text-[10px] text-cyan-400/80 truncate">含定期定額與買股累積</p>
            </div>

            <div className="bg-[#111111] border border-white/5 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>淨儲蓄率</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">
                  +{sym}{formatNum(Math.max(0, totalMonthlyNetSavings))}
                </span>
              </div>
              <div className="text-lg font-bold font-mono" style={{ color: currentTheme.primaryHex }}>
                {monthlySavingsPct}%
              </div>
              <p className="text-[10px] text-gray-500 truncate">當月結餘比率</p>
            </div>
          </div>

          {/* Detailed Category Expense Breakdown */}
          <div className="bg-[#0c0c0c] border border-white/5 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <PieChart className="w-5 h-5" style={{ color: currentTheme.primaryHex }} />
              {selectedMonth} 支出分類與細項結算
            </h3>

            <div className="space-y-4">
              {Object.entries(mStats.mainCategoryMap).length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">該月份尚無支出紀錄</p>
              ) : (
                Object.entries(mStats.mainCategoryMap).map(([mainCat, amount]) => {
                  const percent = mStats.totalExpense > 0 ? ((amount / mStats.totalExpense) * 100).toFixed(1) : '0';

                  // Extract subcategories under this main category
                  const subCategoriesForMain = Object.entries(mStats.subCategoryMap)
                    .filter(([key]) => key.startsWith(`${mainCat} >`))
                    .map(([key, subAmt]) => ({
                      subName: key.split(' > ')[1],
                      subAmt,
                    }));

                  return (
                    <div key={mainCat} className="bg-[#111111] p-4 rounded-2xl border border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-200">{mainCat}</span>
                        <div className="text-sm font-mono font-bold text-orange-300">
                          {sym} {formatNum(amount)} <span className="text-xs text-gray-400 font-normal">({percent}%)</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full shadow-md"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: currentTheme.primaryHex,
                          }}
                        />
                      </div>

                      {/* Fine Subcategories Pills */}
                      {subCategoriesForMain.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                          {subCategoriesForMain.map((sub) => (
                            <span
                              key={sub.subName}
                              className="px-2.5 py-1 bg-black/40 text-gray-300 text-xs rounded-xl border border-white/5 flex items-center gap-1.5 max-w-full"
                              title={`${sub.subName}: ${sym} ${formatNum(sub.subAmt)}`}
                            >
                              <span className="text-gray-400 truncate max-w-[140px] sm:max-w-[200px]">{sub.subName}:</span>
                              <strong className="font-mono whitespace-nowrap" style={{ color: currentTheme.primaryHex }}>{sym} {formatNum(sub.subAmt)}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* YEARLY SUMMARY VIEW */}
      {viewMode === 'yearly' && (
        <div className="space-y-6">
          {/* Yearly High-level Summary (Unified 4-Card Matrix) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-[#111111] border border-white/5 p-4 rounded-2xl space-y-1">
              <span className="text-xs text-gray-400">{selectedYear} 全年總收入</span>
              <div className="text-lg font-bold font-mono" style={{ color: currentTheme.primaryHex }}>
                {sym} {formatNum(yStats.totalIncome)}
              </div>
              <p className="text-[10px] text-gray-500 truncate">年度所有收入累計</p>
            </div>

            <div className="bg-[#111111] border border-white/5 p-4 rounded-2xl space-y-1">
              <span className="text-xs text-gray-400">{selectedYear} 全年生活支出</span>
              <div className="text-lg font-bold font-mono text-orange-400">
                {sym} {formatNum(yStats.totalExpense)}
              </div>
              <p className="text-[10px] text-orange-400/80 truncate">
                占收入 {yStats.totalIncome > 0 ? ((yStats.totalExpense / yStats.totalIncome) * 100).toFixed(1) : 0}%
              </p>
            </div>

            <div className="bg-[#111111] border border-white/5 p-4 rounded-2xl space-y-1">
              <span className="text-xs text-gray-400">{selectedYear} 全年投資注入</span>
              <div className="text-lg font-bold font-mono text-cyan-400">
                {sym} {formatNum(totalYearlyInvest)}
              </div>
              <p className="text-[10px] text-cyan-400/80 truncate">年度證券與定期定額投入</p>
            </div>

            <div className="bg-[#111111] border border-white/5 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>年度平均淨儲蓄率</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">
                  +{sym}{formatNum(Math.max(0, totalYearlyNetSavings))}
                </span>
              </div>
              <div className="text-lg font-bold font-mono" style={{ color: currentTheme.primaryHex }}>
                {yearlySavingsPct}%
              </div>
              <p className="text-[10px] text-gray-500 truncate">全年淨儲蓄結餘</p>
            </div>
          </div>

          {/* Month-by-Month Annual Table */}
          <div className="bg-[#0c0c0c] border border-white/5 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">
              {selectedYear} 年度逐月財務結算明細
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-gray-300">
                <thead className="bg-black/60 text-gray-400 uppercase text-[11px] font-mono border-b border-white/10">
                  <tr>
                    <th className="p-3">月份</th>
                    <th className="p-3">收入</th>
                    <th className="p-3">支出</th>
                    <th className="p-3">稅金</th>
                    <th className="p-3">投資額</th>
                    <th className="p-3">月淨儲蓄</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {yStats.monthlyBreakdown.map((row) => (
                    <tr key={row.month} className="hover:bg-white/5 transition">
                      <td className="p-3 font-bold text-white">{row.month}</td>
                      <td className="p-3" style={{ color: currentTheme.primaryHex }}>{sym} {formatNum(row.income)}</td>
                      <td className="p-3 text-orange-400">{sym} {formatNum(row.expense)}</td>
                      <td className="p-3 text-purple-400">{sym} {formatNum(row.tax)}</td>
                      <td className="p-3 text-purple-300">{sym} {formatNum(row.investment)}</td>
                      <td className={`p-3 font-bold ${row.netSavings >= 0 ? '' : 'text-rose-500'}`} style={{ color: row.netSavings >= 0 ? currentTheme.primaryHex : undefined }}>
                        {sym} {formatNum(row.netSavings)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
