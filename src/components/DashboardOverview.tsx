import React, { useMemo } from 'react';
import { Wallet, TrendingUp, ReceiptText, ArrowUpRight, ArrowDownRight, ChevronRight, Plus } from 'lucide-react';
import { CategoryItem, FIREConfig, FIREResult, QuickPreset, Transaction, PortfolioStock } from '../types';
import { FIREProgressHero } from './FIREProgressHero';
import { getThemePreset } from '../utils/theme';

interface DashboardOverviewProps {
  transactions: Transaction[];
  categories: CategoryItem[];
  quickPresets: QuickPreset[];
  fireConfig: FIREConfig;
  fireResult: FIREResult;
  stockMarketValue?: number;
  portfolioStocks?: PortfolioStock[];
  usdRate?: number;
  onUpdateFIREConfig: (newConfig: FIREConfig) => void;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onOpenQuickAdd: () => void;
  onOpenCategoryManager: () => void;
  onOpenCloudSync: () => void;
  setActiveTab: (tab: 'dashboard' | 'monthly' | 'yearly' | 'ledger' | 'analytics' | 'portfolio') => void;
  isMobileDeviceView?: boolean;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  transactions,
  categories,
  quickPresets,
  fireConfig,
  fireResult,
  stockMarketValue = 0,
  portfolioStocks = [],
  usdRate = 32.0,
  onUpdateFIREConfig,
  onAddTransaction,
  onOpenQuickAdd,
  onOpenCategoryManager,
  onOpenCloudSync,
  setActiveTab,
}) => {
  const currentTheme = getThemePreset(fireConfig.themeColor);
  const sym = fireConfig.currencySymbol || 'NT$';
  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(num);
  const formatDec = (num: number) =>
    num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  // Merge regular transactions with stock trades into a unified timeline
  const unifiedActivities = useMemo(() => {
    const items: Array<{
      id: string;
      source: 'ledger' | 'stock';
      displayDate: string;
      title: string;
      category: string;
      tag?: string;
      amountFormatted: string;
      isPositive: boolean;
      icon: string;
      timestamp: number;
    }> = [];

    // 1. Regular ledger transactions
    transactions.forEach((t) => {
      let icon = '📝';
      const mainCatLower = t.mainCategory.toLowerCase();
      if (mainCatLower.includes('飲食') || mainCatLower.includes('餐') || mainCatLower.includes('食')) icon = '🍔';
      else if (mainCatLower.includes('交通') || mainCatLower.includes('車') || mainCatLower.includes('油')) icon = '🚗';
      else if (mainCatLower.includes('居住') || mainCatLower.includes('房') || mainCatLower.includes('水電')) icon = '🏠';
      else if (mainCatLower.includes('娛樂') || mainCatLower.includes('遊') || mainCatLower.includes('影')) icon = '🎮';
      else if (mainCatLower.includes('教育') || mainCatLower.includes('學') || mainCatLower.includes('書')) icon = '📚';
      else if (mainCatLower.includes('醫療') || mainCatLower.includes('健') || mainCatLower.includes('醫')) icon = '💊';
      else if (mainCatLower.includes('購物') || mainCatLower.includes('日常') || mainCatLower.includes('服飾')) icon = '🛍️';
      else if (t.type === 'income') icon = '💵';
      else if (t.type === 'tax') icon = '🏛️';
      else if (t.type === 'investment') icon = '📈';

      let displayDate = t.date;
      if (t.date.length >= 10) {
        displayDate = t.date.slice(5, 10).replace('-', '/'); // MM/DD
      }

      const isPositive = t.type === 'income';

      items.push({
        id: `ledger-${t.id}`,
        source: 'ledger',
        displayDate,
        title: t.subCategory || t.mainCategory,
        category: t.mainCategory,
        tag: t.isQuickPreset ? '捷徑記帳' : undefined,
        amountFormatted: `${isPositive ? '+' : '-'} ${sym} ${formatNum(t.amount)}`,
        isPositive,
        icon,
        timestamp: new Date(t.date).getTime() || 0,
      });
    });

    // 2. Stock trades from portfolioStocks
    (portfolioStocks || []).forEach((stock) => {
      const isUS = stock.market === 'US';
      const stockCurrency = isUS ? '$' : 'NT$';

      (stock.transactions || []).forEach((st) => {
        let displayDate = st.date;
        if (st.date.length >= 10) {
          displayDate = st.date.slice(5, 10).replace('-', '/'); // MM/DD
        }

        const isBuy = st.type === 'BUY';
        const isSell = st.type === 'SELL';

        let typeActionLabel = '買入';
        let icon = '📈';
        let isPositive = false;

        if (isBuy) {
          typeActionLabel = '買入';
          icon = '📈';
          isPositive = false;
        } else if (isSell) {
          typeActionLabel = '賣出';
          icon = '💰';
          isPositive = true;
        } else {
          typeActionLabel = '股利';
          icon = '🎁';
          isPositive = true;
        }

        const totalTradeVal = st.shares * st.price;

        items.push({
          id: `stock-${st.id}`,
          source: 'stock',
          displayDate,
          title: `${stock.symbol} ${typeActionLabel} ${formatNum(st.shares)} 股`,
          category: isUS ? `美股 • ${stock.name}` : `台股 • ${stock.name}`,
          tag: isUS ? '美股' : '台股',
          amountFormatted: `${isPositive ? '+' : '-'} ${stockCurrency}${formatDec(totalTradeVal)}`,
          isPositive,
          icon,
          timestamp: new Date(st.date).getTime() || 0,
        });
      });
    });

    // Sort descending by timestamp / date
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, portfolioStocks, sym, usdRate]);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Hero Financial Freedom Progress Card */}
      <FIREProgressHero
        config={fireConfig}
        result={fireResult}
        stockMarketValue={stockMarketValue}
        onUpdateConfig={onUpdateFIREConfig}
      />

      {/* Option B: Unified Monthly Pulse Financial Dashboard Panel (Apple / Revolut Style) */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: currentTheme.primaryHex }}
            />
            <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
              本月收支與財務脈動
            </span>
          </div>
          <span className="text-[11px] text-gray-400 font-mono">
            {new Date().getFullYear()} 年 {new Date().getMonth() + 1} 月
          </span>
        </div>

        {/* 4-in-1 Compact Tiles Grid (2x2 on Mobile, 4-in-1 on Desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* 1. Monthly Income */}
          <div className="bg-[#141417] border border-white/5 rounded-2xl p-3 sm:p-3.5 space-y-1 hover:border-white/10 transition">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span className="font-medium">本月總收入</span>
              <div
                className="p-1 rounded-lg"
                style={{
                  backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                  color: currentTheme.primaryHex,
                }}
              >
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-base sm:text-lg font-black text-white font-mono whitespace-nowrap">
              {sym} {formatNum(monthlyIncome)}
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-0.5 font-medium truncate">
              <ArrowUpRight className="w-3 h-3 shrink-0" />
              <span>薪資與副業收益</span>
            </div>
          </div>

          {/* 2. Monthly Expense */}
          <div className="bg-[#141417] border border-white/5 rounded-2xl p-3 sm:p-3.5 space-y-1 hover:border-orange-500/20 transition">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span className="font-medium">本月總支出</span>
              <div className="p-1 bg-orange-500/10 text-orange-400 rounded-lg">
                <ArrowDownRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-base sm:text-lg font-black text-white font-mono whitespace-nowrap">
              {sym} {formatNum(monthlyExpense)}
            </div>
            <div className="text-[10px] text-orange-400 flex items-center gap-0.5 font-medium truncate">
              <span>占收入 {(monthlyIncome > 0 ? (monthlyExpense / monthlyIncome) * 100 : 0).toFixed(1)}%</span>
            </div>
          </div>

          {/* 3. Monthly Tax */}
          <div className="bg-[#141417] border border-white/5 rounded-2xl p-3 sm:p-3.5 space-y-1 hover:border-purple-500/20 transition">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span className="font-medium">稅金與規費</span>
              <div className="p-1 bg-purple-500/10 text-purple-400 rounded-lg">
                <ReceiptText className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-base sm:text-lg font-black text-white font-mono whitespace-nowrap">
              {sym} {formatNum(monthlyTax)}
            </div>
            <div className="text-[10px] text-purple-400 font-medium truncate">
              所得稅・補充保費
            </div>
          </div>

          {/* 4. Net Savings & Grade */}
          <div className="bg-[#141417] border border-white/5 rounded-2xl p-3 sm:p-3.5 space-y-1 hover:border-white/10 transition">
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span className="font-medium">淨儲蓄率</span>
              <span
                className="px-1.5 py-0.2 text-[10px] font-black rounded-md border"
                style={{
                  color: currentTheme.primaryHex,
                  backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                  borderColor: `rgba(${currentTheme.bgGlowRgb}, 0.3)`,
                }}
              >
                {healthGrade} 級
              </span>
            </div>
            <div
              className="text-base sm:text-lg font-black font-mono whitespace-nowrap"
              style={{ color: currentTheme.primaryHex }}
            >
              {savingsRate}%
            </div>
            <div className="text-[10px] text-gray-400 flex items-center justify-between gap-1 font-medium truncate">
              <span>{healthDesc}</span>
              <span className="text-emerald-400 font-mono font-bold">
                +{sym}{formatNum(Math.max(0, netSavings))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Section: Unified Activity Feed (Revolut/Apple Style) */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2 tracking-tight">
              <ReceiptText className="w-5 h-5 shrink-0" style={{ color: currentTheme.primaryHex }} />
              <span>近期財務與投資動態</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 truncate">
              收支明細與美台股買賣交易即時串流
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenQuickAdd}
              className="flex items-center gap-1 px-3 py-1.5 text-black font-bold text-xs rounded-xl transition cursor-pointer shadow-md active:scale-95 whitespace-nowrap"
              style={{ backgroundColor: currentTheme.primaryHex }}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" /> 記一筆
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-bold flex items-center gap-1 transition cursor-pointer rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white whitespace-nowrap"
              title="檢視完整帳簿明細"
            >
              <span className="hidden sm:inline">完整帳簿</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {unifiedActivities.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs">
              尚未建立任何記帳或投資交易，點擊右上角「記一筆」新增您的第一筆財務紀錄！
            </div>
          ) : (
            unifiedActivities.slice(0, 15).map((act) => (
              <div
                key={act.id}
                onClick={() => {
                  if (act.source === 'stock') {
                    setActiveTab('portfolio');
                  } else {
                    setActiveTab('ledger');
                  }
                }}
                className="flex items-center justify-between bg-[#121215] hover:bg-white/5 border border-white/5 p-3 rounded-2xl transition cursor-pointer group"
              >
                {/* Left: Icon Pill + Text Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
                    {act.icon}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-white tracking-tight truncate max-w-[150px] xs:max-w-[190px] sm:max-w-[320px]">
                        {act.title}
                      </span>
                      {act.tag && (
                        <span
                          className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-mono font-bold whitespace-nowrap shrink-0"
                          style={{
                            backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                            color: currentTheme.primaryHex,
                            borderColor: `rgba(${currentTheme.bgGlowRgb}, 0.3)`,
                          }}
                        >
                          {act.tag}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                      <span className="font-mono text-gray-300 font-medium">{act.displayDate}</span>
                      <span className="text-gray-600">•</span>
                      <span className="truncate max-w-[140px] sm:max-w-[220px]">{act.category}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Clean Single-line Amount with whitespace-nowrap */}
                <div className="shrink-0 text-right min-w-[85px] sm:min-w-[110px]">
                  <div
                    className={`text-sm sm:text-base font-black font-mono whitespace-nowrap ${
                      act.isPositive ? 'text-emerald-400' : 'text-orange-400'
                    }`}
                  >
                    {act.amountFormatted}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
