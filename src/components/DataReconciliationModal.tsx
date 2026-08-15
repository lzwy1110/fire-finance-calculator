import React from 'react';
import { Cloud, Smartphone, AlertTriangle, ArrowRight, Check, X, ShieldAlert, Sparkles, Layers } from 'lucide-react';
import { FIREConfig, Transaction, CategoryItem, QuickPreset } from '../types';
import { PortfolioStock } from '../types/portfolio';
import { getThemePreset } from '../utils/theme';

export interface CloudSnapshotData {
  transactions: Transaction[];
  categories: CategoryItem[];
  fireConfig: FIREConfig | null;
  quickPresets: QuickPreset[];
  portfolioStocks: PortfolioStock[];
}

export interface LocalSnapshotData {
  transactions: Transaction[];
  categories: CategoryItem[];
  fireConfig: FIREConfig;
  quickPresets: QuickPreset[];
  portfolioStocks: PortfolioStock[];
}

interface DataReconciliationModalProps {
  isOpen: boolean;
  cloudData: CloudSnapshotData | null;
  localData: LocalSnapshotData;
  themeColor?: string;
  onChooseCloud: () => void;
  onChooseLocal: () => void;
}

export const DataReconciliationModal: React.FC<DataReconciliationModalProps> = ({
  isOpen,
  cloudData,
  localData,
  themeColor = 'cyan',
  onChooseCloud,
  onChooseLocal,
}) => {
  if (!isOpen || !cloudData) return null;

  const currentTheme = getThemePreset(themeColor);
  const sym = localData.fireConfig.currencySymbol || 'NT$';

  const formatNumber = (num: number) => new Intl.NumberFormat('zh-TW').format(num);

  // Local stats
  const localCash = localData.fireConfig.cashSavings ?? (localData.fireConfig.baseCashBalance || 0);
  const localStocks = localData.portfolioStocks || [];
  const localTxCount = (localData.transactions || []).length;
  let localStockValue = 0;
  localStocks.forEach((s) => {
    const rate = s.market === 'US' ? 32.5 : 1;
    localStockValue += (s.shares * (s.currentPrice || 0)) * rate;
  });
  const localTotalNetWorth = Math.round(localCash + localStockValue);

  // Cloud stats
  const cloudCash = cloudData.fireConfig
    ? (cloudData.fireConfig.cashSavings ?? (cloudData.fireConfig.baseCashBalance ?? 0))
    : 0;
  const cloudStocks = cloudData.portfolioStocks || [];
  const cloudTxCount = (cloudData.transactions || []).length;
  let cloudStockValue = 0;
  cloudStocks.forEach((s) => {
    const rate = s.market === 'US' ? 32.5 : 1;
    cloudStockValue += (s.shares * (s.currentPrice || 0)) * rate;
  });
  const cloudTotalNetWorth = Math.round(cloudCash + cloudStockValue);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        className="bg-[#0f0f0f] border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto text-gray-200"
        style={{
          boxShadow: '0 0 40px rgba(245, 158, 11, 0.2)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3.5 border-b border-white/10 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black text-white">
                偵測到雲端與本機數據不一致 (校對確認)
              </h3>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                防誤覆蓋保護
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              系統比對發現本裝置儲存的資料與雲端資料庫存在差異。為防止舊資料誤覆蓋最新雲端紀錄，請選擇您要保留的版本：
            </p>
          </div>
        </div>

        {/* Side-by-Side Comparison Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cloud Version Card (Recommended) */}
          <div className="bg-emerald-950/20 border-2 border-emerald-500/40 rounded-2xl p-4 sm:p-5 relative overflow-hidden space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Cloud className="w-4 h-4" />
                </div>
                <span className="font-bold text-white text-sm">☁️ 雲端版本 (推薦)</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-md">
                最新同步庫
              </span>
            </div>

            <div className="space-y-2 text-xs pt-1 border-t border-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">💵 現金儲備:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {sym} {formatNumber(cloudCash)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">📈 股票庫存:</span>
                <span className="font-mono font-bold text-cyan-400 text-sm">
                  {cloudStocks.length} 檔 ({sym} {formatNumber(Math.round(cloudStockValue))})
                </span>
              </div>

              {cloudStocks.length > 0 ? (
                <div className="text-[11px] text-gray-300 bg-black/40 p-2 rounded-lg border border-white/5 truncate">
                  持股: {cloudStocks.map((s) => `${s.name || s.symbol}`).join('、')}
                </div>
              ) : (
                <div className="text-[11px] text-gray-500 bg-black/40 p-2 rounded-lg border border-white/5">
                  無持股 (已清空)
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-400">📝 記帳明細:</span>
                <span className="font-mono font-bold text-gray-300">
                  {cloudTxCount} 筆
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20">
                <span className="text-gray-300 font-medium">💎 總資產淨值:</span>
                <span className="font-mono font-black text-white text-sm sm:text-base">
                  {sym} {formatNumber(cloudTotalNetWorth)}
                </span>
              </div>
            </div>

            <button
              onClick={onChooseCloud}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs sm:text-sm rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              使用雲端版本 (覆蓋本機)
            </button>
          </div>

          {/* Local Version Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 relative overflow-hidden space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/10 text-gray-300">
                  <Smartphone className="w-4 h-4" />
                </div>
                <span className="font-bold text-white text-sm">📱 本機儲存版本</span>
              </div>
              <span className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded-md">
                此裝置目前
              </span>
            </div>

            <div className="space-y-2 text-xs pt-1 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">💵 現金儲備:</span>
                <span className="font-mono font-bold text-gray-200 text-sm">
                  {sym} {formatNumber(localCash)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">📈 股票庫存:</span>
                <span className="font-mono font-bold text-gray-200 text-sm">
                  {localStocks.length} 檔 ({sym} {formatNumber(Math.round(localStockValue))})
                </span>
              </div>

              {localStocks.length > 0 ? (
                <div className="text-[11px] text-gray-400 bg-black/40 p-2 rounded-lg border border-white/5 truncate">
                  持股: {localStocks.map((s) => `${s.name || s.symbol}`).join('、')}
                </div>
              ) : (
                <div className="text-[11px] text-gray-500 bg-black/40 p-2 rounded-lg border border-white/5">
                  無持股 (已清空)
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-400">📝 記帳明細:</span>
                <span className="font-mono font-bold text-gray-300">
                  {localTxCount} 筆
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-gray-300 font-medium">💎 總資產淨值:</span>
                <span className="font-mono font-black text-white text-sm sm:text-base">
                  {sym} {formatNumber(localTotalNetWorth)}
                </span>
              </div>
            </div>

            <button
              onClick={onChooseLocal}
              className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-gray-200 border border-white/10 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              保留本機版本 (覆蓋雲端)
            </button>
          </div>
        </div>

        {/* Tip */}
        <p className="text-[11px] text-gray-400 text-center bg-black/40 p-2.5 rounded-xl border border-white/5">
          💡 選擇後，兩端將立即同步一致，未來任何修改都將透過 Realtime 毫秒級自動同步。
        </p>
      </div>
    </div>
  );
};
