import React, { useState, useEffect } from 'react';
import { X, Palette, DollarSign, Settings, Check, Sparkles, Smartphone, Layers } from 'lucide-react';
import { FIREConfig } from '../types';
import { THEME_PRESETS, CURRENCY_OPTIONS, getThemePreset } from '../utils/theme';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: FIREConfig;
  onSaveConfig: (newConfig: FIREConfig) => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [formData, setFormData] = useState<FIREConfig>(config);
  const [isCustomCurrency, setIsCustomCurrency] = useState(false);
  const [customCurrencyInput, setCustomCurrencyInput] = useState('');
  const [isCustomColor, setIsCustomColor] = useState(false);
  const [customColorHex, setCustomColorHex] = useState('#ff69b4');

  // Widget Category Configuration State
  const [widgetCats, setWidgetCats] = useState<string[]>(['飲食', '娛樂', '交通', '日用', '收入', '投資']);

  useEffect(() => {
    setFormData(config);
    const isStandardCurrency = CURRENCY_OPTIONS.some((c) => c.symbol === config.currencySymbol);
    if (!isStandardCurrency) {
      setIsCustomCurrency(true);
      setCustomCurrencyInput(config.currencySymbol);
    } else {
      setIsCustomCurrency(false);
    }

    if (config.themeColor && config.themeColor.startsWith('#')) {
      setIsCustomColor(true);
      setCustomColorHex(config.themeColor);
    } else {
      setIsCustomColor(false);
    }

    // Load custom widget categories from localStorage
    try {
      const savedCats = localStorage.getItem('widget_custom_cats');
      if (savedCats) {
        const parsed = JSON.parse(savedCats);
        if (Array.isArray(parsed) && parsed.length === 6) {
          setWidgetCats(parsed);
        }
      }
    } catch (e) {}
  }, [config, isOpen]);

  if (!isOpen) return null;

  const currentTheme = getThemePreset(formData.themeColor);

  const handleChange = (field: keyof FIREConfig, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSelectThemePreset = (presetId: string) => {
    setIsCustomColor(false);
    handleChange('themeColor', presetId);
  };

  const handleCustomColorChange = (hex: string) => {
    setCustomColorHex(hex);
    setIsCustomColor(true);
    handleChange('themeColor', hex);
  };

  const handleCurrencySelect = (sym: string) => {
    if (sym === 'custom') {
      setIsCustomCurrency(true);
    } else {
      setIsCustomCurrency(false);
      handleChange('currencySymbol', sym);
    }
  };

  const handleWidgetCatChange = (index: number, val: string) => {
    const updated = [...widgetCats];
    updated[index] = val;
    setWidgetCats(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCurrency = isCustomCurrency
      ? customCurrencyInput.trim() || 'NT$'
      : formData.currencySymbol;

    const finalConfig = {
      ...formData,
      currencySymbol: finalCurrency,
      themeColor: isCustomColor ? customColorHex : formData.themeColor || 'sakura',
    };

    // Save Widget custom categories
    try {
      localStorage.setItem('widget_custom_cats', JSON.stringify(widgetCats));
    } catch (e) {}

    onSaveConfig(finalConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="bg-[#0e0e0e] border border-white/10 w-full max-w-2xl rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] text-gray-200"
        style={{
          boxShadow: `0 0 30px rgba(${currentTheme.bgGlowRgb}, 0.2)`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center transition-colors"
              style={{ backgroundColor: currentTheme.primaryHex, color: '#000' }}
            >
              <Settings className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                系統與介面偏好設定
              </h2>
              <p className="text-xs text-gray-400">
                自訂主題視覺色彩、預算顯示貨幣、Android 桌面小工具分類與 FIRE 模型
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1: 主題顏色設定 */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-pink-400" />
                設定 1: 主題視覺顏色 (Theme Accent Color)
              </label>
              <span className="text-xs font-mono text-gray-400">
                目前: <span style={{ color: currentTheme.primaryHex }} className="font-bold">{currentTheme.name}</span>
              </span>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {THEME_PRESETS.map((preset) => {
                const isSelected = !isCustomColor && formData.themeColor === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectThemePreset(preset.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-white/15 border-white/30 text-white shadow-lg'
                        : 'bg-black/40 border-white/5 text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border border-black/40"
                      style={{ backgroundColor: preset.primaryHex }}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                    </span>
                    <span className="truncate">{preset.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Color Input */}
            <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                任意自訂色彩 (Custom Hex):
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColorHex}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  placeholder="#ff69b4"
                  value={customColorHex}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  className="w-24 bg-black/60 border border-white/10 rounded-xl px-2.5 py-1 text-xs font-mono text-white focus:border-pink-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Android 桌面 Widget 小工具大類配置 */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-pink-400" />
                設定 2: Android 桌面 Widget 6 大類別自訂配置
              </label>
              <span className="text-xs text-gray-400 font-mono">桌面小工具預覽</span>
            </div>

            <p className="text-xs text-gray-400">
              設定要在 Android 桌面 AppWidget 第一步顯示的 6 個主要大類別名稱：
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {widgetCats.map((catName, idx) => (
                <div key={idx} className="space-y-1">
                  <span className="text-[10px] text-pink-400 font-bold block">位置 {idx + 1}:</span>
                  <input
                    type="text"
                    value={catName}
                    onChange={(e) => handleWidgetCatChange(idx, e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:border-pink-500 focus:outline-none"
                    placeholder={`類別 ${idx + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: 貨幣種類設定 */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                設定 3: 顯示貨幣種類 (Currency Symbol)
              </label>
              <span className="text-xs font-mono text-gray-400">
                符號: <span className="font-bold text-emerald-400">{formData.currencySymbol}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-gray-400 block mb-1">選擇常用國際貨幣:</span>
                <select
                  value={isCustomCurrency ? 'custom' : formData.currencySymbol}
                  onChange={(e) => handleCurrencySelect(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.symbol} value={c.symbol} className="bg-zinc-900 text-white">
                      {c.label}
                    </option>
                  ))}
                  <option value="custom" className="bg-zinc-900 text-emerald-300">
                    + 自訂其他貨幣符號...
                  </option>
                </select>
              </div>

              {isCustomCurrency && (
                <div>
                  <span className="text-xs text-emerald-400 block mb-1">輸入自訂貨幣符號:</span>
                  <input
                    type="text"
                    placeholder="例如: $, ฿, R$"
                    value={customCurrencyInput}
                    onChange={(e) => {
                      setCustomCurrencyInput(e.target.value);
                      handleChange('currencySymbol', e.target.value);
                    }}
                    className="w-full bg-black/60 border border-emerald-500/50 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* SECTION 4: FIRE 退休演算法核心參數 */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 space-y-4">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-2">
              <Layers className="w-3.5 h-3.5 text-cyan-400" /> FIRE 退休財務模型參數
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-gray-400 block mb-1">目前年齡 (歲):</label>
                <input
                  type="number"
                  value={formData.currentAge}
                  onChange={(e) => handleChange('currentAge', parseInt(e.target.value) || 0)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">目標 FIRE 退休年齡 (歲):</label>
                <input
                  type="number"
                  value={formData.targetRetirementAge}
                  onChange={(e) => handleChange('targetRetirementAge', parseInt(e.target.value) || 0)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-300 font-medium block">現金儲蓄與其他非投資資產 ({formData.currencySymbol}):</label>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    獨立現金儲備
                  </span>
                </div>
                <input
                  type="number"
                  value={formData.baseCashBalance ?? (formData.cashSavings || 0)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const stockVal = Math.max(0, (formData.currentNetWorth || 0) - (formData.cashSavings || formData.baseCashBalance || 0));
                    setFormData((prev) => ({
                      ...prev,
                      baseCashBalance: val,
                      cashSavings: val,
                      currentNetWorth: val + stockVal,
                    }));
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="輸入活存、定存等備用金"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  💡 總資產試算：現金儲備 <span className="text-emerald-400 font-mono">{formData.currencySymbol}{(formData.baseCashBalance ?? (formData.cashSavings || 0)).toLocaleString()}</span> + 股票市值 <span className="text-cyan-400 font-mono">{formData.currencySymbol}{Math.max(0, (formData.currentNetWorth || 0) - (formData.cashSavings || formData.baseCashBalance || 0)).toLocaleString()}</span> = <span className="text-white font-bold font-mono">{formData.currencySymbol}{(formData.currentNetWorth || 0).toLocaleString()}</span>
                </p>
              </div>

              <div>
                <label className="text-gray-400 block mb-1">退休後預期年支出 ({formData.currencySymbol}):</label>
                <input
                  type="number"
                  value={formData.targetAnnualExpensePostRetirement}
                  onChange={(e) =>
                    handleChange('targetAnnualExpensePostRetirement', parseFloat(e.target.value) || 0)
                  }
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">預期年化投資報酬率 (%):</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.expectedInvestmentReturnRate}
                  onChange={(e) =>
                    handleChange('expectedInvestmentReturnRate', parseFloat(e.target.value) || 0)
                  }
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">預期年通膨率 (%):</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.expectedInflationRate}
                  onChange={(e) =>
                    handleChange('expectedInflationRate', parseFloat(e.target.value) || 0)
                  }
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              取消
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 font-extrabold text-xs rounded-xl shadow-lg transition cursor-pointer active:scale-95 flex items-center gap-1.5"
              style={{
                backgroundColor: currentTheme.primaryHex,
                color: '#000',
                boxShadow: `0 0 15px rgba(${currentTheme.bgGlowRgb}, 0.4)`,
              }}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              儲存設定
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
