import React, { useState } from 'react';
import { Smartphone, Zap, CheckCircle2, ChevronRight, Plus, Sparkles, SlidersHorizontal } from 'lucide-react';
import { CategoryItem, QuickPreset, Transaction, TransactionType } from '../types';
import { getThemePreset } from '../utils/theme';

interface MobileWidgetProps {
  categories: CategoryItem[];
  quickPresets: QuickPreset[];
  currencySymbol?: string;
  themeColor?: string;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onOpenFullModal: () => void;
  onOpenCategoryManager: () => void;
}

export const MobileWidget: React.FC<MobileWidgetProps> = ({
  categories,
  quickPresets,
  currencySymbol = 'NT$',
  themeColor = 'cyan',
  onAddTransaction,
  onOpenFullModal,
  onOpenCategoryManager,
}) => {
  const currentTheme = getThemePreset(themeColor);
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [selectedMainCat, setSelectedMainCat] = useState<string>('飲食');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('早餐');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const filteredCategories = categories.filter((c) => c.type === transactionType);
  const currentMainCatObj = categories.find((c) => c.name === selectedMainCat) || filteredCategories[0] || categories[0];
  const currentSubCategories = currentMainCatObj?.subCategories || ['早餐', '午餐', '晚餐', '宵夜', '點心'];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSelectMainCat = (catName: string) => {
    setSelectedMainCat(catName);
    const matchedObj = categories.find((c) => c.name === catName);
    if (matchedObj && matchedObj.subCategories.length > 0) {
      setSelectedSubCat(matchedObj.subCategories[0]);
    }
  };

  const handleSelectPresetFromDropdown = (presetId: string) => {
    if (!presetId) return;
    const preset = quickPresets.find((p) => p.id === presetId);
    if (preset) {
      setSelectedMainCat(preset.mainCategory);
      setSelectedSubCat(preset.subCategory);
      setAmount(String(preset.amount));
      setNote(`常用速記: ${preset.label}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    onAddTransaction({
      type: transactionType,
      amount: numAmount,
      mainCategory: selectedMainCat,
      subCategory: selectedSubCat,
      date: new Date().toISOString().split('T')[0],
      note: note.trim() || undefined,
    });

    showToast(`✅ 已速記：${selectedMainCat} > ${selectedSubCat} ${currencySymbol} ${numAmount}`);
    setAmount('');
    setNote('');
  };

  const handleQuickAmountAdd = (val: number) => {
    const current = parseFloat(amount) || 0;
    setAmount(String(current + val));
  };

  return (
    <div
      className="relative max-w-sm mx-auto my-2 bg-[#050505] p-3.5 sm:p-4 rounded-[32px] border-[2.5px] border-white/10 shadow-2xl overflow-hidden"
      style={{
        boxShadow: `0 0 25px rgba(${currentTheme.bgGlowRgb}, 0.25)`,
      }}
    >
      {/* Phone Notch */}
      <div className="w-24 h-3.5 bg-[#111111] rounded-b-xl mx-auto mb-2.5 flex items-center justify-center">
        <div className="w-7 h-1 bg-white/20 rounded-full" />
      </div>

      {/* Widget Header Badge */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div className="flex items-center space-x-1.5 text-xs font-bold" style={{ color: currentTheme.primaryHex }}>
          <Smartphone className="w-4 h-4" />
          <span>手機桌面 1秒極速記帳</span>
        </div>
        <span className="text-[10px] font-mono bg-white/5 text-gray-400 px-2 py-0.5 rounded-full border border-white/10">
          Widget 小工具
        </span>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className="absolute top-10 left-3 right-3 z-30 text-black px-3 py-2 rounded-xl text-xs font-extrabold shadow-lg flex items-center gap-1.5 animate-bounce"
          style={{ backgroundColor: currentTheme.primaryHex }}
        >
          <CheckCircle2 className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Streamlined Compact Widget Card */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-3 space-y-3 shadow-inner">
        {/* Quick Presets Dropdown (Scroll / Select Picker instead of bulky grids) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span className="flex items-center gap-1 font-bold">
              <Zap className="w-3 h-3" style={{ color: currentTheme.primaryHex }} /> 常用速記下拉選擇
            </span>
            <span>帶入預設金額</span>
          </div>
          <select
            onChange={(e) => handleSelectPresetFromDropdown(e.target.value)}
            defaultValue=""
            className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-200 focus:outline-none cursor-pointer"
          >
            <option value="" disabled className="bg-zinc-900 text-gray-500">
              ⚡ 點擊快速帶入常用項目 (例如: 早餐 $85, 午餐 $130...)
            </option>
            {quickPresets.map((p) => (
              <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                {p.label} ({p.mainCategory} › {p.subCategory}) - {currencySymbol} {p.amount}
              </option>
            ))}
          </select>
        </div>

        {/* FIELD 1: 大類 (Main Category Horizontal Scroll / Select) */}
        <div className="space-y-1 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-300">
            <span>1. 大類分類</span>
            <span className="text-[10px] text-gray-500 font-normal">左右滾動或點選</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
            {filteredCategories.map((cat) => {
              const isSelected = selectedMainCat === cat.name;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectMainCat(cat.name)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    isSelected
                      ? 'text-black font-extrabold shadow-md'
                      : 'bg-black/50 text-gray-400 border border-white/5 hover:text-gray-200'
                  }`}
                  style={{
                    backgroundColor: isSelected ? currentTheme.primaryHex : undefined,
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* FIELD 2: 細類 (Subcategory Scroll / Dropdown Picker) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-300">
            <span>2. 細類細項</span>
            <button
              onClick={onOpenCategoryManager}
              className="text-[10px] underline hover:text-white"
              style={{ color: currentTheme.primaryHex }}
            >
              + 管理細項
            </button>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {currentSubCategories.map((sub) => {
              const isSelected = selectedSubCat === sub;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSelectedSubCat(sub)}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-white/15 border font-bold text-white'
                      : 'bg-black/40 text-gray-400 hover:text-gray-300 border border-white/5'
                  }`}
                  style={{
                    borderColor: isSelected ? currentTheme.primaryHex : undefined,
                    color: isSelected ? currentTheme.primaryHex : undefined,
                  }}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        </div>

        {/* FIELD 3: 金額 (Amount Input & Quick Addition Pills) */}
        <form onSubmit={handleSubmit} className="space-y-2 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-300">
            <span>3. 輸入金額</span>
            <span className="text-[10px] font-mono text-gray-500">{currencySymbol}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-500 font-mono">
                {currencySymbol}
              </span>
              <input
                type="number"
                step="any"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-2.5 py-1.5 text-sm font-mono font-bold text-white placeholder-gray-600 focus:outline-none"
                style={{
                  borderColor: amount ? currentTheme.primaryHex : undefined,
                }}
              />
            </div>

            <button
              type="submit"
              disabled={!amount}
              className="px-4 py-1.5 text-black font-extrabold text-xs rounded-xl disabled:opacity-30 transition active:scale-95 cursor-pointer flex items-center gap-1 shadow-md"
              style={{
                backgroundColor: currentTheme.primaryHex,
              }}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              寫入
            </button>
          </div>

          {/* Quick Amount Add Pills */}
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span className="font-mono">快速累加:</span>
            <div className="flex items-center gap-1">
              {[10, 50, 100, 500].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleQuickAmountAdd(v)}
                  className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded border border-white/5 text-gray-300 font-mono"
                >
                  +{v}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Bottom Trigger for Full View */}
        <div className="pt-1.5 border-t border-white/5 text-center">
          <button
            onClick={onOpenFullModal}
            className="text-[11px] font-semibold inline-flex items-center gap-1 transition hover:underline"
            style={{ color: currentTheme.primaryHex }}
          >
            開啟完整多功能記帳介面 <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
