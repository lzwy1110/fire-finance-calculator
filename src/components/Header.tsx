import React, { useEffect, useState } from 'react';
import { Flame, LayoutDashboard, Calendar, ReceiptText, Cloud, Plus, Settings, TrendingUp, Lock, AlertTriangle } from 'lucide-react';
import { getThemePreset } from '../utils/theme';
import { checkBackendHealth } from '../services/api';
import { isFrontendSupabaseReady } from '../services/supabaseFrontend';

interface HeaderProps {
  activeTab: 'dashboard' | 'monthly' | 'yearly' | 'ledger' | 'analytics' | 'portfolio';
  setActiveTab: (tab: 'dashboard' | 'monthly' | 'yearly' | 'ledger' | 'analytics' | 'portfolio') => void;
  onOpenQuickAdd: () => void;
  onOpenCloudSync: () => void;
  onOpenConfig: () => void;
  isMobileDeviceView?: boolean;
  setIsMobileDeviceView?: React.Dispatch<React.SetStateAction<boolean>>;
  syncCode: string;
  themeColor?: string;
  storageMode?: 'cloud' | 'local';
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenQuickAdd,
  onOpenCloudSync,
  onOpenConfig,
  syncCode,
  themeColor = 'sakura',
  storageMode = 'cloud',
}) => {
  const currentTheme = getThemePreset(themeColor);
  const [dbStatus, setDbStatus] = useState<'connected' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    let mounted = true;
    checkBackendHealth().then((health) => {
      if (!mounted) return;
      if (health && health.supabase?.dbStatus === 'connected') {
        setDbStatus('connected');
      } else {
        setDbStatus('offline');
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/10 px-3.5 lg:px-8 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
        {/* Logo & App Name */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center space-x-2.5 cursor-pointer group" onClick={() => setActiveTab('dashboard')}>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
              style={{
                backgroundColor: currentTheme.primaryHex,
                boxShadow: `0 0 15px rgba(${currentTheme.bgGlowRgb}, 0.5)`,
              }}
            >
              <Flame className="w-4 h-4 text-black animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-base text-white tracking-tight">FIRE Flow</h1>
                <span
                  className="px-1.5 py-0.5 text-[9px] uppercase font-bold rounded-full border tracking-wider"
                  style={{
                    backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.1)`,
                    color: currentTheme.primaryHex,
                    borderColor: `rgba(${currentTheme.bgGlowRgb}, 0.3)`,
                  }}
                >
                  FIRE 退休
                </span>
              </div>
              <p className="text-[11px] text-gray-400 hidden sm:block">美股/台股庫存・財務算表・雲端同步</p>
            </div>
          </div>

          {/* Mobile Right Controls */}
          <div className="flex md:hidden items-center gap-2">
            {/* Mobile Cloud Status Button (Icon Only, Minimalist & Symmetric) */}
            {storageMode === 'cloud' ? (
              !isFrontendSupabaseReady() ? (
                <button
                  onClick={onOpenCloudSync}
                  className="w-8 h-8 flex items-center justify-center bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 transition cursor-pointer active:scale-95"
                  title="未設定 Supabase 雲端 (點擊進行設定)"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </button>
              ) : (
                <button
                  onClick={onOpenCloudSync}
                  className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition cursor-pointer relative active:scale-95"
                  title={`雲端同步中 (同步碼: ${syncCode})`}
                >
                  <div className="relative flex items-center justify-center">
                    <Cloud className="w-4 h-4" style={{ color: currentTheme.primaryHex }} />
                    <span
                      className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-[#0a0a0a] ${
                        dbStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                  </div>
                </button>
              )
            ) : (
              <button
                onClick={onOpenConfig}
                className="w-8 h-8 flex items-center justify-center bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-300 transition cursor-pointer active:scale-95"
                title="純本機模式 (點擊切換)"
              >
                <Lock className="w-4 h-4 text-zinc-400" />
              </button>
            )}

            {/* System Settings Button */}
            <button
              onClick={onOpenConfig}
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-gray-300 rounded-xl transition cursor-pointer active:scale-95"
              title="系統與主題設定"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Unified Desktop Navigation Tabs Bar (Hidden on Mobile) */}
        <nav className="hidden md:flex items-center gap-1 bg-[#111111] p-1.5 px-2 rounded-2xl border border-white/10 overflow-x-auto w-full md:w-auto justify-center scrollbar-none">
          {[
            { id: 'dashboard', label: '儀表板', icon: LayoutDashboard },
            { id: 'portfolio', label: '投資與分析', icon: TrendingUp },
            { id: 'monthly', label: '財務總結', icon: Calendar },
            { id: 'ledger', label: '收支管理', icon: ReceiptText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive =
              activeTab === tab.id ||
              (tab.id === 'portfolio' && activeTab === 'analytics') ||
              (tab.id === 'monthly' && (activeTab === 'monthly' || activeTab === 'yearly'));

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-white/15 border text-white shadow-lg'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
                style={
                  isActive
                    ? {
                        color: currentTheme.primaryHex,
                        borderColor: `rgba(${currentTheme.bgGlowRgb}, 0.5)`,
                        boxShadow: `0 0 10px rgba(${currentTheme.bgGlowRgb}, 0.25)`,
                      }
                    : {}
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions (Desktop) */}
        <div className="hidden md:flex items-center gap-2">
          {/* Quick Add Button */}
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-black font-bold rounded-xl active:scale-95 transition cursor-pointer text-xs"
            style={{
              backgroundColor: currentTheme.primaryHex,
              boxShadow: `0 0 15px rgba(${currentTheme.bgGlowRgb}, 0.35)`,
            }}
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            快速記帳
          </button>

          {/* System Settings & Theme Button */}
          <button
            onClick={onOpenConfig}
            className="p-1.5 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
            title="系統偏好、主題顏色與貨幣設定"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-gray-300">設定</span>
          </button>

          {/* Cloud & Storage Mode Badge */}
          {storageMode === 'cloud' ? (
            !isFrontendSupabaseReady() ? (
              <button
                onClick={onOpenCloudSync}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs font-semibold text-amber-300 transition cursor-pointer"
                title="雲端同步模式：尚未配置 Supabase 憑證 (點擊進行設定)"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>未設定 Supabase</span>
              </button>
            ) : (
              <button
                onClick={onOpenCloudSync}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-mono text-gray-300 transition cursor-pointer"
                title="Supabase 雲端備份與多裝置同步"
              >
                <div className="relative flex items-center justify-center">
                  <Cloud className="w-3.5 h-3.5" style={{ color: currentTheme.primaryHex }} />
                  <span
                    className={`absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full ${
                      dbStatus === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                </div>
                <span className="hidden lg:inline text-gray-400">同步碼:</span>
                <span className="font-bold text-white">{syncCode.slice(0, 9)}</span>
              </button>
            )
          ) : (
            <button
              onClick={onOpenConfig}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-medium text-zinc-300 transition cursor-pointer"
              title="純本機離線保存中 (點擊於設定中切換雲端)"
            >
              <Lock className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-bold text-zinc-300">本機離線</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
