import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Calendar,
  DollarSign,
  Repeat,
  Check,
  Tag,
  MessageSquare,
  Sparkles,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { CategoryItem, RecurringExpense, RecurringFrequency } from '../types';
import { calculateNextDeductionDate, getFrequencyLabel, getLocalDateString } from '../utils/recurringEngine';
import { getThemePreset } from '../utils/theme';

interface RecurringExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  themeColor?: string;
  initialData?: RecurringExpense | null;
  onSave: (expense: Omit<RecurringExpense, 'id'> | RecurringExpense) => void;
}

interface QuickTemplate {
  name: string;
  amount: number;
  currency: 'TWD' | 'USD';
  frequency: RecurringFrequency;
  billingDay: number;
  mainCategory: string;
  subCategory: string;
  note?: string;
  emoji: string;
}

const COMMON_TEMPLATES: QuickTemplate[] = [
  {
    name: 'Netflix 串流家庭方案',
    amount: 390,
    currency: 'TWD',
    frequency: 'monthly',
    billingDay: 15,
    mainCategory: '娛樂生活',
    subCategory: '串流訂閱',
    emoji: '🎬',
  },
  {
    name: 'Spotify 音樂訂閱',
    amount: 149,
    currency: 'TWD',
    frequency: 'monthly',
    billingDay: 10,
    mainCategory: '娛樂生活',
    subCategory: '串流訂閱',
    emoji: '🎵',
  },
  {
    name: '中華電信 5G 月租',
    amount: 599,
    currency: 'TWD',
    frequency: 'monthly',
    billingDay: 20,
    mainCategory: '生活開銷',
    subCategory: '電信通訊',
    emoji: '📱',
  },
  {
    name: '每月固定房租',
    amount: 16000,
    currency: 'TWD',
    frequency: 'monthly',
    billingDay: 5,
    mainCategory: '居住',
    subCategory: '房租/房貸',
    emoji: '🏠',
  },
  {
    name: '全民健保保費',
    amount: 826,
    currency: 'TWD',
    frequency: 'monthly',
    billingDay: 15,
    mainCategory: '稅金規費',
    subCategory: '二代健保補充費',
    emoji: '🏥',
  },
  {
    name: '水電天然氣費用',
    amount: 2200,
    currency: 'TWD',
    frequency: 'bimonthly',
    billingDay: 25,
    mainCategory: '居住',
    subCategory: '水電費用',
    emoji: '⚡',
  },
  {
    name: '家用寬頻光纖網路',
    amount: 699,
    currency: 'TWD',
    frequency: 'monthly',
    billingDay: 1,
    mainCategory: '居住',
    subCategory: '寬頻網路',
    emoji: '🌐',
  },
  {
    name: '商業醫療險年繳',
    amount: 36000,
    currency: 'TWD',
    frequency: 'annual',
    billingDay: 10,
    mainCategory: '醫療保健',
    subCategory: '醫療商業保險',
    emoji: '🛡️',
  },
];

