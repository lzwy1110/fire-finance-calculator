import React, { useState, useEffect } from 'react';
import { X, Settings } from 'lucide-react';

export interface StockFeeSettingsModalProps {
  isOpen: boolean;
  initialTwFeeRate: number;
  initialUsFeeRate: number;
  themePrimaryHex: string;
  onSave: (twRate: number, usRate: number) => void;
  onClose: () => void;
}

export const StockFeeSettingsModal: React.FC<StockFeeSettingsModalProps> = ({
  isOpen,
  initialTwFeeRate,
  initialUsFeeRate,
  themePrimaryHex,
  onSave,
  onClose,
}) => {
  const [twDefaultFeeRate, setTwDefaultFeeRate] = useState<string>(() => String(initialTwFeeRate ?? 0.0399));
  const [usDefaultFeeRate, setUsDefaultFeeRate] = useState<string>(() => String(initialUsFeeRate ?? 0));

  useEffect(() => {
    if (isOpen) {
      setTwDefaultFeeRate(String(initialTwFeeRate ?? 0.0399));
      setUsDefaultFeeRate(String(initialUsFeeRate ?? 0));
    }
  }, [isOpen, initialTwFeeRate, initialUsFeeRate]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const twRate = parseFloat(twDefaultFeeRate) || 0;
    const usRate = parseFloat(usDefaultFeeRate) || 0;
    onSave(twRate, usRate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0e0e0e] border border-white/10 w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl text-gray-200 relative max-h-[85vh] flex flex-col animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">證券交易手續費率設定 (%)</h3>
              <p className="text-xs text-gray-400">設定買賣股票時預設自動帶入的手續費率</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* TW Stock Fee Rate Input */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-white flex items-center gap-1.5">
                <span>🇹🇼 台股交易手續費率 (%)</span>
              </label>
              <span className="text-[10px] text-gray-400 font-mono">公定全額為 0.1425%</span>
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.0399"
                value={twDefaultFeeRate}
                onChange={(e) => setTwDefaultFeeRate(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">%</span>
            </div>

            {/* Quick Selection Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-gray-400">快速填入:</span>
              {[
                { label: '0.0399% (2.8折)', val: '0.0399' },
                { label: '0.0713% (5折)', val: '0.0713' },
                { label: '0.0855% (6折)', val: '0.0855' },
                { label: '0.1425% (全額)', val: '0.1425' },
                { label: '0% (免手續費)', val: '0' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setTwDefaultFeeRate(item.val)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition cursor-pointer ${
                    twDefaultFeeRate === item.val
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50'
                      : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-emerald-400/80">
              💡 賣出台股時，系統將自動依標的性質外加「證交稅」(個股 0.3% / ETF 0.1%)
            </p>
          </div>

          {/* US Stock Fee Rate Input */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-white flex items-center gap-1.5">
                <span>🇺🇸 美股交易手續費率 (%)</span>
              </label>
              <span className="text-[10px] text-gray-400 font-mono">美股券商多數免佣 (0%)</span>
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={usDefaultFeeRate}
                onChange={(e) => setUsDefaultFeeRate(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">%</span>
            </div>

            {/* Quick Selection Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-gray-400">快速填入:</span>
              {[
                { label: '0% (免佣金)', val: '0' },
                { label: '0.08%', val: '0.08' },
                { label: '0.1%', val: '0.1' },
                { label: '0.15%', val: '0.15' },
                { label: '0.2%', val: '0.2' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setUsDefaultFeeRate(item.val)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition cursor-pointer ${
                    usDefaultFeeRate === item.val
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50'
                      : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold cursor-pointer text-xs"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-black rounded-xl text-black shadow-lg cursor-pointer text-xs transition active:scale-95"
              style={{ backgroundColor: themePrimaryHex }}
            >
              儲存費率設定
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
