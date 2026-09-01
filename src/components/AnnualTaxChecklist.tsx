import React, { useState, useMemo } from 'react';
import {
  Landmark,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Calculator,
  X,
  Check,
  Car,
  Home,
  Briefcase,
  Layers,
} from 'lucide-react';
import { TaxItem } from '../types';
import { useFIRE } from '../context/FIREContext';
import { getThemePreset } from '../utils/theme';

export const AnnualTaxChecklist: React.FC = () => {
  const {
    fireConfig,
    annualTaxes,
    annualTaxTotal,
    toggleTaxPaid,
    addCustomTaxItem,
    deleteTaxItem,
    updateAnnualTaxes,
  } = useFIRE();

  const currentTheme = getThemePreset(fireConfig.themeColor);
  const sym = fireConfig.currencySymbol || 'NT$';
  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(Math.round(num));

  // Modals state
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTaxItem, setEditingTaxItem] = useState<TaxItem | null>(null);

  // Income Tax Estimator state
  const [annualSalary, setAnnualSalary] = useState<number>(fireConfig.monthlyIncome ? fireConfig.monthlyIncome * 14 : 900000);
  const [isMarried, setIsMarried] = useState<boolean>(false);
  const [hasSpecialDeduction, setHasSpecialDeduction] = useState<boolean>(true);

  // Add / Edit form state
  const [taxName, setTaxName] = useState('');
  const [taxMonth, setTaxMonth] = useState<number>(5);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [taxCategory, setTaxCategory] = useState<'vehicle' | 'income' | 'housing' | 'custom'>('custom');
  const [taxNote, setTaxNote] = useState('');

  // Sorted taxes by Month (1 to 12)
  const sortedTaxes = useMemo(() => {
    return [...annualTaxes].sort((a, b) => a.month - b.month);
  }, [annualTaxes]);

  // Paid vs Unpaid totals
  const { paidTotal, unpaidTotal, paidCount } = useMemo(() => {
    let pTot = 0;
    let uTot = 0;
    let pCnt = 0;
    annualTaxes.forEach((t) => {
      if (t.isPaid) {
        pTot += Number(t.amount) || 0;
        pCnt += 1;
      } else {
        uTot += Number(t.amount) || 0;
      }
    });
    return { paidTotal: pTot, unpaidTotal: uTot, paidCount: pCnt };
  }, [annualTaxes]);

  // Income Tax Calculation Algorithm (Taiwan MOF 113/114年度累進稅率)
  const estimatedIncomeTax = useMemo(() => {
    const grossIncome = Math.max(0, annualSalary);
    // 1. Basic Exemption
    const exemption = isMarried ? 97000 * 2 : 97000;
    // 2. Standard Deduction
    const stdDeduction = isMarried ? 262000 : 131000;
    // 3. Salary Special Deduction (Max 218,000 per person)
    const salaryDeduction = hasSpecialDeduction ? 218000 : 0;

    const netTaxableIncome = Math.max(0, grossIncome - exemption - stdDeduction - salaryDeduction);

    let tax = 0;
    if (netTaxableIncome <= 590000) {
      tax = netTaxableIncome * 0.05;
    } else if (netTaxableIncome <= 1330000) {
      tax = netTaxableIncome * 0.12 - 41300;
    } else if (netTaxableIncome <= 2660000) {
      tax = netTaxableIncome * 0.20 - 147700;
    } else if (netTaxableIncome <= 4980000) {
      tax = netTaxableIncome * 0.30 - 413700;
    } else {
      tax = netTaxableIncome * 0.40 - 911700;
    }

    return {
      grossIncome,
      netTaxableIncome,
      estimatedTax: Math.max(0, Math.round(tax)),
    };
  }, [annualSalary, isMarried, hasSpecialDeduction]);

  const handleApplyEstimatedTax = () => {
    const incomeTaxItem = annualTaxes.find((t) => t.category === 'income' || t.name.includes('所得稅'));
    if (incomeTaxItem) {
      const updated = annualTaxes.map((t) =>
        t.id === incomeTaxItem.id ? { ...t, amount: estimatedIncomeTax.estimatedTax } : t
      );
      updateAnnualTaxes(updated);
    } else {
      addCustomTaxItem({
        name: '綜合所得稅',
        month: 5,
        amount: estimatedIncomeTax.estimatedTax,
        category: 'income',
        note: `年薪 $${formatNum(annualSalary)} 試算結果`,
      });
    }
    setIsCalculatorOpen(false);
  };

  const handleSaveTaxItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxName.trim() || taxAmount <= 0) return;

    if (editingTaxItem) {
      const updated = annualTaxes.map((t) =>
        t.id === editingTaxItem.id
          ? {
              ...t,
              name: taxName.trim(),
              month: Number(taxMonth),
              amount: Number(taxAmount),
              category: taxCategory,
              note: taxNote.trim() || undefined,
            }
          : t
      );
      updateAnnualTaxes(updated);
      setEditingTaxItem(null);
    } else {
      addCustomTaxItem({
        name: taxName.trim(),
        month: Number(taxMonth),
        amount: Number(taxAmount),
        category: taxCategory,
        note: taxNote.trim() || undefined,
      });
      setIsAddModalOpen(false);
    }

    setTaxName('');
    setTaxAmount(0);
    setTaxNote('');
  };

  const openEditModal = (item: TaxItem) => {
    setEditingTaxItem(item);
    setTaxName(item.name);
    setTaxMonth(item.month);
    setTaxAmount(item.amount);
    setTaxCategory(item.category || 'custom');
    setTaxNote(item.note || '');
  };

  const getMonthBadgeColor = (month: number) => {
    switch (month) {
      case 4:
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 5:
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 7:
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 11:
        return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
      default:
        return 'bg-white/10 text-gray-300 border-white/15';
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'vehicle':
        return <Car className="w-4 h-4 text-amber-400" />;
      case 'housing':
        return <Home className="w-4 h-4 text-emerald-400" />;
      case 'income':
        return <Briefcase className="w-4 h-4 text-purple-400" />;
      default:
        return <Layers className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="bg-[#0c0c0c] border border-white/10 rounded-3xl p-5 sm:p-7 space-y-6 shadow-xl relative overflow-hidden">
      {/* Background Glow */}
      <div
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-10"
        style={{ backgroundColor: currentTheme.primaryHex }}
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-white/5 border border-white/10 text-white">
              <Landmark className="w-5 h-5" style={{ color: currentTheme.primaryHex }} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>年度稅務與規費待辦清單</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                  {annualTaxes.length} 項
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                掌握 4月牌照、5月綜所/房屋、7月燃料、11月地價稅，繳納一鍵標記並自動同步至明細
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsCalculatorOpen(true)}
            className="py-2 px-3.5 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>所得稅試算機</span>
          </button>
          <button
            onClick={() => {
              setEditingTaxItem(null);
              setTaxName('');
              setTaxMonth(5);
              setTaxAmount(0);
              setTaxCategory('custom');
              setTaxNote('');
              setIsAddModalOpen(true);
            }}
            className="py-2 px-3.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            style={{ backgroundColor: currentTheme.primaryHex }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新增稅目</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar (No Progress Bar) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/[0.03] border border-white/5 rounded-2xl p-4">
        <div>
          <div className="text-[11px] font-medium text-gray-400">年度預估總稅費</div>
          <div className="text-base sm:text-lg font-black font-mono text-white mt-0.5">
            {sym}{formatNum(annualTaxTotal)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-medium text-gray-400">每月平攤扣除</div>
          <div className="text-base sm:text-lg font-black font-mono text-gray-300 mt-0.5">
            {sym}{formatNum(Math.round(annualTaxTotal / 12))}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-medium text-emerald-400">已繳納完成</div>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-0.5">
            {sym}{formatNum(paidTotal)} <span className="text-xs font-normal">({paidCount}筆)</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] font-medium text-amber-400">待繳納餘額</div>
          <div className="text-base sm:text-lg font-black font-mono text-amber-400 mt-0.5">
            {sym}{formatNum(unpaidTotal)}
          </div>
        </div>
      </div>

      {/* Checklist List Items */}
      <div className="space-y-2.5">
        {sortedTaxes.map((tax) => (
          <div
            key={tax.id}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 group ${
              tax.isPaid
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20'
            }`}
          >
            {/* Left: Month Badge + Category Icon + Tax Name & Note */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Month Tag */}
              <div
                className={`w-12 h-10 rounded-xl border flex flex-col items-center justify-center shrink-0 font-mono text-xs font-bold ${getMonthBadgeColor(
                  tax.month
                )}`}
              >
                <span>{tax.month}月</span>
              </div>

              {/* Title & Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {getCategoryIcon(tax.category)}
                    <span
                      className={`text-sm font-bold tracking-tight ${
                        tax.isPaid ? 'text-gray-300 line-through decoration-emerald-500/50' : 'text-white'
                      }`}
                    >
                      {tax.name}
                    </span>
                  </div>
                </div>
                {tax.note && (
                  <p className="text-xs text-gray-500 truncate max-w-[200px] xs:max-w-[280px] sm:max-w-[400px]">
                    {tax.note}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Amount + Interactive Paid/Unpaid Status Button + Actions */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
              <div className="text-right">
                <div className="font-mono font-black text-white text-sm sm:text-base">
                  {sym}{formatNum(tax.amount)}
                </div>
                <div className="text-[10px] font-mono text-gray-400">
                  {tax.isPaid && tax.paidDate ? `已繳 • ${tax.paidDate.slice(5)}` : '應繳金額'}
                </div>
              </div>

              {/* Interactive Status Capsule Button */}
              <button
                onClick={() => toggleTaxPaid(tax.id)}
                className={`py-1.5 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
                  tax.isPaid
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                }`}
              >
                {tax.isPaid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>已繳納</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>待繳納</span>
                  </>
                )}
              </button>

              {/* Edit & Delete Quick Icons */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEditModal(tax)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
                  title="修改金額或備註"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteTaxItem(tax.id)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition cursor-pointer"
                  title="刪除稅目"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ================= MODAL 1: 綜合所得稅試算機 ================= */}
      {isCalculatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#121214] border border-white/15 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">台灣綜合所得稅快速試算</h4>
                  <p className="text-xs text-gray-400">依財政部標準累進稅率 (5% ~ 40%)</p>
                </div>
              </div>
              <button
                onClick={() => setIsCalculatorOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Gross Salary Input */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  預估全年薪資總收入 (含獎金)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-gray-500">
                    {sym}
                  </span>
                  <input
                    type="number"
                    value={annualSalary}
                    onChange={(e) => setAnnualSalary(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/15 rounded-xl pl-12 pr-4 py-2.5 font-mono font-bold text-white text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Status Toggles */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsMarried(!isMarried)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    isMarried
                      ? 'bg-purple-500/20 border-purple-500/50 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  <div className="text-xs font-bold">{isMarried ? '已婚合併申報' : '單身申報'}</div>
                  <div className="text-[10px] opacity-75 mt-0.5">
                    {isMarried ? '免稅扣除額加倍' : '標準免稅扣除'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setHasSpecialDeduction(!hasSpecialDeduction)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    hasSpecialDeduction
                      ? 'bg-purple-500/20 border-purple-500/50 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  <div className="text-xs font-bold">薪資特別扣除額</div>
                  <div className="text-[10px] opacity-75 mt-0.5">扣除額 $21.8 萬</div>
                </button>
              </div>

              {/* Result Preview Box */}
              <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-xs text-gray-300">
                  <span>課稅所得淨額：</span>
                  <span className="font-mono font-bold text-white">
                    {sym}{formatNum(estimatedIncomeTax.netTaxableIncome)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-purple-500/20">
                  <span className="text-sm font-bold text-purple-300">預估 5 月應納稅額：</span>
                  <span className="text-xl font-black font-mono text-purple-200">
                    {sym}{formatNum(estimatedIncomeTax.estimatedTax)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCalculatorOpen(false)}
                className="flex-1 py-3 rounded-xl font-medium text-xs text-gray-400 hover:text-white bg-white/5 transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleApplyEstimatedTax}
                className="flex-1 py-3 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/30 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>套用至 5月所得稅</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: 新增 / 編輯稅目 ================= */}
      {(isAddModalOpen || editingTaxItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#121214] border border-white/15 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h4 className="text-base font-black text-white">
                {editingTaxItem ? '編輯年度稅目' : '新增年度稅務項目'}
              </h4>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingTaxItem(null);
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTaxItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">稅目名稱</label>
                <input
                  type="text"
                  required
                  placeholder="例如: 自小客車牌照稅, 房屋稅"
                  value={taxName}
                  onChange={(e) => setTaxName(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">繳費月份</label>
                  <select
                    value={taxMonth}
                    onChange={(e) => setTaxMonth(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m} className="bg-zinc-900 text-white">
                        {m} 月
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">預估金額</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="7120"
                    value={taxAmount || ''}
                    onChange={(e) => setTaxAmount(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 font-mono text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">備註說明 (選填)</label>
                <input
                  type="text"
                  placeholder="例如: 1,800cc / 台北市自住戶"
                  value={taxNote}
                  onChange={(e) => setTaxNote(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingTaxItem(null);
                  }}
                  className="flex-1 py-3 rounded-xl font-medium text-xs text-gray-400 hover:text-white bg-white/5 transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-bold text-xs text-white shadow-lg transition active:scale-95 cursor-pointer"
                  style={{ backgroundColor: currentTheme.primaryHex }}
                >
                  儲存稅目
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
