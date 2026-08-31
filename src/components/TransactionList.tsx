import React, { useState, useMemo } from 'react';
import {
  Search,
  Trash2,
  Download,
  Plus,
  ReceiptText,
  RotateCcw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Folder,
  ChevronDown,
} from 'lucide-react';
import { CategoryItem, FIREConfig, Transaction } from '../types';
import { getThemePreset } from '../utils/theme';
import { ConfirmModal } from './ConfirmModal';

interface TransactionListProps {
  transactions: Transaction[];
  categories: CategoryItem[];
  fireConfig: FIREConfig;
  onDeleteTransaction: (id: string) => void;
  onOpenQuickAdd: () => void;
  onResetDefaultData: () => void;
  onClearAllData?: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  categories,
  fireConfig,
  onDeleteTransaction,
  onOpenQuickAdd,
  onResetDefaultData,
  onClearAllData,
}) => {
  const currentTheme = getThemePreset(fireConfig.themeColor);
  const sym = fireConfig.currencySymbol || 'NT$';
  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(num);

  const currentMonthStr = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tempSelectedCategories, setTempSelectedCategories] = useState<string[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Deletion Confirm Modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; amount: number } | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);

  // Count items per category under current month
  const categoryCounts = useMemo(() => {
    const map: { [name: string]: number } = {};
    transactions.forEach((t) => {
      if (selectedMonth !== 'all' && !t.date.startsWith(selectedMonth)) return;
      map[t.mainCategory] = (map[t.mainCategory] || 0) + 1;
    });
    return map;
  }, [transactions, selectedMonth]);

  // Available unique months list sorted descending
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add(currentMonthStr);
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        monthsSet.add(t.date.slice(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [transactions, currentMonthStr]);

  // Stepper handlers for month
  const handlePrevMonth = () => {
    if (selectedMonth === 'all') {
      setSelectedMonth(availableMonths[0] || currentMonthStr);
      return;
    }
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    const newMonth = `${y}-${String(m).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 'all') {
      setSelectedMonth(availableMonths[0] || currentMonthStr);
      return;
    }
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const newMonth = `${y}-${String(m).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  // Filter transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedMonth !== 'all' && !t.date.startsWith(selectedMonth)) return false;
      if (selectedType !== 'all' && t.type !== selectedType) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(t.mainCategory)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchCat = t.mainCategory.toLowerCase().includes(q);
        const matchSub = t.subCategory.toLowerCase().includes(q);
        const matchNote = t.note?.toLowerCase().includes(q) || false;
        const matchAmt = t.amount.toString().includes(q);
        if (!matchCat && !matchSub && !matchNote && !matchAmt) return false;
      }
      return true;
    });
  }, [transactions, selectedMonth, selectedType, selectedCategories, search]);

  // Calculate statistics on filtered transactions
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let tax = 0;
    let investment = 0;

    filtered.forEach((t) => {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
      else if (t.type === 'tax') tax += t.amount;
      else if (t.type === 'investment') investment += t.amount;
    });

    const net = income - expense - tax;
    return { income, expense, tax, investment, net };
  }, [filtered]);

  // Group filtered transactions by date (descending)
  const groupedByDate = useMemo(() => {
    const groups: { [date: string]: Transaction[] } = {};
    filtered.forEach((t) => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });

    // Sort dates descending
    const sortedDates = Object.keys(groups).sort().reverse();
    return sortedDates.map((date) => {
      const items = groups[date];
      let dayExpense = 0;
      let dayIncome = 0;
      items.forEach((item) => {
        if (item.type === 'income') dayIncome += item.amount;
        else if (item.type === 'expense') dayExpense += item.amount;
      });

      // Format weekday
      let weekdayStr = '';
      try {
        const d = new Date(date);
        const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
        weekdayStr = weekdays[d.getDay()] || '';
      } catch (e) {
        weekdayStr = '';
      }

      return {
        date,
        weekdayStr,
        dayExpense,
        dayIncome,
        items,
      };
    });
  }, [filtered]);

  // Helper for category emoji
  const getCategoryIcon = (mainCat: string, type: string) => {
    const cat = mainCat.toLowerCase();
    if (cat.includes('飲食') || cat.includes('餐') || cat.includes('食') || cat.includes('早') || cat.includes('午') || cat.includes('晚')) return '🍔';
    if (cat.includes('交通') || cat.includes('車') || cat.includes('油') || cat.includes('高鐵') || cat.includes('捷運')) return '🚗';
    if (cat.includes('居住') || cat.includes('房') || cat.includes('水電') || cat.includes('瓦斯')) return '🏠';
    if (cat.includes('娛樂') || cat.includes('遊') || cat.includes('影') || cat.includes('電玩')) return '🎮';
    if (cat.includes('教育') || cat.includes('學') || cat.includes('書') || cat.includes('課')) return '📚';
    if (cat.includes('醫療') || cat.includes('健') || cat.includes('醫') || cat.includes('藥')) return '💊';
    if (cat.includes('購物') || cat.includes('日常') || cat.includes('服飾') || cat.includes('生活')) return '🛍️';
    if (type === 'income') return '💵';
    if (type === 'tax') return '🏛️';
    if (type === 'investment') return '📈';
    return '📝';
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', '日期', '類型', '大類', '細類細項', '金額', '備註說明'];
    const rows = filtered.map((t) => [
      t.id,
      t.date,
      t.type,
      t.mainCategory,
      t.subCategory,
      t.amount,
      `"${t.note || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FIRE_Ledger_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format month for display
  const displayMonthLabel = (m: string) => {
    if (m === 'all') return '全部歷史明細';
    const [y, mon] = m.split('-');
    return `${y} 年 ${parseInt(mon, 10)} 月`;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header & Action Buttons */}
      <div className="bg-[#0c0c0c] border border-white/5 p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ReceiptText className="w-5 h-5" style={{ color: currentTheme.primaryHex }} />
              收支明細總帳
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">即時統計飲食、交通、日常、稅金與投資動態</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-semibold rounded-xl border border-white/10 transition cursor-pointer"
              title="匯出目前篩選結果為 CSV"
            >
              <Download className="w-3.5 h-3.5" style={{ color: currentTheme.primaryHex }} />
              <span className="hidden xs:inline">匯出</span> CSV
            </button>

            <button
              onClick={() => setIsClearAllConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold rounded-xl border border-rose-500/30 transition cursor-pointer"
              title="清空所有本機資料"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              清空
            </button>

            <button
              onClick={onResetDefaultData}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 text-xs font-semibold rounded-xl border border-white/10 transition cursor-pointer"
              title="重設為預設數據"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重設範例
            </button>

            <button
              onClick={onOpenQuickAdd}
              className="flex items-center gap-1.5 px-4 py-2 text-black font-bold text-xs rounded-xl transition cursor-pointer shadow-md active:scale-95 whitespace-nowrap"
              style={{
                backgroundColor: currentTheme.primaryHex,
                boxShadow: `0 0 12px rgba(${currentTheme.bgGlowRgb}, 0.3)`,
              }}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              記一筆
            </button>
          </div>
        </div>

        {/* Month Stepper Selector */}
        <div className="flex items-center justify-between bg-black/60 border border-white/10 p-2 rounded-2xl">
          <button
            onClick={handlePrevMonth}
            disabled={selectedMonth === 'all'}
            className={`p-2 rounded-xl border border-white/5 transition flex items-center justify-center ${
              selectedMonth === 'all'
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-white/10 text-gray-300 hover:text-white cursor-pointer active:scale-95'
            }`}
            title="上一個月"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: currentTheme.primaryHex }} />
            <span className="font-bold text-sm text-white font-mono">
              {displayMonthLabel(selectedMonth)}
            </span>
            <button
              onClick={() => setSelectedMonth(selectedMonth === 'all' ? currentMonthStr : 'all')}
              className={`text-[11px] px-2 py-0.5 rounded-lg border font-semibold transition cursor-pointer ${
                selectedMonth === 'all'
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:text-gray-200'
              }`}
            >
              {selectedMonth === 'all' ? '切回當月' : '看全部歷史'}
            </button>
          </div>

          <button
            onClick={handleNextMonth}
            disabled={selectedMonth === 'all'}
            className={`p-2 rounded-xl border border-white/5 transition flex items-center justify-center ${
              selectedMonth === 'all'
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-white/10 text-gray-300 hover:text-white cursor-pointer active:scale-95'
            }`}
            title="下一個月"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Real-time Filtered Summary Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
            <div className="text-[11px] text-gray-400 flex items-center justify-between">
              <span>總收入</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-sm sm:text-base font-black font-mono text-emerald-400 mt-1 whitespace-nowrap">
              +{sym} {formatNum(stats.income)}
            </div>
          </div>

          <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
            <div className="text-[11px] text-gray-400 flex items-center justify-between">
              <span>總支出</span>
              <ArrowDownRight className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <div className="text-sm sm:text-base font-black font-mono text-orange-400 mt-1 whitespace-nowrap">
              -{sym} {formatNum(stats.expense)}
            </div>
          </div>

          <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
            <div className="text-[11px] text-gray-400 flex items-center justify-between">
              <span>稅金與規費</span>
              <ReceiptText className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-sm sm:text-base font-black font-mono text-purple-300 mt-1 whitespace-nowrap">
              {sym} {formatNum(stats.tax)}
            </div>
          </div>

          <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
            <div className="text-[11px] text-gray-400 flex items-center justify-between">
              <span>當期結餘</span>
              <span className={`text-[10px] font-bold ${stats.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.net >= 0 ? '淨存' : '透支'}
              </span>
            </div>
            <div className={`text-sm sm:text-base font-black font-mono mt-1 whitespace-nowrap ${stats.net >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
              {stats.net >= 0 ? '+' : ''}{sym} {formatNum(stats.net)}
            </div>
          </div>
        </div>

        {/* Quick Filter: Types & Category Pill Chips */}
        <div className="space-y-2.5 pt-1 border-t border-white/5">
          {/* Row 1: Types Pill Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {[
              { id: 'all', label: '全部類型', icon: '📝' },
              { id: 'expense', label: '支出', icon: '💸' },
              { id: 'income', label: '收入', icon: '💰' },
              { id: 'tax', label: '稅金', icon: '🏛️' },
              { id: 'investment', label: '投資', icon: '📈' },
            ].map((t) => {
              const isActive = selectedType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-white text-black shadow-md scale-100'
                      : 'bg-black/60 hover:bg-white/10 text-gray-400 hover:text-gray-200 border border-white/5'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Row 2: Dynamic Category Pill Chips (Pinned on demand) */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {/* All Categories Chip */}
            <button
              onClick={() => setSelectedCategories([])}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                selectedCategories.length === 0
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-black/60 hover:bg-white/10 text-gray-400 hover:text-gray-200 border border-white/5'
              }`}
            >
              <span>📂</span>
              <span>全部大類</span>
            </button>

            {/* Dynamically Pinned Selected Category Chips */}
            {selectedCategories.map((catName) => {
              const count = categoryCounts[catName] || 0;
              const icon = getCategoryIcon(catName, 'expense');

              return (
                <div
                  key={catName}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 border shadow-sm shrink-0"
                  style={{
                    backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.25)`,
                    borderColor: currentTheme.primaryHex,
                    color: currentTheme.primaryHex,
                  }}
                >
                  <span>{icon}</span>
                  <span>{catName}</span>
                  {count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-white font-mono font-normal">
                      {count}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCategories((prev) => prev.filter((c) => c !== catName));
                    }}
                    className="p-0.5 hover:bg-white/20 rounded-full text-white/70 hover:text-white transition cursor-pointer"
                    title={`移除 ${catName} 篩選`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {/* Filter Category Modal Trigger Button */}
            <button
              onClick={() => {
                setTempSelectedCategories(selectedCategories);
                setIsCategoryModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
              title="選擇要篩選的大類"
            >
              <Plus className="w-3.5 h-3.5" style={{ color: currentTheme.primaryHex }} />
              <span>篩選大類</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>

          {/* Row 3: Keyword Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="搜尋項目、金額或備註 (如: 晚餐, 0050)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-8 py-1.5 text-xs text-gray-200 focus:border-cyan-500 focus:outline-none placeholder:text-gray-600"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 text-gray-500 hover:text-gray-300 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Date-Grouped Transaction Stream (Mobile Card First) */}
      <div className="space-y-4">
        {groupedByDate.length === 0 ? (
          <div className="bg-[#0c0c0c] border border-white/5 rounded-3xl p-12 text-center text-gray-500 text-xs">
            沒有找到符合條件的明細紀錄。您可以點擊右上角「記一筆」新增一筆帳目！
          </div>
        ) : (
          groupedByDate.map((group) => (
            <div
              key={group.date}
              className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-4 sm:p-5 shadow-xl space-y-2.5"
            >
              {/* Date Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2 text-xs">
                <div className="flex items-center gap-2 font-mono font-bold text-gray-300">
                  <span className="text-sm text-white">{group.date}</span>
                  <span className="text-[11px] text-gray-500 font-sans font-normal">{group.weekdayStr}</span>
                  <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full border border-white/5">
                    {group.items.length} 筆
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  {group.dayExpense > 0 && (
                    <span className="text-orange-400 font-semibold">
                      支 {sym} {formatNum(group.dayExpense)}
                    </span>
                  )}
                  {group.dayIncome > 0 && (
                    <span className="text-emerald-400 font-semibold">
                      收 +{sym} {formatNum(group.dayIncome)}
                    </span>
                  )}
                </div>
              </div>

              {/* Transactions in this Day */}
              <div className="space-y-1.5">
                {group.items.map((t) => {
                  const isIncome = t.type === 'income';
                  const isExpense = t.type === 'expense';
                  const isTax = t.type === 'tax';
                  const isInvest = t.type === 'investment';
                  const icon = getCategoryIcon(t.mainCategory, t.type);

                  let amtColor = 'text-orange-400';
                  let sign = '-';
                  if (isIncome) {
                    amtColor = 'text-emerald-400';
                    sign = '+';
                  } else if (isTax) {
                    amtColor = 'text-purple-300';
                    sign = '-';
                  } else if (isInvest) {
                    amtColor = 'text-cyan-300';
                    sign = '🚀';
                  }

                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between bg-[#121215] hover:bg-white/5 border border-white/5 p-3 rounded-2xl transition group"
                    >
                      {/* Left: Icon + Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-base shrink-0">
                          {icon}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold text-white tracking-tight truncate max-w-[150px] xs:max-w-[200px] sm:max-w-[340px]">
                              {t.subCategory || t.mainCategory}
                            </span>
                            {t.isQuickPreset && (
                              <span
                                className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-mono font-bold whitespace-nowrap shrink-0"
                                style={{
                                  backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                                  color: currentTheme.primaryHex,
                                  borderColor: `rgba(${currentTheme.bgGlowRgb}, 0.3)`,
                                }}
                              >
                                1秒速記
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                            <span className="font-semibold text-gray-300">{t.mainCategory}</span>
                            {t.note && (
                              <>
                                <span className="text-gray-600">•</span>
                                <span className="truncate max-w-[130px] sm:max-w-[240px] text-gray-400">{t.note}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Delete Action Button */}
                      <div className="shrink-0 flex items-center gap-2 text-right">
                        <div className={`text-sm sm:text-base font-black font-mono whitespace-nowrap ${amtColor}`}>
                          {sign} {sym} {formatNum(t.amount)}
                        </div>

                        <button
                          onClick={() => setDeleteTarget({ id: t.id, name: `${t.mainCategory} (${t.subCategory})`, amount: t.amount })}
                          className="p-1.5 text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                          title="刪除紀錄"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Styled Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="確定要刪除這筆收支紀錄？"
        message={`確定要刪除紀錄「${deleteTarget?.name} - ${sym} ${formatNum(deleteTarget?.amount || 0)}」嗎？刪除後資料將無法復原。`}
        confirmText="確定刪除"
        cancelText="取消"
        type="danger"
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteTransaction(deleteTarget.id);
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Styled Clear All Data Confirmation Modal */}
      <ConfirmModal
        isOpen={isClearAllConfirmOpen}
        title="確定清空所有本機資料？"
        message="⚠️ 警告：確定要清空所有本機資料（包含記帳明細、持股庫存與現金儲備）嗎？\n\n清空後資料將被完全重置，請確認是否已備份。"
        confirmText="確定清空"
        cancelText="取消"
        type="danger"
        onConfirm={() => {
          onClearAllData?.();
        }}
        onClose={() => setIsClearAllConfirmOpen(false)}
      />

      {/* Custom Glassmorphism Category Picker Modal (Multi-select) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#0f0f12] border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="p-2 rounded-xl"
                  style={{
                    backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                    color: currentTheme.primaryHex,
                  }}
                >
                  <Folder className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">篩選記帳大類</h3>
                  <p className="text-xs text-gray-400">可自由勾選一或多個想查看的大類</p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Select All / Clear Row */}
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="text-gray-400 font-medium">
                已選 <strong className="text-white font-bold">{tempSelectedCategories.length}</strong> 個大類
                {tempSelectedCategories.length === 0 && ' (全部顯示)'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTempSelectedCategories(categories.map((c) => c.name))}
                  className="text-xs text-cyan-400 hover:underline cursor-pointer font-semibold"
                >
                  全選
                </button>
                <span className="text-gray-600">•</span>
                <button
                  onClick={() => setTempSelectedCategories([])}
                  className="text-xs text-gray-400 hover:text-gray-200 hover:underline cursor-pointer"
                >
                  清空 (看全部)
                </button>
              </div>
            </div>

            {/* Grid of Categories with Checkboxes */}
            <div className="overflow-y-auto pr-1 space-y-2 flex-1 scrollbar-thin">
              {categories.map((c) => {
                const isChecked = tempSelectedCategories.includes(c.name);
                const count = categoryCounts[c.name] || 0;
                const icon = getCategoryIcon(c.name, 'expense');

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setTempSelectedCategories((prev) =>
                        prev.includes(c.name) ? prev.filter((item) => item !== c.name) : [...prev, c.name]
                      );
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition text-left cursor-pointer select-none ${
                      isChecked
                        ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300'
                        : 'border-white/5 bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${
                          isChecked
                            ? 'bg-cyan-500 border-cyan-400 text-black'
                            : 'border-white/20 bg-black/40'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="text-xl shrink-0">{icon}</span>
                      <div>
                        <div className="text-sm font-bold text-white">{c.name}</div>
                        <div className="text-xs text-gray-500">
                          {count > 0 ? `本期共 ${count} 筆紀錄` : '本期尚無紀錄'}
                        </div>
                      </div>
                    </div>

                    {count > 0 && (
                      <span className="text-xs font-mono bg-white/10 text-gray-300 px-2 py-0.5 rounded-full shrink-0">
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setTempSelectedCategories([]);
                  setSelectedCategories([]);
                  setIsCategoryModalOpen(false);
                }}
                className="text-xs text-gray-400 hover:text-white transition cursor-pointer px-2 py-1.5"
              >
                查看全部大類
              </button>
              <button
                onClick={() => {
                  setSelectedCategories(tempSelectedCategories);
                  setIsCategoryModalOpen(false);
                }}
                className="px-5 py-2 text-black font-bold text-xs rounded-xl transition cursor-pointer shadow-md active:scale-95"
                style={{ backgroundColor: currentTheme.primaryHex }}
              >
                確定套用 {tempSelectedCategories.length > 0 ? `(${tempSelectedCategories.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
