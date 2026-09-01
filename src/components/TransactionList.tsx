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
import { CategoryItem, FIREConfig, Transaction, PortfolioStock } from '../types';
import { getThemePreset } from '../utils/theme';
import { ConfirmModal } from './ConfirmModal';
import { AnnualTaxChecklist } from './AnnualTaxChecklist';

interface TransactionListProps {
  transactions: Transaction[];
  portfolioStocks?: PortfolioStock[];
  usdRate?: number;
  categories: CategoryItem[];
  fireConfig: FIREConfig;
  onDeleteTransaction: (id: string) => void;
  onOpenQuickAdd: () => void;
  onResetDefaultData: () => void;
  onClearAllData?: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  portfolioStocks,
  usdRate = 32.0,
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
  const [mainTab, setMainTab] = useState<'ledger' | 'tax'>('ledger');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [search, setSearch] = useState('');
  // View Scope: 'living' (生活收支) | 'investment' (投資證券) | 'all' (全部動態)
  const [viewScope, setViewScope] = useState<'living' | 'investment' | 'all'>('living');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tempSelectedCategories, setTempSelectedCategories] = useState<string[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedDetailTransaction, setSelectedDetailTransaction] = useState<any | null>(null);

  // Deletion Confirm Modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; amount: number; isStock?: boolean } | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);

  // Unified list combining ledger + portfolio stock trades
  const allTransactions = useMemo(() => {
    const list: (Transaction & {
      isStockTrade?: boolean;
      stockTradeType?: 'BUY' | 'SELL' | 'DIVIDEND';
      stockMarket?: 'US' | 'TW';
      stockOriginalAmount?: number;
      stockOriginalCurrency?: string;
    })[] = [...transactions];

    (portfolioStocks || []).forEach((stock) => {
      const isUS = stock.market === 'US';
      const stockCurrency = isUS ? '$' : 'NT$';

      (stock.transactions || []).forEach((st) => {
        const totalTradeVal = st.shares * st.price;
        const amountTWD = isUS ? Math.round(totalTradeVal * (usdRate || 32.0)) : totalTradeVal;

        const isBuy = st.type === 'BUY';
        const isSell = st.type === 'SELL';
        const txType: TransactionType = isBuy ? 'investment' : (isSell ? 'investment' : 'income');
        const actionLabel = isBuy ? '買入' : isSell ? '賣出' : '股利發放';

        list.push({
          id: `stock-${st.id}`,
          date: st.date,
          type: txType,
          amount: amountTWD,
          mainCategory: '證券投資',
          subCategory: `${stock.symbol} ${actionLabel}`,
          note: `${formatNum(st.shares)} 股 @ ${stockCurrency}${st.price}${st.note ? ` • ${st.note}` : ''}`,
          tags: [isUS ? '美股' : '台股', '證券交易'],
          isStockTrade: true,
          stockTradeType: st.type,
          stockMarket: stock.market,
          stockOriginalAmount: totalTradeVal,
          stockOriginalCurrency: stockCurrency,
        });
      });
    });

    return list;
  }, [transactions, portfolioStocks, usdRate]);

  // Count items per category under current month
  const categoryCounts = useMemo(() => {
    const map: { [name: string]: number } = {};
    allTransactions.forEach((t) => {
      if (selectedMonth !== 'all' && !t.date.startsWith(selectedMonth)) return;
      map[t.mainCategory] = (map[t.mainCategory] || 0) + 1;
    });
    return map;
  }, [allTransactions, selectedMonth]);

  // Available unique months list sorted descending
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add(currentMonthStr);
    allTransactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        monthsSet.add(t.date.slice(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [allTransactions, currentMonthStr]);

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
    if (selectedMonth >= currentMonthStr) {
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
    if (newMonth <= currentMonthStr) {
      setSelectedMonth(newMonth);
    }
  };

  // Scope statistics for the active month (living vs investment vs all)
  const monthAllTxs = useMemo(() => {
    return allTransactions.filter((t) => selectedMonth === 'all' || t.date.startsWith(selectedMonth));
  }, [allTransactions, selectedMonth]);

  const scopeStats = useMemo(() => {
    let livingIncome = 0;
    let livingExpense = 0;
    let livingTax = 0;

    let investBuy = 0;
    let investSell = 0;
    let investDividend = 0;

    monthAllTxs.forEach((t: any) => {
      if (t.isStockTrade) {
        if (t.stockTradeType === 'BUY') {
          investBuy += t.amount;
        } else if (t.stockTradeType === 'SELL') {
          investSell += t.amount;
        } else {
          investDividend += t.amount;
          livingIncome += t.amount; // Stock dividends count toward passive living income!
        }
      } else {
        if (t.type === 'income') livingIncome += t.amount;
        else if (t.type === 'expense') livingExpense += t.amount;
        else if (t.type === 'tax') livingTax += t.amount;
        else if (t.type === 'investment') investBuy += t.amount;
      }
    });

    const livingNet = livingIncome - livingExpense - livingTax;
    const investNet = investBuy - investSell;
    const globalNet = livingIncome + investSell - livingExpense - livingTax - investBuy;

    return {
      livingIncome,
      livingExpense,
      livingTax,
      livingNet,
      investBuy,
      investSell,
      investDividend,
      investNet,
      globalNet,
    };
  }, [monthAllTxs]);

  // Filter transactions based on viewScope, month, category and search query
  const filtered = useMemo(() => {
    return allTransactions.filter((t: any) => {
      // 1. Month filter
      if (selectedMonth !== 'all' && !t.date.startsWith(selectedMonth)) return false;

      // 2. View Scope filter
      if (viewScope === 'living') {
        // Pure Living mode: Exclude stock BUY and SELL (keep dividends & living records)
        if (t.isStockTrade && t.stockTradeType !== 'DIVIDEND') return false;
        if (!t.isStockTrade && t.type === 'investment') return false;
      } else if (viewScope === 'investment') {
        // Investment mode: Only stock trades or investment records
        if (!t.isStockTrade && t.type !== 'investment') return false;
      }

      // 3. Category / Market filter
      if (selectedCategories.length > 0) {
        if (viewScope === 'investment') {
          const matchesMarket = selectedCategories.some(
            (c) => (t.tags || []).includes(c) || t.mainCategory === c
          );
          if (!matchesMarket) return false;
        } else {
          if (!selectedCategories.includes(t.mainCategory)) return false;
        }
      }

      // 4. Search query
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
  }, [allTransactions, selectedMonth, viewScope, selectedCategories, search]);

  // Group filtered transactions by date (descending)
  const groupedByDate = useMemo(() => {
    const groups: { [date: string]: any[] } = {};
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
      let dayInvest = 0;

      items.forEach((item) => {
        if (item.isStockTrade) {
          if (item.stockTradeType === 'BUY') dayInvest += item.amount;
          else if (item.stockTradeType === 'SELL') dayIncome += item.amount;
          else if (item.stockTradeType === 'DIVIDEND') dayIncome += item.amount;
        } else {
          if (item.type === 'income') dayIncome += item.amount;
          else if (item.type === 'expense' || item.type === 'tax') dayExpense += item.amount;
          else if (item.type === 'investment') dayInvest += item.amount;
        }
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
        dayInvest,
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
    if (cat.includes('證券') || cat.includes('股票') || cat.includes('投資') || type === 'investment') return '📈';
    if (type === 'income') return '💵';
    if (type === 'tax') return '🏛️';
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

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `fire_ledger_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format Month Display
  const displayMonthLabel = (m: string) => {
    if (m === 'all') return '全部歷史明細';
    const [y, mon] = m.split('-');
    return `${y} 年 ${parseInt(mon, 10)} 月`;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Sub-Tab Navigation Bar */}
      <div className="flex bg-[#0c0c0e] p-1.5 rounded-2xl border border-white/10 max-w-xs shadow-lg">
        <button
          type="button"
          onClick={() => setMainTab('ledger')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mainTab === 'ledger'
              ? 'bg-white/10 text-white shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          style={mainTab === 'ledger' ? { color: currentTheme.primaryHex } : {}}
        >
          <ReceiptText className="w-4 h-4" />
          <span>收支明細</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('tax')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mainTab === 'tax'
              ? 'bg-white/10 text-white shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          style={mainTab === 'tax' ? { color: currentTheme.primaryHex } : {}}
        >
          <span>🏛️ 年度稅務</span>
        </button>
      </div>

      {mainTab === 'tax' ? (
        <AnnualTaxChecklist />
      ) : (
        <>
          {/* Top Header Card */}
          <div className="bg-[#0c0c0e] border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
            {/* Title Bar & Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <ReceiptText className="w-6 h-6" style={{ color: currentTheme.primaryHex }} />
                  <span>收支明細與金流日記</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              生活收支與證券投資雙軌管理 • 支援多維度篩選與收據憑證查閱
            </p>
          </div>

          {/* Top Right Actions */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95"
              title="匯出 CSV 檔"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">匯出</span> CSV
            </button>

            <button
              onClick={onResetDefaultData}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 border border-white/10 rounded-xl text-xs font-medium transition cursor-pointer active:scale-95"
              title="重設並加載預設範例資料"
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
            disabled={selectedMonth === 'all' || selectedMonth >= currentMonthStr}
            className={`p-2 rounded-xl border border-white/5 transition flex items-center justify-center ${
              selectedMonth === 'all' || selectedMonth >= currentMonthStr
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-white/10 text-gray-300 hover:text-white cursor-pointer active:scale-95'
            }`}
            title={selectedMonth >= currentMonthStr ? '已是當前月份' : '下一個月'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Top Level Scope Segmented Switcher (生活 vs 投資 vs 全部) */}
        <div className="grid grid-cols-3 p-1 bg-black/70 border border-white/10 rounded-2xl gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setViewScope('living');
              setSelectedCategories([]);
            }}
            className={`py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              viewScope === 'living'
                ? 'bg-white text-black shadow-lg scale-100'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>☕</span>
            <span>生活收支</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewScope('investment');
              setSelectedCategories([]);
            }}
            className={`py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              viewScope === 'investment'
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-lg scale-100'
                : 'text-gray-400 hover:text-cyan-300'
            }`}
          >
            <span>📈</span>
            <span>投資證券</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewScope('all');
              setSelectedCategories([]);
            }}
            className={`py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              viewScope === 'all'
                ? 'bg-white/15 text-white border border-white/20 shadow-lg scale-100'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>🌐</span>
            <span>全部動態</span>
          </button>
        </div>

        {/* 2. Adaptive Summary Cards Ribbon */}
        {viewScope === 'living' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 animate-fadeIn">
            <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>日常總收入</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-emerald-400 mt-1 whitespace-nowrap">
                +{sym} {formatNum(scopeStats.livingIncome)}
              </div>
            </div>

            <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>日常總支出</span>
                <ArrowDownRight className="w-3.5 h-3.5 text-orange-400" />
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-orange-400 mt-1 whitespace-nowrap">
                -{sym} {formatNum(scopeStats.livingExpense)}
              </div>
            </div>

            <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>稅金與規費</span>
                <ReceiptText className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-purple-300 mt-1 whitespace-nowrap">
                {sym} {formatNum(scopeStats.livingTax)}
              </div>
            </div>

            <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>生活淨結餘</span>
                <span className={`text-[10px] font-bold ${scopeStats.livingNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {scopeStats.livingNet >= 0 ? '淨存' : '透支'}
                </span>
              </div>
              <div className={`text-sm sm:text-base font-black font-mono mt-1 whitespace-nowrap ${scopeStats.livingNet >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                {scopeStats.livingNet >= 0 ? '+' : ''}{sym} {formatNum(scopeStats.livingNet)}
              </div>
            </div>
          </div>
        )}

        {viewScope === 'investment' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 animate-fadeIn">
            <div className="bg-[#141416] border border-cyan-500/10 p-3 rounded-2xl">
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>買入投入</span>
                <ArrowDownRight className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-cyan-300 mt-1 whitespace-nowrap">
                -{sym} {formatNum(scopeStats.investBuy)}
              </div>
            </div>

            <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>賣出變現</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-emerald-400 mt-1 whitespace-nowrap">
                +{sym} {formatNum(scopeStats.investSell)}
              </div>
            </div>

            <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>獲配股息</span>
                <ReceiptText className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-amber-300 mt-1 whitespace-nowrap">
                +{sym} {formatNum(scopeStats.investDividend)}
              </div>
            </div>

            <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>當月淨投入</span>
                <span className="text-[10px] font-bold text-gray-400">資本</span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white mt-1 whitespace-nowrap">
                {sym} {formatNum(scopeStats.investNet)}
              </div>
            </div>
          </div>
        )}

        {viewScope === 'all' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 animate-fadeIn">
            <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>生活總收入</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-emerald-400 mt-1 whitespace-nowrap">
                +{sym} {formatNum(scopeStats.livingIncome)}
              </div>
            </div>

            <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>生活總支出</span>
                <ArrowDownRight className="w-3.5 h-3.5 text-orange-400" />
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-orange-400 mt-1 whitespace-nowrap">
                -{sym} {formatNum(scopeStats.livingExpense)}
              </div>
            </div>

            <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>證券總投入</span>
                <span className="text-[10px] text-cyan-400 font-bold">投資</span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-cyan-300 mt-1 whitespace-nowrap">
                {sym} {formatNum(scopeStats.investNet)}
              </div>
            </div>

            <div className="bg-[#141416] border border-white/5 p-3 rounded-2xl">
              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>全域淨流動</span>
                <span className={`text-[10px] font-bold ${scopeStats.globalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {scopeStats.globalNet >= 0 ? '淨存' : '淨出'}
                </span>
              </div>
              <div className={`text-sm sm:text-base font-black font-mono mt-1 whitespace-nowrap ${scopeStats.globalNet >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                {scopeStats.globalNet >= 0 ? '+' : ''}{sym} {formatNum(scopeStats.globalNet)}
              </div>
            </div>
          </div>
        )}

        {/* 3. Sub-Category / Market Filter Chips & Search Bar */}
        <div className="space-y-2.5 pt-1 border-t border-white/5">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {/* All Filter Chip */}
            <button
              onClick={() => setSelectedCategories([])}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                selectedCategories.length === 0
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-black/60 hover:bg-white/10 text-gray-400 hover:text-gray-200 border border-white/5'
              }`}
            >
              <span>📂</span>
              <span>{viewScope === 'investment' ? '全部市場' : '全部大類'}</span>
            </button>

            {/* Investment specific market pills */}
            {viewScope === 'investment' && (
              <>
                <button
                  onClick={() => setSelectedCategories(['美股'])}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    selectedCategories.includes('美股')
                      ? 'bg-blue-500/25 text-blue-300 border border-blue-500/40 shadow-sm'
                      : 'bg-black/60 hover:bg-white/10 text-gray-400 hover:text-gray-200 border border-white/5'
                  }`}
                >
                  <span>🇺🇸</span>
                  <span>美股</span>
                </button>
                <button
                  onClick={() => setSelectedCategories(['台股'])}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    selectedCategories.includes('台股')
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'bg-black/60 hover:bg-white/10 text-gray-400 hover:text-gray-200 border border-white/5'
                  }`}
                >
                  <span>🇹🇼</span>
                  <span>台股</span>
                </button>
              </>
            )}

            {/* Living specific pinned category chips */}
            {viewScope !== 'investment' &&
              selectedCategories.map((catName) => {
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

            {/* Filter Category Modal Trigger Button (Living mode) */}
            {viewScope !== 'investment' && (
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
            )}
          </div>

          {/* Keyword Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="搜尋項目、金額或備註 (如: 晚餐, QQQ, 0050)..."
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
                  const isStock = Boolean(t.isStockTrade);
                  const isIncome = t.type === 'income' || (isStock && (t.stockTradeType === 'SELL' || t.stockTradeType === 'DIVIDEND'));
                  const isTax = t.type === 'tax';
                  const isInvest = t.type === 'investment' || isStock;
                  const icon = getCategoryIcon(t.mainCategory, t.type);

                  let amtColor = 'text-orange-400';
                  let sign = '-';
                  if (isStock) {
                    if (t.stockTradeType === 'BUY') {
                      amtColor = 'text-cyan-300';
                      sign = '-';
                    } else if (t.stockTradeType === 'SELL') {
                      amtColor = 'text-emerald-400';
                      sign = '+';
                    } else {
                      amtColor = 'text-amber-300';
                      sign = '+';
                    }
                  } else if (isIncome) {
                    amtColor = 'text-emerald-400';
                    sign = '+';
                  } else if (isTax) {
                    amtColor = 'text-purple-300';
                    sign = '-';
                  } else if (isInvest) {
                    amtColor = 'text-cyan-300';
                    sign = '-';
                  }

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedDetailTransaction(t)}
                      className="flex items-center justify-between bg-[#121215] hover:bg-white/5 border border-white/5 hover:border-white/10 p-3 rounded-2xl transition group cursor-pointer active:scale-[0.99]"
                      title="點擊查看完整收據與備註"
                    >
                      {/* Left: Icon + Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
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
                          onClick={(e) => {
                            e.stopPropagation();
                            if (t.isStockTrade || t.id.startsWith('stock-')) {
                              setDeleteTarget({
                                id: t.id,
                                name: `${t.mainCategory} (${t.subCategory})`,
                                amount: t.amount,
                                isStock: true,
                              });
                              return;
                            }
                            setDeleteTarget({ id: t.id, name: `${t.mainCategory} (${t.subCategory})`, amount: t.amount });
                          }}
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
        title={deleteTarget?.isStock ? '證券股票交易管理說明' : '確定要刪除這筆收支紀錄？'}
        message={
          deleteTarget?.isStock
            ? `「${deleteTarget?.name}」為股票庫存之買賣紀錄。為確保您的持股均價與未實現損益統計準確無誤，如需修改或刪除此筆交易，請前往「投資」頁面進行操作！`
            : `確定要刪除紀錄「${deleteTarget?.name} - ${sym} ${formatNum(deleteTarget?.amount || 0)}」嗎？刪除後資料將無法復原。`
        }
        confirmText={deleteTarget?.isStock ? '前往「投資」頁面' : '確定刪除'}
        cancelText={deleteTarget?.isStock ? '關閉' : '取消'}
        type={deleteTarget?.isStock ? 'info' : 'danger'}
        onConfirm={() => {
          if (deleteTarget && !deleteTarget.isStock) {
            onDeleteTransaction(deleteTarget.id);
          }
          setDeleteTarget(null);
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

      {/* Transaction Detail Modal / Electronic Receipt (Option A) */}
      {selectedDetailTransaction && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#0e0e12] border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-slideUp sm:animate-none">
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto sm:hidden mb-1" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className="p-2 rounded-xl"
                  style={{
                    backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                    color: currentTheme.primaryHex,
                  }}
                >
                  <ReceiptText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">收支明細收據</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-gray-400 font-mono">
                      {selectedDetailTransaction.id.startsWith('t-widget-')
                        ? `憑證 #W-${selectedDetailTransaction.id.slice(-6).toUpperCase()}`
                        : selectedDetailTransaction.id.startsWith('stock-')
                        ? `證券 #${selectedDetailTransaction.id.replace('stock-', '').slice(-6).toUpperCase()}`
                        : `憑證 #TX-${selectedDetailTransaction.id.replace(/^t-/, '').slice(-6).toUpperCase()}`}
                    </span>
                    {selectedDetailTransaction.id.startsWith('t-widget-') && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold font-mono">
                        ⚡ WIDGET
                      </span>
                    )}
                    {selectedDetailTransaction.id.startsWith('stock-') && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold font-mono">
                        📈 STOCK
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailTransaction(null)}
                className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hero: Amount & Icon */}
            <div className="bg-[#141418] border border-white/5 rounded-2xl p-4 text-center space-y-2 shadow-inner">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl shadow-inner">
                {getCategoryIcon(selectedDetailTransaction.mainCategory, selectedDetailTransaction.type)}
              </div>
              <div className="text-sm font-bold text-gray-300">
                {selectedDetailTransaction.subCategory || selectedDetailTransaction.mainCategory}
              </div>
              <div
                className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                  selectedDetailTransaction.type === 'income'
                    ? 'text-emerald-400'
                    : selectedDetailTransaction.type === 'tax'
                    ? 'text-purple-400'
                    : selectedDetailTransaction.type === 'investment'
                    ? 'text-cyan-300'
                    : 'text-orange-400'
                }`}
              >
                {selectedDetailTransaction.type === 'income' ? '+' : '-'} {sym}{' '}
                {formatNum(selectedDetailTransaction.amount)}
              </div>
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <span
                  className="text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase"
                  style={{
                    backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                    color: currentTheme.primaryHex,
                    borderColor: `rgba(${currentTheme.bgGlowRgb}, 0.3)`,
                  }}
                >
                  {selectedDetailTransaction.isStockTrade
                    ? '📈 證券股票交易'
                    : selectedDetailTransaction.type === 'income'
                    ? '💰 收入紀錄'
                    : selectedDetailTransaction.type === 'tax'
                    ? '🏛️ 稅金與規費'
                    : selectedDetailTransaction.type === 'investment'
                    ? '📈 投資扣款'
                    : '💸 日常支出'}
                </span>
                {selectedDetailTransaction.isQuickPreset && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                    ⚡ 1秒速記
                  </span>
                )}
              </div>
            </div>

            {/* Breakdown Details Table */}
            <div className="bg-[#141418] border border-white/5 rounded-2xl p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">記帳大類</span>
                <span className="font-bold text-white">{selectedDetailTransaction.mainCategory}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">明細子類</span>
                <span className="font-bold text-gray-200">
                  {selectedDetailTransaction.subCategory || '未指定子類'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">交易日期</span>
                <span className="font-mono font-bold text-white">{selectedDetailTransaction.date}</span>
              </div>
              {selectedDetailTransaction.stockOriginalAmount && (
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-gray-400">原始幣別金額</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {selectedDetailTransaction.stockOriginalCurrency}{formatNum(selectedDetailTransaction.stockOriginalAmount)}
                  </span>
                </div>
              )}
              {selectedDetailTransaction.tags && selectedDetailTransaction.tags.length > 0 && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-400">專屬標籤</span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {selectedDetailTransaction.tags.map((tag: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-white/5 text-gray-300 border border-white/10 rounded-md text-[10px]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Full Note Card (Zero Truncation, Multi-line Supported) */}
            <div className="bg-[#141418] border border-white/5 rounded-2xl p-3.5 space-y-1.5">
              <div className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                <span>📝 完整備註說明</span>
              </div>
              {selectedDetailTransaction.note ? (
                <p className="text-xs sm:text-sm text-gray-100 leading-relaxed break-words whitespace-pre-wrap select-text bg-black/40 p-2.5 rounded-xl border border-white/5">
                  {selectedDetailTransaction.note}
                </p>
              ) : (
                <p className="text-xs text-gray-500 italic">此筆紀錄未填寫備註說明</p>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const target = selectedDetailTransaction;
                  setSelectedDetailTransaction(null);
                  setDeleteTarget({
                    id: target.id,
                    name: `${target.mainCategory} (${target.subCategory})`,
                    amount: target.amount,
                    isStock: target.isStockTrade || target.id.startsWith('stock-'),
                  });
                }}
                className="flex items-center gap-1 px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition text-xs font-bold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{selectedDetailTransaction.isStockTrade ? '管理股票紀錄' : '刪除紀錄'}</span>
              </button>

              <button
                onClick={() => setSelectedDetailTransaction(null)}
                className="px-5 py-2 text-black font-bold text-xs rounded-xl transition cursor-pointer shadow-md active:scale-95"
                style={{ backgroundColor: currentTheme.primaryHex }}
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
