import React from 'react';
import { Flame, ReceiptText, TrendingUp, BarChart3, Plus } from 'lucide-react';
import { getThemePreset } from '../utils/theme';

export type AppTabType = 'dashboard' | 'monthly' | 'yearly' | 'ledger' | 'analytics' | 'portfolio';

interface BottomTabBarProps {
  activeTab: AppTabType;
  setActiveTab: (tab: AppTabType) => void;
  onOpenAddModal: () => void;
  themeColor?: string;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddModal,
  themeColor = 'sakura',
}) => {
  const currentTheme = getThemePreset(themeColor);

  // Group monthly, yearly, and analytics under "Reports"
  const isReportsTab = activeTab === 'analytics' || activeTab === 'monthly' || activeTab === 'yearly';

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c0c0e]/95 backdrop-blur-xl border-t border-white/10 px-2 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-2xl transition-all"
      style={{
        boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.6)',
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around relative">
        {/* 1. Dashboard (FIRE) */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 cursor-pointer ${
            activeTab === 'dashboard' ? 'scale-105' : 'opacity-60 hover:opacity-100'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'dashboard' ? 'bg-white/10' : ''
            }`}
          >
            <Flame
              className="w-5 h-5 transition-transform"
              style={{
                color: activeTab === 'dashboard' ? currentTheme.primaryHex : '#9ca3af',
              }}
            />
          </div>
          <span
            className={`text-[10px] font-bold tracking-tight mt-0.5 ${
              activeTab === 'dashboard' ? 'text-white' : 'text-gray-400'
            }`}
          >
            總覽
          </span>
        </button>

        {/* 2. Ledger */}
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 cursor-pointer ${
            activeTab === 'ledger' ? 'scale-105' : 'opacity-60 hover:opacity-100'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'ledger' ? 'bg-white/10' : ''
            }`}
          >
            <ReceiptText
              className="w-5 h-5 transition-transform"
              style={{
                color: activeTab === 'ledger' ? currentTheme.primaryHex : '#9ca3af',
              }}
            />
          </div>
          <span
            className={`text-[10px] font-bold tracking-tight mt-0.5 ${
              activeTab === 'ledger' ? 'text-white' : 'text-gray-400'
            }`}
          >
            明細
          </span>
        </button>

        {/* 3. Center Elevated FAB: Quick Add */}
        <div className="relative -top-5 flex flex-col items-center justify-center">
          <button
            onClick={onOpenAddModal}
            className="w-13 h-13 rounded-full flex items-center justify-center text-black font-black shadow-2xl transition-all transform active:scale-90 hover:scale-105 cursor-pointer"
            style={{
              backgroundColor: currentTheme.primaryHex,
              boxShadow: `0 8px 25px rgba(${currentTheme.bgGlowRgb}, 0.6), 0 0 0 4px #0c0c0e`,
            }}
            title="快速記一筆收支"
          >
            <Plus className="w-6 h-6 stroke-[3.5]" />
          </button>
          <span className="text-[10px] font-extrabold text-gray-300 mt-1 tracking-tight">
            記帳
          </span>
        </div>

        {/* 4. Portfolio (Stocks) */}
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 cursor-pointer ${
            activeTab === 'portfolio' ? 'scale-105' : 'opacity-60 hover:opacity-100'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'portfolio' ? 'bg-white/10' : ''
            }`}
          >
            <TrendingUp
              className="w-5 h-5 transition-transform"
              style={{
                color: activeTab === 'portfolio' ? currentTheme.primaryHex : '#9ca3af',
              }}
            />
          </div>
          <span
            className={`text-[10px] font-bold tracking-tight mt-0.5 ${
              activeTab === 'portfolio' ? 'text-white' : 'text-gray-400'
            }`}
          >
            投資
          </span>
        </button>

        {/* 5. Reports (Analytics / Monthly / Yearly) */}
        <button
          onClick={() => setActiveTab(isReportsTab ? activeTab : 'analytics')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 cursor-pointer ${
            isReportsTab ? 'scale-105' : 'opacity-60 hover:opacity-100'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              isReportsTab ? 'bg-white/10' : ''
            }`}
          >
            <BarChart3
              className="w-5 h-5 transition-transform"
              style={{
                color: isReportsTab ? currentTheme.primaryHex : '#9ca3af',
              }}
            />
          </div>
          <span
            className={`text-[10px] font-bold tracking-tight mt-0.5 ${
              isReportsTab ? 'text-white' : 'text-gray-400'
            }`}
          >
            報表
          </span>
        </button>
      </div>
    </nav>
  );
};
