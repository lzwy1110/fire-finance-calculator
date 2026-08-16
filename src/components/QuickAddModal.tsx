import React, { useState, useEffect } from 'react';
import { Plus, X, Tag, Calendar, MessageSquare, DollarSign, Sparkles, Check, Flame } from 'lucide-react';
import { CategoryItem, Transaction, TransactionType } from '../types';
import { getThemePreset } from '../utils/theme';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  themeColor?: string;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onOpenCategoryManager: () => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  categories,
  themeColor,
  onAddTransaction,
  onOpenCategoryManager,
}) => {
  if (!isOpen) return null;

  const currentTheme = getThemePreset(themeColor);
  const [type, setType] = useState<TransactionType>('expense');
  const [mainCategory, setMainCategory] = useState<string>('');
  const [subCategory, setSubCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState<string>('');
  const [tags, setTags] = useState<string>('');

  const filteredCategories = categories.filter((c) => c.type === type);
  const selectedCatObj = filteredCategories.find((c) => c.name === mainCategory) || filteredCategories[0];
  const subCategories = selectedCatObj?.subCategories || [];

  // Ensure mainCategory and subCategory are always synchronized with available categories
  useEffect(() => {
    const validCats = categories.filter((c) => c.type === type);
    if (validCats.length > 0) {
      if (!validCats.some((c) => c.name === mainCategory)) {
        setMainCategory(validCats[0].name);
        setSubCategory(validCats[0].subCategories[0] || '');
      }
    } else if (categories.length > 0) {
      setMainCategory(categories[0].name);
      setSubCategory(categories[0].subCategories[0] || '');
    }
  }, [type, categories, mainCategory]);

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const newCats = categories.filter((c) => c.type === newType);
    if (newCats.length > 0) {
      setMainCategory(newCats[0].name);
      setSubCategory(newCats[0].subCategories[0] || '');
    }
  };

  const handleMainCatChange = (catName: string) => {
    setMainCategory(catName);
    const catObj = categories.find((c) => c.name === catName);
    if (catObj && catObj.subCategories.length > 0) {
      setSubCategory(catObj.subCategories[0]);
    } else {
      setSubCategory('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onAddTransaction({
      type,
      amount: numAmount,
      mainCategory,
      subCategory,
      date,
      note: note.trim() || undefined,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
    });

    setAmount('');
    setNote('');
    setTags('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Plus className="w-5 h-5 stroke-[3]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">新增財務紀錄</h3>
              <p className="text-xs text-zinc-400">整合收入、支出、稅金、投資</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-xl hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selector Tabs */}
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-zinc-950 rounded-2xl border border-zinc-800">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2 text-xs font-bold rounded-xl transition ${
                type === 'expense'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              支出
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2 text-xs font-bold rounded-xl transition ${
                type === 'income'
                  ? 'bg-emerald-500 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              收入
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('investment')}
              className={`py-2 text-xs font-bold rounded-xl transition ${
                type === 'investment'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              投資
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('tax')}
              className={`py-2 text-xs font-bold rounded-xl transition ${
                type === 'tax'
                  ? 'bg-orange-500 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              稅金
            </button>
          </div>

          {/* Amount Field */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              金額 (NT$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-zinc-500 font-bold">$</span>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-8 pr-4 py-2.5 text-lg font-mono font-bold text-amber-300 focus:border-emerald-500 focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* Main Category Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-300">主要類別 (大類)</label>
              <button
                type="button"
                onClick={onOpenCategoryManager}
                className="text-xs text-amber-400 hover:underline"
              >
                + 管理/自訂類別
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 bg-zinc-950 rounded-2xl border border-zinc-800">
              {filteredCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleMainCatChange(cat.name)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-semibold text-left transition truncate ${
                    mainCategory === cat.name
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                      : 'bg-zinc-900/60 text-zinc-400 border border-zinc-800/80 hover:text-zinc-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Subcategory Chips (細類如：早餐、午餐、晚餐、宵夜、點心) */}
          {subCategories.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                細分小項目 (細類)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-zinc-950 rounded-2xl border border-zinc-800">
                {subCategories.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubCategory(sub)}
                    className={`px-3 py-1 rounded-xl text-xs transition cursor-pointer ${
                      subCategory === sub
                        ? 'text-zinc-950 font-extrabold shadow'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                    style={{
                      backgroundColor: subCategory === sub ? currentTheme.primaryHex : undefined,
                    }}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" /> 日期
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-zinc-400" /> 備註說明
              </label>
              <input
                type="text"
                placeholder="例如: 外送便當, 0050定期扣款"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!amount}
              className="px-6 py-2.5 text-zinc-950 font-bold text-sm rounded-xl transition disabled:opacity-40 shadow-lg cursor-pointer"
              style={{
                backgroundColor: currentTheme.primaryHex,
                boxShadow: `0 0 15px rgba(${currentTheme.bgGlowRgb}, 0.3)`,
              }}
            >
              確認記錄
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
