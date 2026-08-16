import React, { useState, useEffect } from 'react';
import { X, Palette, DollarSign, Settings, Check, Sparkles, Smartphone, Layers, Cloud, ShieldCheck, Copy, ExternalLink, Radio, Lock, Trash2, RefreshCw } from 'lucide-react';
import { FIREConfig } from '../types';
import { THEME_PRESETS, CURRENCY_OPTIONS, getThemePreset } from '../utils/theme';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: FIREConfig;
  stockMarketValue?: number;
  onSaveConfig: (newConfig: FIREConfig) => void;
  syncCode: string;
  storageMode: 'cloud' | 'local';
  onToggleStorageMode: (newMode: 'cloud' | 'local') => Promise<void>;
  onOpenCloudSync: () => void;
  onClearAllLocalData?: () => void;
  onLoadDemoData?: () => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  stockMarketValue = 0,
  onSaveConfig,
  syncCode,
  storageMode,
  onToggleStorageMode,
  onOpenCloudSync,
  onClearAllLocalData,
  onLoadDemoData,
}) => {
  const [formData, setFormData] = useState<FIREConfig>(config);
  const [isCustomCurrency, setIsCustomCurrency] = useState(false);
  const [customCurrencyInput, setCustomCurrencyInput] = useState('');
  const [isCustomColor, setIsCustomColor] = useState(false);
  const [customColorHex, setCustomColorHex] = useState('#ff69b4');
  const [copied, setCopied] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  // Dedicated string states for numeric inputs to avoid premature 0 resets during typing
  const [cashInput, setCashInput] = useState<string>('');
  const [cashUSDInput, setCashUSDInput] = useState<string>('');
  const [currentAgeInput, setCurrentAgeInput] = useState<string>('');
  const [targetRetirementAgeInput, setTargetRetirementAgeInput] = useState<string>('');
  const [targetAnnualExpenseInput, setTargetAnnualExpenseInput] = useState<string>('');
  const [expectedReturnRateInput, setExpectedReturnRateInput] = useState<string>('');
  const [expectedInflationRateInput, setExpectedInflationRateInput] = useState<string>('');

  // Widget Category Configuration State
  const [widgetCats, setWidgetCats] = useState<string[]>(['飲食', '娛樂', '交通', '日用', '收入', '投資']);

  useEffect(() => {
    if (!isOpen) return;

    setFormData(config);
    const initialCashTWD = config.cashSavingsTWD ?? (config.cashSavings ?? (config.baseCashBalance || 0));
    const initialCashUSD = config.cashSavingsUSD ?? 0;
    setCashInput(String(initialCashTWD));
    setCashUSDInput(String(initialCashUSD));
    setCurrentAgeInput(String(config.currentAge || 30));
    setTargetRetirementAgeInput(String(config.targetRetirementAge || 50));
    setTargetAnnualExpenseInput(String(config.targetAnnualExpensePostRetirement || 600000));
    setExpectedReturnRateInput(String(config.expectedInvestmentReturnRate ?? 7));
    setExpectedInflationRateInput(String(config.expectedInflationRate ?? 2.5));

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
  }, [isOpen]);

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

    const parsedCashTWD = parseFloat(cashInput);
    const finalCashTWD = isNaN(parsedCashTWD) ? 0 : parsedCashTWD;
    const parsedCashUSD = parseFloat(cashUSDInput);
    const finalCashUSD = isNaN(parsedCashUSD) ? 0 : parsedCashUSD;
    const rate = formData.usdRate || 32.0;
    const totalCashTWD = Math.round(finalCashTWD + finalCashUSD * rate);

    const finalAge = parseInt(currentAgeInput) || 30;
    const finalRetirementAge = parseInt(targetRetirementAgeInput) || 50;
    const finalExpense = parseFloat(targetAnnualExpenseInput) || 0;
    const finalReturnRate = parseFloat(expectedReturnRateInput) || 0;
    const finalInflationRate = parseFloat(expectedInflationRateInput) || 0;

    const finalConfig: FIREConfig = {
      ...formData,
      currencySymbol: finalCurrency,
      themeColor: isCustomColor ? customColorHex : formData.themeColor || 'sakura',
      cashSavings: finalCashTWD,
      cashSavingsTWD: finalCashTWD,
      cashSavingsUSD: finalCashUSD,
      baseCashBalance: finalCashTWD,
      currentNetWorth: Math.round(totalCashTWD + stockMarketValue),
      currentAge: finalAge,
      targetRetirementAge: finalRetirementAge,
      targetAnnualExpensePostRetirement: finalExpense,
      expectedInvestmentReturnRate: finalReturnRate,
      expectedInflationRate: finalInflationRate,
    };

    // Save Widget custom categories
    try {
      localStorage.setItem('widget_custom_cats', JSON.stringify(widgetCats));
    } catch (e) {}

    onSaveConfig(finalConfig);
    onClose();
  };

  const handleCopySyncCode = () => {
    navigator.clipboard.writeText(syncCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleModeSwitch = async (targetMode: 'cloud' | 'local') => {
    if (targetMode === storageMode || isSwitchingMode) return;

    if (targetMode === 'cloud') {
      const confirmed = window.confirm(
        '☁️ 確定要切換至「雲端即時同步模式」嗎？\n\n系統將自動為您生成專屬同步碼，並將目前本機的記帳、股票庫存與財務設定安全上傳至 Supabase 雲端資料庫。'
      );
      if (!confirmed) return;

      setIsSwitchingMode(true);
      try {
        await onToggleStorageMode('cloud');
      } finally {
        setIsSwitchingMode(false);
      }
    } else {
      const confirmed = window.confirm(
        `⚠️ 確定要切換至「純本機離線模式」嗎？\n\n切換後，系統將【清空抹除】同步碼 [${syncCode}] 在雲端資料庫的所有備份紀錄，未來所有財務與股票數據僅保存在本機裝置上，不再進行任何雲端同步。`
      );
      if (!confirmed) return;

      setIsSwitchingMode(true);
      try {
        await onToggleStorageMode('local');
      } finally {
        setIsSwitchingMode(false);
      }
    }
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
          {/* SECTION 0: 數據存儲模式與雲端同步 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <Cloud className="w-4 h-4 text-emerald-400" />
                數據存儲與同步模式 (Data Storage Mode)
              </label>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border flex items-center gap-1.5 ${
                  storageMode === 'cloud'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                }`}
              >
                {storageMode === 'cloud' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    雲端多裝置即時同步中
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-zinc-400" />
                    純本機離線保存
                  </>
                )}
              </span>
            </div>

            {/* Mode Switch Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Cloud Mode */}
              <button
                type="button"
                onClick={() => handleModeSwitch('cloud')}
                disabled={isSwitchingMode}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 relative overflow-hidden ${
                  storageMode === 'cloud'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-white shadow-lg'
                    : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${storageMode === 'cloud' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-gray-400'}`}>
                      <Cloud className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs text-white">☁️ 雲端同步模式</span>
                  </div>
                  {storageMode === 'cloud' && <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />}
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  多裝置即時同步・雲端安全備份・WebSocket 毫秒級推播
                </p>
              </button>

              {/* Option 2: Local Mode */}
              <button
                type="button"
                onClick={() => handleModeSwitch('local')}
                disabled={isSwitchingMode}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 relative overflow-hidden ${
                  storageMode === 'local'
                    ? 'bg-zinc-800/80 border-zinc-500 text-white shadow-lg'
                    : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${storageMode === 'local' ? 'bg-zinc-700 text-zinc-200' : 'bg-white/5 text-gray-400'}`}>
                      <Lock className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs text-white">📱 純本機離線模式</span>
                  </div>
                  {storageMode === 'local' && <Check className="w-4 h-4 text-zinc-300 stroke-[3]" />}
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  完全不聯網・極致隱私保護・數據僅保存在本機裝置上
                </p>
              </button>
            </div>

            {/* Sync Code & Advanced Cloud Settings (Only in Cloud Mode) */}
            {storageMode === 'cloud' && (
              <div className="bg-black/50 border border-emerald-500/20 p-3.5 rounded-xl space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-400">目前雲端專屬同步碼:</span>
                  <span className="font-mono font-bold text-amber-300 text-xs">{syncCode}</span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopySyncCode}
                    className="flex items-center gap-1 text-[11px] bg-white/5 hover:bg-white/10 text-gray-300 px-2.5 py-1 rounded-lg border border-white/10 transition cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">已複製</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>複製同步碼</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCloudSync();
                    }}
                    className="flex items-center gap-1 text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-500/30 transition cursor-pointer font-bold"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>管理 Supabase 資料庫</span>
                  </button>
                </div>
              </div>
            )}
          </div>

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
                  value={currentAgeInput}
                  onChange={(e) => {
                    setCurrentAgeInput(e.target.value);
                    handleChange('currentAge', parseInt(e.target.value) || 0);
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">期望退休年齡基準線 (歲):</label>
                <input
                  type="number"
                  value={targetRetirementAgeInput}
                  onChange={(e) => {
                    setTargetRetirementAgeInput(e.target.value);
                    handleChange('targetRetirementAge', parseInt(e.target.value) || 0);
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  💡 系統將根據您的儲蓄與投資複利速度，動態精算最快達成退休的實際年齡
                </p>
              </div>

              {/* TWD Cash Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-300 font-medium block">🇹🇼 台幣現金儲備 (NT$):</label>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    台幣活存/備用金
                  </span>
                </div>
                <input
                  type="number"
                  value={cashInput}
                  onChange={(e) => {
                    const rawStr = e.target.value;
                    setCashInput(rawStr);
                    const parsedTWD = parseFloat(rawStr) || 0;
                    const parsedUSD = parseFloat(cashUSDInput) || 0;
                    const rate = formData.usdRate || 32.0;
                    const totalCash = Math.round(parsedTWD + parsedUSD * rate);
                    setFormData((prev) => ({
                      ...prev,
                      cashSavingsTWD: parsedTWD,
                      baseCashBalance: parsedTWD,
                      cashSavings: parsedTWD,
                      currentNetWorth: Math.round(totalCash + stockMarketValue),
                    }));
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="輸入台幣活存、定存等備用金"
                />
              </div>

              {/* USD Cash Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-300 font-medium block">🇺🇸 美元現金儲備 (USD $):</label>
                  <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                    美元帳戶/券商餘額
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={cashUSDInput}
                  onChange={(e) => {
                    const rawStr = e.target.value;
                    setCashUSDInput(rawStr);
                    const parsedUSD = parseFloat(rawStr) || 0;
                    const parsedTWD = parseFloat(cashInput) || 0;
                    const rate = formData.usdRate || 32.0;
                    const totalCash = Math.round(parsedTWD + parsedUSD * rate);
                    setFormData((prev) => ({
                      ...prev,
                      cashSavingsUSD: parsedUSD,
                      currentNetWorth: Math.round(totalCash + stockMarketValue),
                    }));
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="輸入美元帳戶現金 (USD)"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  💡 總現金折合：<span className="text-emerald-400 font-mono font-bold">NT$ {((parseFloat(cashInput) || 0) + (parseFloat(cashUSDInput) || 0) * (formData.usdRate || 32.0)).toLocaleString()}</span>（美元匯率: 1 USD = {(formData.usdRate || 32.0).toFixed(2)} TWD）
                </p>
              </div>

              <div>
                <label className="text-gray-400 block mb-1">退休後預期年支出 ({formData.currencySymbol}):</label>
                <input
                  type="number"
                  value={targetAnnualExpenseInput}
                  onChange={(e) => {
                    setTargetAnnualExpenseInput(e.target.value);
                    handleChange('targetAnnualExpensePostRetirement', parseFloat(e.target.value) || 0);
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">預期年化投資報酬率 (%):</label>
                <input
                  type="number"
                  step="0.1"
                  value={expectedReturnRateInput}
                  onChange={(e) => {
                    setExpectedReturnRateInput(e.target.value);
                    handleChange('expectedInvestmentReturnRate', parseFloat(e.target.value) || 0);
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">預期年通膨率 (%):</label>
                <input
                  type="number"
                  step="0.1"
                  value={expectedInflationRateInput}
                  onChange={(e) => {
                    setExpectedInflationRateInput(e.target.value);
                    handleChange('expectedInflationRate', parseFloat(e.target.value) || 0);
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: 資料庫維護與重設 */}
          <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-red-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                設定 5: 資料管理與重設 ({storageMode === 'cloud' ? '雲端同步模式' : '純本機模式'})
              </label>
              <span className="text-[11px] text-gray-400 font-bold">
                {storageMode === 'cloud' ? '☁️ 連動 Supabase 雲端' : '📱 僅限本機儲存'}
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              {storageMode === 'cloud'
                ? '目前處於「雲端同步模式」。清空操作將同步清空 Supabase 雲端資料庫與本機的所有記帳交易、持股庫存與現金儲備。'
                : '目前處於「純本機離線模式」。清空操作將清空手機/瀏覽器本機的所有記帳交易、持股庫存與現金儲備。'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const confirmMsg = storageMode === 'cloud'
                    ? '⚠️ 確定要清空「雲端與本機」的所有同步資料嗎？\n此操作將清空 Supabase 雲端與本機的記帳明細、持股庫存與現金儲備，回歸全新空白起點。'
                    : '⚠️ 確定要清除本機的所有離線紀錄嗎？\n此操作將清空本機的所有記帳明細、持股庫存與現金儲備，回歸全新空白起點。';
                  if (window.confirm(confirmMsg)) {
                    onClearAllLocalData?.();
                    onClose();
                  }
                }}
                className="p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>
                  {storageMode === 'cloud' ? '🗑️ 清空雲端與本機同步紀錄' : '🗑️ 清除本機離線紀錄'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm('確定要載入預設範例資料（包含美股/台股範例庫存與記帳範例）嗎？')) {
                    onLoadDemoData?.();
                    onClose();
                  }
                }}
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                <span>🔄 載入預設範例資料</span>
              </button>
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