export const RecurringExpenseModal: React.FC<RecurringExpenseModalProps> = ({
  isOpen,
  onClose,
  categories,
  themeColor,
  initialData,
  onSave,
}) => {
  if (!isOpen) return null;

  const currentTheme = getThemePreset(themeColor);
  const isEditing = Boolean(initialData);

  // Form states
  const [name, setName] = useState(initialData?.name || '');
  const [amount, setAmount] = useState<string>(initialData?.amount ? String(initialData.amount) : '');
  const [currency, setCurrency] = useState<'TWD' | 'USD'>(initialData?.currency || 'TWD');
  const [frequency, setFrequency] = useState<RecurringFrequency>(initialData?.frequency || 'monthly');
  const [billingDay, setBillingDay] = useState<number>(initialData?.billingDay || 15);
  const [billingMonth, setBillingMonth] = useState<number>(initialData?.billingMonth || 1);
  const [mainCategory, setMainCategory] = useState<string>(initialData?.mainCategory || '');
  const [subCategory, setSubCategory] = useState<string>(initialData?.subCategory || '');
  const [isActive, setIsActive] = useState<boolean>(initialData?.isActive !== false);
  const [note, setNote] = useState<string>(initialData?.note || '');

  // Filter valid expense categories
  const expenseCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'expense' || c.type === 'tax');
  }, [categories]);

  // Synchronize category dropdowns
  useEffect(() => {
    if (!initialData) {
      if (!mainCategory && expenseCategories.length > 0) {
        setMainCategory(expenseCategories[0].name);
        setSubCategory(expenseCategories[0].subCategories[0] || '');
      }
    }
  }, [expenseCategories, initialData, mainCategory]);

  const selectedCatObj = expenseCategories.find((c) => c.name === mainCategory) || expenseCategories[0];
  const subCategories = selectedCatObj?.subCategories || [];

  // Calculate projected next deduction date dynamically
  const projectedNextDate = useMemo(() => {
    return calculateNextDeductionDate({
      frequency,
      billingDay,
      billingMonth: frequency !== 'monthly' ? billingMonth : undefined,
    });
  }, [frequency, billingDay, billingMonth]);

  const applyTemplate = (tpl: QuickTemplate) => {
    setName(tpl.name);
    setAmount(String(tpl.amount));
    setCurrency(tpl.currency);
    setFrequency(tpl.frequency);
    setBillingDay(tpl.billingDay);
    if (tpl.note) setNote(tpl.note);

    // Find category match or fallback
    const matchedMain = expenseCategories.find((c) => c.name === tpl.mainCategory) || expenseCategories[0];
    if (matchedMain) {
      setMainCategory(matchedMain.name);
      const matchedSub = matchedMain.subCategories.find((s) => s === tpl.subCategory) || matchedMain.subCategories[0] || '';
      setSubCategory(matchedSub);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!name.trim() || isNaN(numAmount) || numAmount <= 0) {
      return;
    }

    const itemData = {
      name: name.trim(),
      amount: numAmount,
      currency,
      frequency,
      billingDay,
      billingMonth: frequency !== 'monthly' ? billingMonth : undefined,
      mainCategory: mainCategory || '生活開銷',
      subCategory: subCategory || '固定扣款',
      isActive,
      nextDeductedDate: projectedNextDate,
      note: note.trim() || undefined,
    };

    if (initialData?.id) {
      onSave({
        ...itemData,
        id: initialData.id,
        lastDeductedDate: initialData.lastDeductedDate,
      });
    } else {
      onSave(itemData);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#141419] border border-zinc-800 w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl text-gray-200 animate-scaleUp my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30">
              <Repeat className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {isEditing ? '編輯固定扣款項目' : '新增週期固定扣款'}
              </h3>
              <p className="text-xs text-zinc-400">
                自動於扣款日建立支出流水帳，並由現金活存帳戶扣款
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick templates (only when adding new) */}
        {!isEditing && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>常用扣款範本 (點擊快速套用)：</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {COMMON_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="flex-shrink-0 px-2.5 py-1 rounded-xl text-xs bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <span>{tpl.emoji}</span>
                  <span className="font-medium">{tpl.name.split(' ')[0]}</span>
                  <span className="text-indigo-300 font-semibold">${tpl.amount}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              項目名稱 <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：Netflix 4K 家庭方案、台北房租、中華電信"
              className="w-full bg-zinc-900/90 border border-zinc-700/70 focus:border-indigo-500 rounded-2xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors"
            />
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                每期扣款金額 <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400 font-bold">
                  {currency === 'USD' ? '$' : 'NT$'}
                </span>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-900/90 border border-zinc-700/70 focus:border-indigo-500 rounded-2xl pl-12 pr-3.5 py-2.5 text-base font-bold text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">扣款幣別</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'TWD' | 'USD')}
                className="w-full bg-zinc-900/90 border border-zinc-700/70 focus:border-indigo-500 rounded-2xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors"
              >
                <option value="TWD">台幣 (TWD)</option>
                <option value="USD">美金 (USD)</option>
              </select>
            </div>
          </div>

          {/* Frequency & Billing day */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                扣款週期頻率
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full bg-zinc-950 border border-zinc-700/70 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none transition-colors"
              >
                <option value="monthly">每月固定扣款</option>
                <option value="bimonthly">每 2 個月 (雙月繳)</option>
                <option value="quarterly">每季扣款 (每 3 個月)</option>
                <option value="semiannual">每半年扣款 (每 6 個月)</option>
                <option value="annual">每年固定扣款 (年繳)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 flex items-center justify-between">
                <span>扣款日期</span>
                <span className="text-[10px] text-zinc-500 font-normal">月底日自動平齊</span>
              </label>
              <div className="flex items-center gap-1.5">
                {frequency !== 'monthly' && (
                  <select
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(parseInt(e.target.value, 10))}
                    className="w-24 bg-zinc-950 border border-zinc-700/70 focus:border-indigo-500 rounded-xl px-2 py-2 text-sm text-white focus:outline-none transition-colors"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m} 月
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex-1 relative">
                  <select
                    value={billingDay}
                    onChange={(e) => setBillingDay(parseInt(e.target.value, 10))}
                    className="w-full bg-zinc-950 border border-zinc-700/70 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d} 日
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Category selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">支出主分類</label>
              <select
                value={mainCategory}
                onChange={(e) => {
                  const newCat = e.target.value;
                  setMainCategory(newCat);
                  const matched = expenseCategories.find((c) => c.name === newCat);
                  setSubCategory(matched?.subCategories[0] || '');
                }}
                className="w-full bg-zinc-900/90 border border-zinc-700/70 focus:border-indigo-500 rounded-2xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors"
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">子分類</label>
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full bg-zinc-900/90 border border-zinc-700/70 focus:border-indigo-500 rounded-2xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors"
              >
                {subCategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Next date projection card */}
          <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-indigo-300 font-medium">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>下次預計扣款：</span>
              <span className="text-white font-bold">{projectedNextDate}</span>
            </div>
            <span className="text-[11px] text-zinc-400">
              {getFrequencyLabel(frequency, billingDay, billingMonth)}
            </span>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">備註說明 (選填)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：合約至 2027 年、信用卡定期自動代扣"
              className="w-full bg-zinc-900/90 border border-zinc-700/70 focus:border-indigo-500 rounded-2xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Status switch */}
          <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800">
            <div>
              <div className="text-sm font-semibold text-white">啟用自動扣款</div>
              <div className="text-xs text-zinc-400">若暫停，扣款日當天將不會自動建立支出與扣減活存</div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isActive ? 'bg-indigo-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 font-semibold text-sm text-zinc-300 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm text-white shadow-lg shadow-indigo-600/30 transition-all"
            >
              {isEditing ? '儲存變更' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
