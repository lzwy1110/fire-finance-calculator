import React from 'react';
import { Flame } from 'lucide-react';
import { getThemePreset } from '../utils/theme';

interface AppLoadingSplashProps {
  themeColor?: string;
  statusMessage?: string;
}

export const AppLoadingSplash: React.FC<AppLoadingSplashProps> = ({
  themeColor = 'sakura',
  statusMessage = '正在連線雲端資料庫並同步資產...',
}) => {
  const currentTheme = getThemePreset(themeColor);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#070708] text-white select-none animate-fadeIn">
      {/* Background Ambient Glow */}
      <div
        className="absolute w-72 h-72 rounded-full blur-[100px] opacity-30 pointer-events-none transition-all duration-1000 animate-pulse"
        style={{
          backgroundColor: currentTheme.primaryHex,
        }}
      />

      {/* Main App Icon Container */}
      <div className="relative flex flex-col items-center">
        {/* Animated Outer Ripple Rings */}
        <div
          className="absolute -inset-4 rounded-[42px] opacity-25 animate-ping duration-1000 pointer-events-none"
          style={{
            backgroundColor: currentTheme.primaryHex,
          }}
        />

        <div
          className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-[34px] flex items-center justify-center shadow-2xl transition-transform duration-700 animate-bounce"
          style={{
            backgroundColor: currentTheme.primaryHex,
            boxShadow: `0 0 50px rgba(${currentTheme.bgGlowRgb}, 0.55), inset 0 2px 6px rgba(255, 255, 255, 0.4)`,
            animationDuration: '2s',
          }}
        >
          {/* Flame Icon with Pulsing Effect */}
          <Flame className="w-12 h-12 sm:w-14 sm:h-14 text-zinc-950 stroke-[2.2] animate-pulse" />
        </div>

        {/* Brand Title */}
        <div className="mt-7 text-center space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-sans">
              FIRE <span style={{ color: currentTheme.primaryHex }}>Flow</span>
            </h1>
            <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
              Cloud
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-medium tracking-wide">
            財務自由與退休進度計算器
          </p>
        </div>

        {/* Dynamic Loading Shimmer Bar & Status */}
        <div className="mt-8 flex flex-col items-center space-y-3 w-56">
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-white/5 relative">
            <div
              className="h-full rounded-full animate-progress"
              style={{
                backgroundColor: currentTheme.primaryHex,
                boxShadow: `0 0 10px rgba(${currentTheme.bgGlowRgb}, 0.8)`,
              }}
            />
          </div>
          <p className="text-[11px] text-zinc-500 font-mono animate-pulse text-center">
            {statusMessage}
          </p>
        </div>
      </div>
    </div>
  );
};
