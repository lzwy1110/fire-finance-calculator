import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, X, DollarSign, ArrowRight, ShieldCheck, Sparkles, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { getThemePreset } from '../utils/theme';

interface CurrencyExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashSavingsTWD: number;
  cashSavingsUSD: number;
  systemUsdRate: number;
  themeColor?: string;
  onExchange: (params: {
    fromCurrency: 'TWD' | 'USD';
    toCurrency: 'TWD' | 'USD';
    fromAmount: number;
    toAmount: number;
    feeTWD?: number;
  }) => void;
}

export const CurrencyExchangeModal: React.FC<CurrencyExchangeModalProps> = ({
  isOpen,
  onClose,
  cashSavingsTWD,
  cashSavingsUSD,
  systemUsdRate,
  themeColor = 'sakura',
  onExchange,
}) => {
  if (!isOpen) return null;

  const currentTheme = getThemePreset(themeColor);
  const [direction, setDirection] = useState<'TWD_TO_USD' | 'USD_TO_TWD'>('TWD_TO_USD');
  const [rate, setRate] = useState<number>(systemUsdRate || 32.0);
  const [isCustomRate, setIsCustomRate] = useState(false);
  const [fromInput, setFromInput] = useState<string>('');
  const [feeInput, setFeeInput] = useState<string>('0');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (systemUsdRate && !isCustomRate) {
      setRate(systemUsdRate);
    }
  }, [systemUsdRate, isCustomRate]);

  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(num);

  const fromCurrency = direction === 'TWD_TO_USD' ? 'TWD' : 'USD';
  const toCurrency = direction === 'TWD_TO_USD' ? 'USD' : 'TWD';

  const maxAvailable = direction === 'TWD_TO_USD' ? cashSavingsTWD : cashSavingsUSD;

  // Calculate destination amount
  const parsedFrom = parseFloat(fromInput) || 0;
  const parsedFee = parseFloat(feeInput) || 0;

  let calculatedTo = 0;
  if (direction === 'TWD_TO_USD') {
    calculatedTo = rate > 0 ? Number((parsedFrom / rate).toFixed(2)) : 0;
  } else {
    calculatedTo = Number((parsedFrom * rate).toFixed(0));
  }

  // Simulated After Balances
  let afterTWD = cashSavingsTWD;
  let afterUSD = cashSavingsUSD;

  if (direction === 'TWD_TO_USD') {
    afterTWD = Math.max(0, cashSavingsTWD - parsedFrom - parsedFee);
    afterUSD = Number((cashSavingsUSD + calculatedTo).toFixed(2));
  } else {
    afterUSD = Math.max(0, Number((cashSavingsUSD - parsedFrom).toFixed(2)));
    afterTWD = Math.max(0, cashSavingsTWD + calculatedTo - parsedFee);
  }

  const handleToggleDirection = () => {
    setDirection((prev) => (prev === 'TWD_TO_USD' ? 'USD_TO_TWD' : 'TWD_TO_USD'));
    setFromInput('');
    setErrorMsg('');
  };

  const handleSetPercent = (pct: number) => {
    if (maxAvailable <= 0) return;
    const val = (maxAvailable * pct);
    if (direction === 'TWD_TO_USD') {
      setFromInput(Math.floor(val).toString());
    } else {
      setFromInput(Number(val.toFixed(2)).toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedFrom <= 0) {
      setErrorMsg('請輸入大於 0 的換匯金額！');
      return;
    }

    if (direction === 'TWD_TO_USD' && parsedFrom + parsedFee > cashSavingsTWD) {
      setErrorMsg(`台幣現金餘額不足！目前可用: NT$ ${formatNum(cashSavingsTWD)}`);
      return;
    }

    if (direction === 'USD_TO_TWD' && parsedFrom > cashSavingsUSD) {
      setErrorMsg(`美金現金餘額不足！目前可用: $${formatNum(cashSavingsUSD)} USD`);
      return;
    }

    onExchange({
      fromCurrency,
      toCurrency,
      fromAmount: parsedFrom,
      toAmount: calculatedTo,
      feeTWD: parsedFee,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="bg-[#0e0e0e] border-t sm:border border-white/10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl overflow-y-auto max-h-[92vh] text-gray-200 animate-slideUp sm:animate-none"
        style={{
          boxShadow: `0 0 35px rgba(${currentTheme.bgGlowRgb}, 0.2)`,
        }}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto sm:hidden mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold"
              style={{ backgroundColor: currentTheme.primaryHex, color: '#000' }}
            >
              <ArrowRightLeft className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                💱 雙幣現金池換匯轉帳
              </h3>
              <p className="text-xs text-gray-400">
                台幣與美金現金資產池互轉・總資產精確平衡不失真
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rate Badge */}
          <div className="bg-black/50 border border-white/5 p-3.5 rounded-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">目前匯率:</span>
              <span className="text-xs font-mono font-bold text-amber-300">
                1 USD = {rate.toFixed(2)} TWD
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsCustomRate(!isCustomRate)}
              className="text-[11px] text-gray-400 hover:text-white underline transition cursor-pointer"
            >
              {isCustomRate ? '收起微調' : '自訂成交匯率'}
            </button>
          </div>

          {/* Custom Rate Input */}
          {isCustomRate && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 animate-fadeIn">
              <label className="text-xs text-amber-300 font-semibold block">自訂成交匯率 (USD/TWD):</label>
              <input
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value) || systemUsdRate)}
                className="w-full bg-black/80 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none"
              />
            </div>
          )}

          {/* Transfer Flow Box */}
          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-3 relative">
            {/* From Row */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-300">
                  {direction === 'TWD_TO_USD' ? '🇹🇼 轉出台幣現金 (From TWD)' : '🇺🇸 轉出美金現金 (From USD)'}
                </span>
                <span className="text-[11px] text-gray-400 font-mono">
                  可用: {direction === 'TWD_TO_USD' ? `NT$ ${formatNum(cashSavingsTWD)}` : `$${formatNum(cashSavingsUSD)} USD`}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-gray-500 font-bold text-sm">
                  {direction === 'TWD_TO_USD' ? 'NT$' : '$'}
                </span>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0"
                  value={fromInput}
                  onChange={(e) => {
                    setFromInput(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-12 pr-4 py-2 text-base font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Quick Percent Buttons */}
              <div className="flex gap-1.5 mt-2">
                {[0.25, 0.5, 0.75, 1].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleSetPercent(pct)}
                    className="flex-1 py-1 text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/5 transition cursor-pointer"
                  >
                    {pct === 1 ? '全部 (100%)' : `${pct * 100}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Middle Direction Swap Button */}
            <div className="flex items-center justify-center my-1">
              <button
                type="button"
                onClick={handleToggleDirection}
                className="p-2 rounded-full border border-white/10 bg-black/80 hover:bg-white/10 text-cyan-400 shadow-md transition cursor-pointer flex items-center gap-1.5 text-xs font-bold px-3"
                title="切換換匯方向"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>切換方向 ({direction === 'TWD_TO_USD' ? 'TWD ➔ USD' : 'USD ➔ TWD'})</span>
              </button>
            </div>

            {/* To Row */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-300">
                  {direction === 'TWD_TO_USD' ? '🇺🇸 預計獲得美金 (To USD)' : '🇹🇼 預計獲得台幣 (To TWD)'}
                </span>
                <span className="text-[11px] text-gray-400 font-mono">
                  現有: {direction === 'TWD_TO_USD' ? `$${formatNum(cashSavingsUSD)} USD` : `NT$ ${formatNum(cashSavingsTWD)}`}
                </span>
              </div>
              <div className="bg-black/80 border border-white/10 rounded-xl px-4 py-2 text-base font-mono font-extrabold flex items-center justify-between" style={{ color: currentTheme.primaryHex }}>
                <span>{direction === 'TWD_TO_USD' ? '$' : 'NT$'}</span>
                <span>{formatNum(calculatedTo)}</span>
              </div>
            </div>

            {/* Optional Fee */}
            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-400">換匯手續費 / 電匯手續費 (選填 NT$):</label>
                <span className="text-[10px] text-gray-500 font-mono">一般線上換匯免填</span>
              </div>
              <input
                type="number"
                step="any"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1 text-xs font-mono text-gray-300 focus:outline-none"
                placeholder="0"
              />
            </div>
          </div>

          {/* Balance Preview Card */}
          <div className="bg-black/40 border border-white/5 p-3.5 rounded-2xl space-y-2 text-xs">
            <span className="text-[11px] font-bold text-gray-400 block border-b border-white/5 pb-1">
              📊 換匯後資產池預覽：
            </span>
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div>
                <span className="text-gray-500 block text-[10px]">🇹🇼 台幣現金:</span>
                <div className="flex items-center gap-1 font-bold text-gray-200">
                  <span>NT$ {formatNum(cashSavingsTWD)}</span>
                  <span className="text-gray-600">➔</span>
                  <span className={direction === 'TWD_TO_USD' ? 'text-amber-400' : 'text-emerald-400'}>
                    NT$ {formatNum(afterTWD)}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">🇺🇸 美金現金:</span>
                <div className="flex items-center gap-1 font-bold text-gray-200">
                  <span>${formatNum(cashSavingsUSD)}</span>
                  <span className="text-gray-600">➔</span>
                  <span className={direction === 'TWD_TO_USD' ? 'text-emerald-400' : 'text-amber-400'}>
                    ${formatNum(afterUSD)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer Submit */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={parsedFrom <= 0}
              className="flex-1 py-2.5 font-bold text-xs rounded-xl shadow-lg transition cursor-pointer disabled:opacity-40"
              style={{
                backgroundColor: currentTheme.primaryHex,
                color: '#000',
              }}
            >
              確認執行換匯
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
