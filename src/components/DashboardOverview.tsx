import React from 'react';
import { Wallet, TrendingUp, ReceiptText, ArrowUpRight, ArrowDownRight, ChevronRight, Plus } from 'lucide-react';
import { CategoryItem, FIREConfig, FIREResult, QuickPreset, Transaction } from '../types';
import { FIREProgressHero } from './FIREProgressHero';
import { getThemePreset } from '../utils/theme';

interface DashboardOverviewProps {
  transactions: Transaction[];
  categories: CategoryItem[];
  quickPresets: QuickPreset[];
  fireConfig: FIREConfig;
  fireResult: FIREResult;
  onUpdateFIREConfig: (newConfig: FIREConfig) => void;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onOpenQuickAdd: () => void;
  onOpenCategoryManager: () => void;
  onOpenCloudSync: () => void;
  setActiveTab: (tab: 'dashboard' | 'monthly' | 'yearly' | 'ledger' | 'analytics') => void;
  isMobileDeviceView?: boolean;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  transactions,
  categories,
  quickPresets,
  fireConfig,
  fireResult,
  onUpdateFIREConfig,
  onAddTransaction,
  onOpenQuickAdd,
  onOpenCategoryManager,
  onOpenCloudSync,
  setActiveTab,
}) => {
  const currentTheme = getThemePreset(fireConfig.themeColor);
  const sym = fireConfig.currencySymbol || 'NT$';

  // Calculate current month's stats
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const currentMonthTransactions = transactions.filter((t) => t.date.startsWith(currentMonthStr));

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  let monthlyTax = 0;
  let monthlyInvestment = 0;

  currentMonthTransactions.forEach((t) => {
    if (t.type === 'income') monthlyIncome += t.amount;
    if (t.type === 'expense') monthlyExpense += t.amount;
    if (t.type === 'tax') monthlyTax += t.amount;
    if (t.type === 'investment') monthlyInvestment += t.amount;
  });

  const netSavings = monthlyIncome - monthlyExpense - monthlyTax;
  const savingsRate = monthlyIncome > 0 ? ((netSavings / monthlyIncome) * 100).toFixed(1) : '0.0';

  // Financial Health Grade
  const numSavingsRate = parseFloat(savingsRate);
  let healthGrade = 'B';
  let healthDesc = '穩健邁進';

  if (numSavingsRate >= 60) {
    healthGrade = 'S+';
    healthDesc = '極速 FIRE 財務大師';
  } else if (numSavingsRate >= 45) {
    healthGrade = 'S';
    healthDesc = '高效儲蓄累積';
  } else if (numSavingsRate >= 30) {
    healthGrade = 'A';
    healthDesc = '良好退休軌道';
  }

  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(num);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* FIRE Countdown Progress Banner */}
      <FIREProgressHero
        config={fireConfig}
        result={fireResult}
        onUpdateConfig={onUpdateFIREConfig}
      />

      {/* Top Stat Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Income */}
        <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 relative overflow-hidden shadow-lg group hover:border-white/20 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">本月總收入</span>
            <div
              className="p-2 rounded-xl"
              style={{
                backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                color: currentTheme.primaryHex,
              }}
            >
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono">
              {sym} {formatNum(monthlyIncome)}
            </div>
            <div className="text-xs mt-1 flex items-center gap-1 font-medium" style={{ color: currentTheme.primaryHex }}>
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>正職薪資與副業收益</span>
            </div>
          </div>
        </div>

        {/* Monthly Expense */}
        <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 relative overflow-hidden shadow-lg group hover:border-orange-500/30 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">本月總支出</span>
            <div className="p-2 bg-orange-500/10 text-orange-400 rounded-xl">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono">
              {sym} {formatNum(monthlyExpense)}
            </div>
            <div className="text-xs text-orange-400 mt-1 flex items-center gap-1 font-medium">
              <span>占總收入 {(monthlyIncome > 0 ? (monthlyExpense / monthlyIncome) * 100 : 0).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Monthly Tax */}
        <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 relative overflow-hidden shadow-lg group hover:border-purple-500/30 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">本月稅金與規費</span>
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
              <ReceiptText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono">
              {sym} {formatNum(monthlyTax)}
            </div>
            <div className="text-xs text-purple-400 mt-1 font-medium">
              所得稅・補充保費・車輛稅
            </div>
          </div>
        </div>

        {/* Net Savings Rate & Health Grade */}
        <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 relative overflow-hidden shadow-lg group hover:border-white/20 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">淨儲蓄率 & 評級</span>
            <span
              className="px-2 py-0.5 text-xs font-black rounded-lg border"
              style={{
                color: currentTheme.primaryHex,
                backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                borderColor: `rgba(${currentTheme.bgGlowRgb}, 0.3)`,
              }}
            >
              {healthGrade} 級
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono" style={{ color: currentTheme.primaryHex }}>
              {savingsRate}%
            </div>
            <div className="text-xs text-gray-400 mt-1 flex items-center justify-between">
              <span>{healthDesc}</span>
              <span className="text-emerald-400 font-mono font-bold">淨存 {sym}{formatNum(Math.max(0, netSavings))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Section: Recent Activity Ledger Feed */}
      <div className="bg-[#0c0c0c] border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ReceiptText className="w-5 h-5" style={{ color: currentTheme.primaryHex }} /> 近期收支與投資動態
            </h3>
            <p className="text-xs text-gray-400">即時整合記錄之收入、飲食、日常支出、稅金與 FIRE 投資</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenQuickAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-black font-bold text-xs rounded-xl transition cursor-pointer"
              style={{ backgroundColor: currentTheme.primaryHex }}
            >
              <Plus className="w-3.5 h-3.5" /> 記一筆
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className="text-xs font-bold flex items-center gap-1 transition cursor-pointer hover:underline text-gray-300 hover:text-white"
            >
              檢視完整帳簿 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs">
              尚未建立任何記帳動態，點擊右上角「記一筆」新增您的第一筆財務紀錄！
            </div>
          ) : (
            transactions.slice(0, 15).map((t) => {
              let typeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
              let typeSign = '-';
              if (t.type === 'income') {
                typeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                typeSign = '+';
              } else if (t.type === 'investment') {
                typeColor = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
                typeSign = '🚀';
              } else if (t.type === 'tax') {
                typeColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20';
                typeSign = '🏛️';
              }

              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between bg-[#111111] hover:bg-white/5 border border-white/5 p-3.5 rounded-2xl transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`px-2.5 py-1 text-xs font-bold rounded-xl border ${typeColor}`}>
                      {t.mainCategory}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{t.subCategory}</span>
                        {t.isQuickPreset && (
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded border font-mono font-bold"
                            style={{
                              backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                              color: currentTheme.primaryHex,
                              borderColor: `rgba(${currentTheme.bgGlowRgb}, 0.3)`,
                            }}
                          >
                            捷徑記帳
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{t.date}</span>
                        {t.note && <span>• {t.note}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-sm sm:text-base font-extrabold font-mono ${t.type === 'income' ? 'text-emerald-400' : t.type === 'expense' ? 'text-orange-400' : t.type === 'investment' ? 'text-purple-300' : 'text-purple-400'}`}>
                      {typeSign} {sym} {formatNum(t.amount)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
