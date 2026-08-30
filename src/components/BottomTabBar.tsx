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
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0c]/90 backdrop-blur-2xl border-t border-white/[0.08] px-3 pt-1 pb-[max(0.2rem,env(safe-area-inset-bottom))] shadow-2xl transition-all"
      style={{
        boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.7)',
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around relative h-12">
        {/* 1. Dashboard (FIRE) */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === 'dashboard' ? 'scale-105' : 'opacity-50 hover:opacity-100'
          }`}
        >
          <Flame
            className="w-4.5 h-4.5 transition-transform"
            style={{
              color: activeTab === 'dashboard' ? currentTheme.primaryHex : '#9ca3af',
            }}
          />
          <span
            className={`text-[9.5px] font-bold tracking-tight mt-0.5 ${
              activeTab === 'dashboard' ? 'text-white font-black' : 'text-gray-400'
            }`}
          >
            總覽
          </span>
        </button>

        {/* 2. Ledger */}
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === 'ledger' ? 'scale-105' : 'opacity-50 hover:opacity-100'
          }`}
        >
          <ReceiptText
            className="w-4.5 h-4.5 transition-transform"
            style={{
              color: activeTab === 'ledger' ? currentTheme.primaryHex : '#9ca3af',
            }}
          />
          <span
            className={`text-[9.5px] font-bold tracking-tight mt-0.5 ${
              activeTab === 'ledger' ? 'text-white font-black' : 'text-gray-400'
            }`}
          >
            明細
          </span>
        </button>

        {/* 3. Center Compact FAB: Quick Add */}
        <div className="flex flex-col items-center justify-center px-1">
          <button
            onClick={onOpenAddModal}
            className="w-9 h-9 rounded-full flex items-center justify-center text-black font-black shadow-lg transition-all transform active:scale-90 hover:scale-105 cursor-pointer -mt-1"
            style={{
              backgroundColor: currentTheme.primaryHex,
              boxShadow: `0 4px 15px rgba(${currentTheme.bgGlowRgb}, 0.5), 0 0 0 2px #0a0a0c`,
            }}
            title="快速記一筆收支"
          >
            <Plus className="w-4.5 h-4.5 stroke-[3.5]" />
          </button>
          <span className="text-[9px] font-extrabold text-gray-400 mt-0.5 tracking-tight">
            記帳
          </span>
        </div>

        {/* 4. Portfolio (Stocks) */}
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === 'portfolio' ? 'scale-105' : 'opacity-50 hover:opacity-100'
          }`}
        >
          <TrendingUp
            className="w-4.5 h-4.5 transition-transform"
            style={{
              color: activeTab === 'portfolio' ? currentTheme.primaryHex : '#9ca3af',
            }}
          />
          <span
            className={`text-[9.5px] font-bold tracking-tight mt-0.5 ${
              activeTab === 'portfolio' ? 'text-white font-black' : 'text-gray-400'
            }`}
          >
            投資
          </span>
        </button>

        {/* 5. Reports (Analytics / Monthly / Yearly) */}
        <button
          onClick={() => setActiveTab(isReportsTab ? activeTab : 'analytics')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-200 cursor-pointer ${
            isReportsTab ? 'scale-105' : 'opacity-50 hover:opacity-100'
          }`}
        >
          <BarChart3
            className="w-4.5 h-4.5 transition-transform"
            style={{
              color: isReportsTab ? currentTheme.primaryHex : '#9ca3af',
            }}
          />
          <span
            className={`text-[9.5px] font-bold tracking-tight mt-0.5 ${
              isReportsTab ? 'text-white font-black' : 'text-gray-400'
            }`}
          >
            報表
          </span>
        </button>
      </div>
    </nav>
  );
};
