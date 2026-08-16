import React, { useState } from 'react';
import { PieChart as PieChartIcon, TrendingUp, BarChart3, ShieldCheck, DollarSign } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { FIREConfig, Transaction } from '../types';
import { generateFIRETrajectoryCurve } from '../utils/fireCalculator';
import { getThemePreset } from '../utils/theme';

interface AnalyticsChartsProps {
  transactions: Transaction[];
  fireConfig: FIREConfig;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  transactions,
  fireConfig,
}) => {
  const currentTheme = getThemePreset(fireConfig.themeColor);
  const sym = fireConfig.currencySymbol || 'NT$';
  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(num);

  const themeColors = [
    currentTheme.primaryHex,
    '#f97316', // Orange
    '#a855f7', // Purple
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#f43f5e', // Rose
    '#eab308', // Yellow
    '#6366f1', // Indigo
  ];

  // 1. Expense Category Donut Data
  const expenseTransactions = transactions.filter((t) => t.type === 'expense');
  const mainCatMap: Record<string, number> = {};
  const subCatMap: Record<string, number> = {};

  expenseTransactions.forEach((t) => {
    mainCatMap[t.mainCategory] = (mainCatMap[t.mainCategory] || 0) + t.amount;
    const subKey = `${t.mainCategory}-${t.subCategory}`;
    subCatMap[subKey] = (subCatMap[subKey] || 0) + t.amount;
  });

  const pieData = Object.entries(mainCatMap).map(([name, value]) => ({
    name,
    value,
  }));

  // 2. Monthly Trend Bar Data (Last 6 Months)
  const monthMap: Record<string, { month: string; income: number; expense: number; tax: number; investment: number }> = {};
  
  transactions.forEach((t) => {
    const m = t.date.slice(0, 7);
    if (!monthMap[m]) {
      monthMap[m] = { month: m, income: 0, expense: 0, tax: 0, investment: 0 };
    }
    if (t.type === 'income') monthMap[m].income += t.amount;
    if (t.type === 'expense') monthMap[m].expense += t.amount;
    if (t.type === 'tax') monthMap[m].tax += t.amount;
    if (t.type === 'investment') monthMap[m].investment += t.amount;
  });

  const monthlyTrendData = Object.values(monthMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  // 3. FIRE Trajectory Projection Curve
  const fireCurveData = generateFIRETrajectoryCurve(fireConfig, 20);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-[#0c0c0c] border border-white/5 p-6 rounded-3xl">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <PieChartIcon className="w-6 h-6" style={{ color: currentTheme.primaryHex }} />
          財務圖表視覺化分析 (Financial Data Analytics)
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          直觀剖析支出佔比、收支趨勢與 20 年 FIRE 淨資產複利累積曲線
        </p>
      </div>

      {/* Grid: Donut Chart vs Monthly Trend Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Expense Category Donut Chart */}
        <div className="bg-[#0c0c0c] border border-white/5 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" style={{ color: currentTheme.primaryHex }} /> 支出大類佔比分析
            </h3>
            <span className="text-xs text-gray-400 font-mono">
              總支出: {sym} {formatNum(expenseTransactions.reduce((acc, t) => acc + t.amount, 0))}
            </span>
          </div>

          {pieData.length === 0 ? (
            <div className="h-72 w-full flex flex-col items-center justify-center text-gray-500 text-xs space-y-2 border border-dashed border-white/5 rounded-2xl">
              <PieChartIcon className="w-8 h-8 stroke-[1.5] opacity-40" />
              <span>尚無支出記帳資料，記錄支出後即可查看佔比分析</span>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={themeColors[index % themeColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [`${sym} ${formatNum(val)}`, '總額']}
                    contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#222', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend formatter={(val) => <span className="text-xs text-gray-300">{val}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Monthly Income vs Expense Bar Chart */}
        <div className="bg-[#0c0c0c] border border-white/5 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4" style={{ color: currentTheme.primaryHex }} /> 近 6 個月收支稅金對比
            </h3>
            <span className="text-xs text-gray-400">柱狀消長趨勢</span>
          </div>

          {monthlyTrendData.length === 0 ? (
            <div className="h-72 w-full flex flex-col items-center justify-center text-gray-500 text-xs space-y-2 border border-dashed border-white/5 rounded-2xl">
              <BarChart3 className="w-8 h-8 stroke-[1.5] opacity-40" />
              <span>尚無月度收支紀錄，新增紀錄後即會自動生成趨勢柱狀圖</span>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="month" stroke="#888" fontSize={11} />
                  <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip
                    formatter={(val: number) => [`${sym} ${formatNum(val)}`, '']}
                    contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#222', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend formatter={(val) => <span className="text-xs text-gray-300">{val === 'income' ? '收入' : val === 'expense' ? '支出' : val === 'tax' ? '稅金' : '投資'}</span>} />
                  <Bar dataKey="income" name="income" fill={currentTheme.primaryHex} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="expense" fill="#f97316" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="tax" name="tax" fill="#a855f7" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="investment" name="investment" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* FIRE Net Worth Trajectory Area Curve */}
      <div className="bg-[#0c0c0c] border border-white/5 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: currentTheme.primaryHex }} /> 20 年 FIRE 淨資產滾存預測曲線
            </h3>
            <p className="text-xs text-gray-400">
              考量預期報酬 ({fireConfig.expectedInvestmentReturnRate}%) 與通膨 ({fireConfig.expectedInflationRate}%) 之資產複利滾存
            </p>
          </div>
          <div className="text-right font-mono text-xs font-bold" style={{ color: currentTheme.primaryHex }}>
            目標 FIRE: {sym} {formatNum(fireCurveData[0]?.targetFIRE || 0)}
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fireCurveData}>
              <defs>
                <linearGradient id="colorNW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={currentTheme.primaryHex} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={currentTheme.primaryHex} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="yearLabel" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip
                formatter={(val: number) => [`${sym} ${formatNum(val)}`, '']}
                contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#222', borderRadius: '12px', color: '#fff' }}
              />
              <Legend formatter={(val) => <span className="text-xs text-gray-300">{val === 'netWorth' ? '預估資產累積' : 'FIRE 標準目標線'}</span>} />
              <Area type="monotone" dataKey="netWorth" name="netWorth" stroke={currentTheme.primaryHex} strokeWidth={3} fillOpacity={1} fill="url(#colorNW)" />
              <Area type="monotone" dataKey="targetFIRE" name="targetFIRE" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorTarget)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
