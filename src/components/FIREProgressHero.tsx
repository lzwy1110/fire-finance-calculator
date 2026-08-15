import React, { useState } from 'react';
import { Flame, ShieldCheck, TrendingUp, Sparkles, Sliders, Calendar, ArrowUpRight, DollarSign, Target, Award, CheckCircle2 } from 'lucide-react';
import { FIREConfig, FIREResult } from '../types';
import { getThemePreset } from '../utils/theme';

interface FIREProgressHeroProps {
  config: FIREConfig;
  result: FIREResult;
  onUpdateConfig: (newConfig: FIREConfig) => void;
}

export const FIREProgressHero: React.FC<FIREProgressHeroProps> = ({
  config,
  result,
  onUpdateConfig,
}) => {
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<FIREConfig>(config);

  const currentTheme = getThemePreset(config.themeColor);
  const sym = config.currencySymbol || 'NT$';

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('zh-TW').format(num);
  };

  const formatCurrency = (num: number) => {
    if (num < 0) {
      return `-${sym} ${formatNumber(Math.abs(num))}`;
    }
    return `${sym} ${formatNumber(num)}`;
  };

  const handleSaveSimulation = () => {
    onUpdateConfig(tempConfig);
    setIsSimulatorOpen(false);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-white/10 p-6 sm:p-8 shadow-2xl">
      {/* Background ambient lighting */}
      <div
        className="absolute -right-16 -top-16 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
        style={{ backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.2)` }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
        style={{ backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)` }}
      />

      <div className="relative z-10 space-y-6">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div
              className="p-3 rounded-2xl border flex items-center justify-center transition-all"
              style={{
                backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                borderColor: `rgba(${currentTheme.bgGlowRgb}, 0.35)`,
                color: currentTheme.primaryHex,
                boxShadow: `0 0 15px rgba(${currentTheme.bgGlowRgb}, 0.25)`,
              }}
            >
              <Flame className="w-7 h-7 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  FIRE 財務獨立・退休倒數
                </h2>
                <span
                  className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-bold border rounded-full"
                  style={{
                    backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.2)`,
                    color: currentTheme.primaryHex,
                    borderColor: `rgba(${currentTheme.bgGlowRgb}, 0.35)`,
                  }}
                >
                  4% 提領法則
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-400">
                目標退休年支出 {sym} {formatNumber(config.targetAnnualExpensePostRetirement)} ({sym} {formatNumber(Math.round(config.targetAnnualExpensePostRetirement / 12))}/月)
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              const currentLiveCash = config.cashSavings ?? (config.baseCashBalance || 0);
              setTempConfig({
                ...config,
                cashSavings: currentLiveCash,
                baseCashBalance: currentLiveCash,
              });
              setIsSimulatorOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs sm:text-sm font-semibold transition cursor-pointer shadow-md"
            style={{ color: currentTheme.primaryHex }}
          >
            <Sliders className="w-4 h-4" style={{ color: currentTheme.primaryHex }} />
            調整 FIRE 參數與模擬
          </button>
        </div>

        {/* Hero Countdown Highlight */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Main Big Days Countdown */}
          <div
            className="lg:col-span-7 bg-[#0c0c0c] p-6 rounded-3xl border border-white/10 relative overflow-hidden transition-all"
            style={{ boxShadow: `0 0 20px rgba(${currentTheme.bgGlowRgb}, 0.3)` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5" style={{ color: currentTheme.primaryHex }}>
                <Sparkles className="w-4 h-4" /> 距離財務自由進度
              </span>
              <span className="text-xs font-mono text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                年報酬率 {config.expectedInvestmentReturnRate}% | 通膨 {config.expectedInflationRate}%
              </span>
            </div>

            {result.daysToFIRE <= 0 ? (
              <div className="py-4 text-center">
                <div className="inline-flex p-3 bg-emerald-500/20 text-emerald-400 rounded-full mb-2">
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-emerald-400">恭喜！您已達到 FIRE 退休自由目標！</h3>
                <p className="text-sm text-gray-300 mt-1">您的總資產已超越目標，隨時可開啟被動收入生活！</p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline space-x-3 my-2">
                  <span className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight font-mono">
                    {result.currentProgressPercent}<span className="text-2xl sm:text-3xl font-normal" style={{ color: currentTheme.primaryHex }}>%</span>
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-gray-300">({formatNumber(result.daysToFIRE)} 天)</span>
                  <span className="text-sm sm:text-base text-gray-400 font-mono">
                    (約 {result.yearsToFIRE} 年)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-300 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1.5" style={{ color: currentTheme.primaryHex }}>
                    <Calendar className="w-4 h-4" />
                    <span>預計達成日：<strong className="text-white">{result.estimatedFIRERetirementDate}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-300">
                    <Target className="w-4 h-4 text-cyan-400" />
                    <span>精算退休年齡：<strong className="text-cyan-300 font-bold font-mono">{result.ageAtFIRE} 歲</strong></span>
                  </div>
                  {config.targetRetirementAge > 0 && (
                    <div className="flex items-center">
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                        result.ageAtFIRE <= config.targetRetirementAge
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      }`}>
                        {result.ageAtFIRE <= config.targetRetirementAge
                          ? `🎉 比期望目標 ${config.targetRetirementAge} 歲提前 ${(config.targetRetirementAge - result.ageAtFIRE).toFixed(1)} 年`
                          : `⏱️ 距期望目標 ${config.targetRetirementAge} 歲落後 ${(result.ageAtFIRE - config.targetRetirementAge).toFixed(1)} 年`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
            {/* Current Net Worth with Asset Allocation Donut */}
            {(() => {
              const cashAmt = config.cashSavings || config.baseCashBalance || 0;
              const stockAmt = Math.max(0, (config.currentNetWorth || 0) - cashAmt);
              const totalAmt = cashAmt + stockAmt || 1;
              const cashPct = Math.round((cashAmt / totalAmt) * 100);
              const stockPct = 100 - cashPct;
              const circumference = 2 * Math.PI * 14;
              const cashStrokeDash = (cashPct / 100) * circumference;
              const stockStrokeDash = circumference - cashStrokeDash;

              return (
                <div className="bg-[#111111] p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                  <div className="text-xs text-gray-400 flex items-center justify-between mb-1">
                    <span>目前總資產 (Total)</span>
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-3 my-1">
                    <div className="relative w-11 h-11 flex-shrink-0" title={`資產配置：現金 ${cashPct}% / 股票 ${stockPct}%`}>
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4.5" />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="4.5"
                          strokeDasharray={`${cashStrokeDash} ${circumference}`}
                          strokeDashoffset="0"
                          strokeLinecap="round"
                          className="transition-all duration-700"
                        />
                        {stockAmt > 0 && (
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#06b6d4"
                            strokeWidth="4.5"
                            strokeDasharray={`${stockStrokeDash} ${circumference}`}
                            strokeDashoffset={`-${cashStrokeDash}`}
                            strokeLinecap="round"
                            className="transition-all duration-700"
                          />
                        )}
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-400 font-mono">
                        {cashPct}%
                      </div>
                    </div>
                    <div>
                      <div className="text-lg sm:text-xl font-bold text-white font-mono leading-tight">
                        {formatCurrency(config.currentNetWorth)}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        現金 {cashPct}% / 股票 {stockPct}%
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 pt-1.5 border-t border-white/5 flex items-center justify-between flex-wrap gap-1">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      現金: <strong className="text-emerald-400 font-mono">{sym}{formatNumber(cashAmt)}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      股票: <strong className="text-cyan-400 font-mono">{sym}{formatNumber(stockAmt)}</strong>
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Target FIRE Capital */}
            <div className="bg-[#111111] p-4 rounded-2xl border border-white/5">
              <div className="text-xs text-gray-400 flex items-center justify-between mb-1">
                <span>FIRE 目標資產</span>
                <Target className="w-3.5 h-3.5" style={{ color: currentTheme.primaryHex }} />
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono" style={{ color: currentTheme.primaryHex }}>
                {sym} {formatNumber(result.targetFIREAmount)}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                以 4% 安全提領率計算
              </div>
            </div>

            {/* Monthly Net Savings */}
            <div className="bg-[#111111] p-4 rounded-2xl border border-white/5">
              <div className="text-xs text-gray-400 flex items-center justify-between mb-1">
                <span>估算月淨儲蓄</span>
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: currentTheme.primaryHex }} />
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono" style={{ color: currentTheme.primaryHex }}>
                {sym} {formatNumber(result.netMonthlySavings)}
              </div>
              <div className="text-[11px] mt-1 font-semibold" style={{ color: currentTheme.primaryHex }}>
                淨儲蓄率 {result.monthlySavingsRate}%
              </div>
            </div>

            {/* Post Retirement Monthly Income */}
            <div className="bg-[#111111] p-4 rounded-2xl border border-white/5">
              <div className="text-xs text-gray-400 flex items-center justify-between mb-1">
                <span>退休後月被動收入</span>
                <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-orange-300 font-mono">
                {sym} {formatNumber(result.monthlyInterestIncomeAtRetirement)}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                每月自投資組合提領
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar & Milestones */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-gray-300 font-medium">
            <span className="flex items-center gap-1 font-bold" style={{ color: currentTheme.primaryHex }}>
              <Flame className="w-3.5 h-3.5" /> FIRE 累積進度
            </span>
            <span className="font-mono">{result.currentProgressPercent}% ({sym} {formatNumber(config.currentNetWorth)} / {sym} {formatNumber(result.targetFIREAmount)})</span>
          </div>

          <div className="w-full bg-[#050505] h-3.5 rounded-full p-0.5 border border-white/10 overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-700 shadow-md"
              style={{
                width: `${Math.min(100, Math.max(2, result.currentProgressPercent))}%`,
                backgroundColor: currentTheme.primaryHex,
                boxShadow: `0 0 15px rgba(${currentTheme.bgGlowRgb}, 0.5)`,
              }}
            />
          </div>

          {/* FIRE Types Milestones */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            <div className={`p-2.5 rounded-xl border text-xs ${config.currentNetWorth >= result.coastFIREAmount ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300' : 'bg-[#111111] border-white/5 text-gray-400'}`}>
              <div className="flex items-center justify-between font-semibold mb-0.5">
                <span>Coast FIRE</span>
                {config.currentNetWorth >= result.coastFIREAmount && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
              </div>
              <div className="font-mono text-gray-200">{sym} {formatNumber(result.coastFIREAmount)}</div>
              <div className="text-[10px] text-gray-500">複利滾存即可退休</div>
            </div>

            <div className={`p-2.5 rounded-xl border text-xs ${config.currentNetWorth >= result.leanFIREAmount ? 'bg-white/10 border-white/20 text-white' : 'bg-[#111111] border-white/5 text-gray-400'}`}>
              <div className="flex items-center justify-between font-semibold mb-0.5">
                <span>Lean FIRE (簡約)</span>
                {config.currentNetWorth >= result.leanFIREAmount && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: currentTheme.primaryHex }} />}
              </div>
              <div className="font-mono text-gray-200">{sym} {formatNumber(result.leanFIREAmount)}</div>
              <div className="text-[10px] text-gray-500">80% 基礎開銷</div>
            </div>

            <div className={`p-2.5 rounded-xl border text-xs ${config.currentNetWorth >= result.targetFIREAmount ? 'bg-orange-950/40 border-orange-500/40 text-orange-300' : 'bg-[#111111] border-white/5 text-gray-400'}`}>
              <div className="flex items-center justify-between font-semibold mb-0.5">
                <span>Standard FIRE (標準)</span>
                {config.currentNetWorth >= result.targetFIREAmount && <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />}
              </div>
              <div className="font-mono text-gray-200">{sym} {formatNumber(result.targetFIREAmount)}</div>
              <div className="text-[10px] text-gray-500">100% 開銷覆蓋</div>
            </div>

            <div className={`p-2.5 rounded-xl border text-xs ${config.currentNetWorth >= result.fatFIREAmount ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-[#111111] border-white/5 text-gray-400'}`}>
              <div className="flex items-center justify-between font-semibold mb-0.5">
                <span>Fat FIRE (寬裕)</span>
                {config.currentNetWorth >= result.fatFIREAmount && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="font-mono text-gray-200">{sym} {formatNumber(result.fatFIREAmount)}</div>
              <div className="text-[10px] text-gray-500">150% 充裕開銷</div>
            </div>
          </div>
        </div>
      </div>

      {/* Simulator Modal */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5" style={{ color: currentTheme.primaryHex }} />
                <h3 className="text-xl font-bold text-white">FIRE 參數模擬器</h3>
              </div>
              <button
                onClick={() => setIsSimulatorOpen(false)}
                className="text-gray-400 hover:text-white text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div>
                <label className="block text-gray-400 mb-1">目前年齡 (歲)</label>
                <input
                  type="number"
                  value={tempConfig.currentAge}
                  onChange={(e) => setTempConfig({ ...tempConfig, currentAge: Number(e.target.value) })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">期望目標退休年齡基準線 (歲)</label>
                <input
                  type="number"
                  value={tempConfig.targetRetirementAge}
                  onChange={(e) => setTempConfig({ ...tempConfig, targetRetirementAge: Number(e.target.value) })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-gray-300 font-medium">現金儲蓄與其他非投資資產 ({sym})</label>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    獨立現金儲備
                  </span>
                </div>
                {(() => {
                  const liveStockVal = Math.max(0, (config.currentNetWorth || 0) - (config.cashSavings || config.baseCashBalance || 0));
                  const currentCashVal = tempConfig.cashSavings ?? (tempConfig.baseCashBalance || 0);

                  return (
                    <>
                      <input
                        type="number"
                        value={currentCashVal}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setTempConfig({
                            ...tempConfig,
                            baseCashBalance: val,
                            cashSavings: val,
                            currentNetWorth: Math.round(val + liveStockVal),
                          });
                        }}
                        className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none font-mono"
                        placeholder="輸入您的活存、定存等備用金"
                      />
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        💡 總資產試算：現金儲備 <span className="text-emerald-400 font-mono">{sym}{formatNumber(currentCashVal)}</span> + 股票市值 <span className="text-cyan-400 font-mono">{sym}{formatNumber(liveStockVal)}</span> = <span className="text-white font-bold font-mono">{sym}{formatNumber(currentCashVal + liveStockVal)}</span>
                      </p>
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="block text-gray-400 mb-1">退休後預期【年】支出 ({sym})</label>
                <input
                  type="number"
                  value={tempConfig.targetAnnualExpensePostRetirement}
                  onChange={(e) => setTempConfig({ ...tempConfig, targetAnnualExpensePostRetirement: Number(e.target.value) })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">預估月收入 ({sym})</label>
                <input
                  type="number"
                  value={tempConfig.monthlyIncome}
                  onChange={(e) => setTempConfig({ ...tempConfig, monthlyIncome: Number(e.target.value) })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">預估月總支出 ({sym})</label>
                <input
                  type="number"
                  value={tempConfig.monthlyExpenses}
                  onChange={(e) => setTempConfig({ ...tempConfig, monthlyExpenses: Number(e.target.value) })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">預估月稅金與規費 ({sym})</label>
                <input
                  type="number"
                  value={tempConfig.monthlyTax}
                  onChange={(e) => setTempConfig({ ...tempConfig, monthlyTax: Number(e.target.value) })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">預期年投資報酬率 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempConfig.expectedInvestmentReturnRate}
                  onChange={(e) => setTempConfig({ ...tempConfig, expectedInvestmentReturnRate: Number(e.target.value) })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">預估年通貨膨脹率 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempConfig.expectedInflationRate}
                  onChange={(e) => setTempConfig({ ...tempConfig, expectedInflationRate: Number(e.target.value) })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">安全提領率 Safe Withdrawal Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempConfig.safeWithdrawalRate}
                  onChange={(e) => setTempConfig({ ...tempConfig, safeWithdrawalRate: Number(e.target.value) })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setIsSimulatorOpen(false)}
                className="px-4 py-2 rounded-xl text-gray-400 hover:text-white text-sm cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveSimulation}
                className="px-5 py-2 text-black font-bold rounded-xl shadow-lg transition cursor-pointer"
                style={{
                  backgroundColor: currentTheme.primaryHex,
                  boxShadow: `0 0 15px rgba(${currentTheme.bgGlowRgb}, 0.3)`,
                }}
              >
                儲存設定並更新倒數
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
