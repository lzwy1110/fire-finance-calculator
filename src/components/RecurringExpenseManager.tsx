import React, { useState, useMemo } from 'react';
import {
  Repeat,
  Plus,
  Search,
  Calendar,
  Clock,
  DollarSign,
  TrendingDown,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Check,
  Zap,
} from 'lucide-react';
import { useFIRE } from '../context/FIREContext';
import { RecurringExpense } from '../types';
import {
  getDeductionStatus,
  getFrequencyLabel,
  calculateMonthlyEquivalent,
  getLocalDateString,
} from '../utils/recurringEngine';
import { RecurringExpenseModal } from './RecurringExpenseModal';
import { ConfirmModal } from './ConfirmModal';
import { getThemePreset } from '../utils/theme';

export const RecurringExpenseManager: React.FC = () => {
  const {
    recurringExpenses,
    categories,
    fireConfig,
    usdRate,
    addRecurringExpense,
    editRecurringExpense,
    deleteRecurringExpense,
    toggleRecurringExpenseActive,
  } = useFIRE();

  const currentTheme = getThemePreset(fireConfig.themeColor);
  const todayStr = getLocalDateString();
  const formatNum = (v: number) => new Intl.NumberFormat('zh-TW').format(Math.round(v));
  const formatDec = (v: number) =>
    v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<RecurringExpense | null>(null);

  // 1. KPI Calculations
  const kpis = useMemo(() => {
    let totalMonthlyBurnTWD = 0;
    let pendingThisMonthTWD = 0;
    let deductedThisMonthTWD = 0;
    let activeCount = 0;

    const currentYearMonth = todayStr.slice(0, 7);

    recurringExpenses.forEach((exp) => {
      const monthlyEquiv = calculateMonthlyEquivalent(exp, usdRate || 32.0);

      if (exp.isActive) {
        totalMonthlyBurnTWD += monthlyEquiv;
        activeCount += 1;

        const isDeductedThisMonth = exp.lastDeductedDate && exp.lastDeductedDate.slice(0, 7) === currentYearMonth;
        const isScheduledThisMonth = exp.nextDeductedDate && exp.nextDeductedDate.slice(0, 7) === currentYearMonth;

        const costInTWD = exp.currency === 'USD' ? exp.amount * (usdRate || 32.0) : exp.amount;

        if (isDeductedThisMonth) {
          deductedThisMonthTWD += costInTWD;
        } else if (isScheduledThisMonth) {
          pendingThisMonthTWD += costInTWD;
        }
      }
    });

    return {
      totalMonthlyBurnTWD: Math.round(totalMonthlyBurnTWD),
      pendingThisMonthTWD: Math.round(pendingThisMonthTWD),
      deductedThisMonthTWD: Math.round(deductedThisMonthTWD),
      activeCount,
    };
  }, [recurringExpenses, usdRate, todayStr]);

  // 2. Filter & Sort expenses
  const filteredExpenses = useMemo(() => {
    return recurringExpenses
      .filter((exp) => {
        // Status filter
        if (statusFilter === 'active' && !exp.isActive) return false;
        if (statusFilter === 'paused' && exp.isActive) return false;

        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = exp.name.toLowerCase().includes(q);
          const matchCat = (exp.mainCategory || '').toLowerCase().includes(q) || (exp.subCategory || '').toLowerCase().includes(q);
          const matchNote = (exp.note || '').toLowerCase().includes(q);
          if (!matchName && !matchCat && !matchNote) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Active items first, then by nextDeductedDate
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return a.nextDeductedDate.localeCompare(b.nextDeductedDate);
      });
  }, [recurringExpenses, statusFilter, search]);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exp: RecurringExpense) => {
    setEditingExpense(exp);
    setIsModalOpen(true);
  };

  const handleSave = (itemData: Omit<RecurringExpense, 'id'> | RecurringExpense) => {
    if ('id' in itemData && itemData.id) {
      editRecurringExpense(itemData as RecurringExpense);
    } else {
      addRecurringExpense(itemData);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingExpense) {
      deleteRecurringExpense(deletingExpense.id);
      setDeletingExpense(null);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Header & Overview Card */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Repeat className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>週期固定扣款與訂閱管家</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                  {kpis.activeCount} 項啟用
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                每月水電、房租、電話費與影音串流定期自動記帳，金流永不漏接
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-black font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer shadow-md active:scale-95 whitespace-nowrap self-start sm:self-auto"
            style={{
              backgroundColor: currentTheme.primaryHex,
              boxShadow: `0 0 12px rgba(${currentTheme.bgGlowRgb}, 0.3)`,
            }}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>新增固定扣款</span>
          </button>
        </div>

        {/* 3 Core KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Monthly Burn Rate */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3.5 space-y-1">
            <div className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>每月固定支出底線 (Burn Rate)</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-white">
              NT$ {formatNum(kpis.totalMonthlyBurnTWD)}
              <span className="text-xs font-normal text-zinc-400 ml-1">/月</span>
            </div>
            <div className="text-[10px] text-zinc-500">
              折合所有月繳、雙月、季繳與年繳等額月付
            </div>
          </div>

          {/* Deducted this month */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3.5 space-y-1">
            <div className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>本月已自動扣繳</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-400">
              NT$ {formatNum(kpis.deductedThisMonthTWD)}
            </div>
            <div className="text-[10px] text-zinc-500">
              本月份已自動扣除並於流水帳建立之支出
            </div>
          </div>

          {/* Pending this month */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3.5 space-y-1">
            <div className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>本月尚待扣款</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-400">
              NT$ {formatNum(kpis.pendingThisMonthTWD)}
            </div>
            <div className="text-[10px] text-zinc-500">
              本月預計即將到達扣款日之現金預留額
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {/* Status Tabs */}
          <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 self-stretch sm:self-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'all'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              全部 ({recurringExpenses.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'active'
                  ? 'bg-zinc-800 text-indigo-300 shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              啟用中 ({kpis.activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('paused')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'paused'
                  ? 'bg-zinc-800 text-zinc-300 shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              已暫停 ({recurringExpenses.length - kpis.activeCount})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋項目名稱或分類..."
              className="w-full bg-zinc-900/90 border border-zinc-700/70 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-3">
        {filteredExpenses.length === 0 ? (
          <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
              <Repeat className="w-6 h-6" />
            </div>
            <div className="text-zinc-400 text-sm font-medium">尚無符合條件的固定扣款項目</div>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-indigo-300 border border-indigo-500/30 transition-all inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>點此新增第一筆固定扣款</span>
            </button>
          </div>
        ) : (
          filteredExpenses.map((exp) => {
            const statusInfo = getDeductionStatus(exp, todayStr);
            const isUSD = exp.currency === 'USD';
            const freqLabel = getFrequencyLabel(exp.frequency, exp.billingDay, exp.billingMonth);
            const monthlyEquiv = calculateMonthlyEquivalent(exp, usdRate || 32.0);

            return (
              <div
                key={exp.id}
                className={`bg-[#0c0c0e] border rounded-2xl p-4 sm:p-5 transition-all space-y-3 hover:border-zinc-700/80 shadow-md ${
                  !exp.isActive
                    ? 'border-zinc-800/60 opacity-65'
                    : statusInfo.status === 'due_today'
                    ? 'border-rose-500/40 shadow-rose-500/5'
                    : 'border-white/10'
                }`}
              >
                {/* Upper line: Name, category, status badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base sm:text-lg font-black text-white truncate">
                        {exp.name}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
                        {exp.mainCategory}{exp.subCategory ? ` • ${exp.subCategory}` : ''}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-lg border ${statusInfo.badgeClass}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {exp.note && (
                      <div className="text-xs text-zinc-400 truncate">{exp.note}</div>
                    )}
                  </div>

                  {/* Right side Amount */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-base sm:text-xl font-black text-white">
                      {isUSD ? `$${formatDec(exp.amount)}` : `NT$ ${formatNum(exp.amount)}`}
                      <span className="text-xs font-normal text-zinc-400 ml-1">
                        /{exp.frequency === 'monthly' ? '月' : exp.frequency === 'annual' ? '年' : '期'}
                      </span>
                    </div>
                    {(exp.frequency !== 'monthly' || isUSD) && (
                      <div className="text-[11px] text-zinc-500">
                        折合約 NT$ {formatNum(monthlyEquiv)}/月
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom line: Frequency, next date, action buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-white/5 text-xs text-zinc-400">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{freqLabel}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                      <span>
                        預計扣款：
                        <span className="text-zinc-200 font-semibold ml-0.5">
                          {exp.nextDeductedDate}
                        </span>
                      </span>
                    </div>

                    {exp.lastDeductedDate && (
                      <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                        <span>(上次：{exp.lastDeductedDate})</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Active/Pause toggle button */}
                    <button
                      type="button"
                      onClick={() => toggleRecurringExpenseActive(exp.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium border flex items-center gap-1 transition-all ${
                        exp.isActive
                          ? 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:text-amber-300'
                          : 'bg-emerald-950/30 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/30'
                      }`}
                    >
                      {exp.isActive ? (
                        <>
                          <PauseCircle className="w-3.5 h-3.5" />
                          <span>暫停</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>恢復</span>
                        </>
                      )}
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(exp)}
                      className="p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors"
                      title="編輯項目"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => setDeletingExpense(exp)}
                      className="p-1.5 rounded-xl bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition-colors"
                      title="刪除項目"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <RecurringExpenseModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingExpense(null);
          }}
          categories={categories}
          themeColor={fireConfig.themeColor}
          initialData={editingExpense}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingExpense && (
        <ConfirmModal
          isOpen={Boolean(deletingExpense)}
          title="確定刪除此固定扣款項目？"
          message={`您確定要刪除「${deletingExpense.name}」嗎？刪除後系統將不再於扣款日自動為您記帳與扣減活存（過往已產生的流水帳紀錄將維持保留）。`}
          confirmText="確認刪除"
          cancelText="取消"
          confirmButtonClass="bg-rose-600 hover:bg-rose-700 text-white"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingExpense(null)}
        />
      )}
    </div>
  );
};
