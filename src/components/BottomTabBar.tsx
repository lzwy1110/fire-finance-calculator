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

  const tabs = [
    {
      id: 'dashboard',
      label: '總覽',
      icon: Flame,
      isActive: activeTab === 'dashboard',
      onClick: () => setActiveTab('dashboard'),
    },
    {
      id: 'ledger',
      label: '明細',
      icon: ReceiptText,
      isActive: activeTab === 'ledger',
      onClick: () => setActiveTab('ledger'),
    },
    {
      id: 'portfolio',
      label: '投資',
      icon: TrendingUp,
      isActive: activeTab === 'portfolio',
      onClick: () => setActiveTab('portfolio'),
    },
    {
      id: 'reports',
      label: '報表',
      icon: BarChart3,
      isActive: isReportsTab,
      onClick: () => setActiveTab(isReportsTab ? activeTab : 'analytics'),
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090c]/95 backdrop-blur-2xl border-t border-white/[0.08] px-2 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] shadow-2xl transition-all"
      style={{
        boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.8)',
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around relative h-13">
        {/* Tab 1: Dashboard */}
        <button
          onClick={tabs[0].onClick}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all duration-200 cursor-pointer relative group ${
            tabs[0].isActive ? 'scale-105' : 'opacity-40 hover:opacity-90'
          }`}
        >
          {tabs[0].isActive && (
            <span
              className="absolute -top-1 w-1.5 h-1.5 rounded-full animate-fadeIn"
              style={{
                backgroundColor: currentTheme.primaryHex,
                boxShadow: `0 0 8px ${currentTheme.primaryHex}`,
              }}
            />
          )}
          <Flame
            className={`w-5 h-5 transition-transform ${tabs[0].isActive ? 'stroke-[2.5]' : 'stroke-2'}`}
            style={{
              color: tabs[0].isActive ? currentTheme.primaryHex : '#9ca3af',
            }}
          />
          <span
            className={`text-[10px] tracking-tight mt-0.5 ${
              tabs[0].isActive ? 'text-white font-black' : 'text-gray-400 font-medium'
            }`}
          >
            {tabs[0].label}
          </span>
        </button>

        {/* Tab 2: Ledger */}
        <button
          onClick={tabs[1].onClick}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all duration-200 cursor-pointer relative group ${
            tabs[1].isActive ? 'scale-105' : 'opacity-40 hover:opacity-90'
          }`}
        >
          {tabs[1].isActive && (
            <span
              className="absolute -top-1 w-1.5 h-1.5 rounded-full animate-fadeIn"
              style={{
                backgroundColor: currentTheme.primaryHex,
                boxShadow: `0 0 8px ${currentTheme.primaryHex}`,
              }}
            />
          )}
          <ReceiptText
            className={`w-5 h-5 transition-transform ${tabs[1].isActive ? 'stroke-[2.5]' : 'stroke-2'}`}
            style={{
              color: tabs[1].isActive ? currentTheme.primaryHex : '#9ca3af',
            }}
          />
          <span
            className={`text-[10px] tracking-tight mt-0.5 ${
              tabs[1].isActive ? 'text-white font-black' : 'text-gray-400 font-medium'
            }`}
          >
            {tabs[1].label}
          </span>
        </button>

        {/* Center Jewel FAB: Quick Add */}
        <div className="flex flex-col items-center justify-center px-1 shrink-0 -mt-2">
          <button
            onClick={onOpenAddModal}
            className="w-11 h-11 rounded-full flex items-center justify-center text-black font-black shadow-xl transition-all transform active:scale-90 hover:scale-105 cursor-pointer relative group"
            style={{
              backgroundColor: currentTheme.primaryHex,
              boxShadow: `0 4px 18px rgba(${currentTheme.bgGlowRgb}, 0.55), 0 0 0 3px #09090c`,
            }}
            title="快速記一筆收支"
          >
            <Plus className="w-5 h-5 stroke-[3.5] group-hover:rotate-90 transition-transform duration-200" />
          </button>
          <span className="text-[9.5px] font-black text-gray-300 mt-0.5 tracking-tight">
            記帳
          </span>
        </div>

        {/* Tab 3: Portfolio */}
        <button
          onClick={tabs[2].onClick}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all duration-200 cursor-pointer relative group ${
            tabs[2].isActive ? 'scale-105' : 'opacity-40 hover:opacity-90'
          }`}
        >
          {tabs[2].isActive && (
            <span
              className="absolute -top-1 w-1.5 h-1.5 rounded-full animate-fadeIn"
              style={{
                backgroundColor: currentTheme.primaryHex,
                boxShadow: `0 0 8px ${currentTheme.primaryHex}`,
              }}
            />
          )}
          <TrendingUp
            className={`w-5 h-5 transition-transform ${tabs[2].isActive ? 'stroke-[2.5]' : 'stroke-2'}`}
            style={{
              color: tabs[2].isActive ? currentTheme.primaryHex : '#9ca3af',
            }}
          />
          <span
            className={`text-[10px] tracking-tight mt-0.5 ${
              tabs[2].isActive ? 'text-white font-black' : 'text-gray-400 font-medium'
            }`}
          >
            {tabs[2].label}
          </span>
        </button>

        {/* Tab 4: Reports */}
        <button
          onClick={tabs[3].onClick}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all duration-200 cursor-pointer relative group ${
            tabs[3].isActive ? 'scale-105' : 'opacity-40 hover:opacity-90'
          }`}
        >
          {tabs[3].isActive && (
            <span
              className="absolute -top-1 w-1.5 h-1.5 rounded-full animate-fadeIn"
              style={{
                backgroundColor: currentTheme.primaryHex,
                boxShadow: `0 0 8px ${currentTheme.primaryHex}`,
              }}
            />
          )}
          <BarChart3
            className={`w-5 h-5 transition-transform ${tabs[3].isActive ? 'stroke-[2.5]' : 'stroke-2'}`}
            style={{
              color: tabs[3].isActive ? currentTheme.primaryHex : '#9ca3af',
            }}
          />
          <span
            className={`text-[10px] tracking-tight mt-0.5 ${
              tabs[3].isActive ? 'text-white font-black' : 'text-gray-400 font-medium'
            }`}
          >
            {tabs[3].label}
          </span>
        </button>
      </div>
    </nav>
  );
};
