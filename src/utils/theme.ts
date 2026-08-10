export interface ThemePreset {
  id: string;
  name: string;
  colorName: string;
  primaryHex: string;
  primaryHoverHex: string;
  bgGlowRgb: string; // for rgba(r,g,b, 0.3)
  textClass: string;
  bgClass: string;
  borderClass: string;
  ringClass: string;
  btnBgClass: string;
  btnHoverClass: string;
  shadowClass: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'sakura',
    name: '淡櫻花粉',
    colorName: 'Sakura Pink',
    primaryHex: '#f472b6',
    primaryHoverHex: '#f687b3',
    bgGlowRgb: '244, 114, 182',
    textClass: 'text-pink-400',
    bgClass: 'bg-pink-500/10',
    borderClass: 'border-pink-500/30',
    ringClass: 'ring-pink-500/30',
    btnBgClass: 'bg-pink-400 text-black',
    btnHoverClass: 'hover:bg-pink-300',
    shadowClass: 'shadow-[0_0_15px_rgba(244,114,182,0.4)]',
  },
  {
    id: 'cyan',
    name: '賽博青藍',
    colorName: 'Cyan',
    primaryHex: '#06b6d4',
    primaryHoverHex: '#22d3ee',
    bgGlowRgb: '6, 182, 212',
    textClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/30',
    ringClass: 'ring-cyan-500/30',
    btnBgClass: 'bg-cyan-500 text-black',
    btnHoverClass: 'hover:bg-cyan-400',
    shadowClass: 'shadow-[0_0_15px_rgba(6,182,212,0.4)]',
  },
  {
    id: 'emerald',
    name: '極光翡翠',
    colorName: 'Aurora Emerald',
    primaryHex: '#10b981',
    primaryHoverHex: '#34d399',
    bgGlowRgb: '16, 185, 129',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    ringClass: 'ring-emerald-500/30',
    btnBgClass: 'bg-emerald-500 text-black',
    btnHoverClass: 'hover:bg-emerald-400',
    shadowClass: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]',
  },
  {
    id: 'amber',
    name: '日落琥珀',
    colorName: 'Sunset Amber',
    primaryHex: '#f59e0b',
    primaryHoverHex: '#fbbf24',
    bgGlowRgb: '245, 158, 11',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    ringClass: 'ring-amber-500/30',
    btnBgClass: 'bg-amber-400 text-black',
    btnHoverClass: 'hover:bg-amber-300',
    shadowClass: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',
  },
  {
    id: 'violet',
    name: '高雅紫羅蘭',
    colorName: 'Violet Bloom',
    primaryHex: '#a855f7',
    primaryHoverHex: '#c084fc',
    bgGlowRgb: '168, 85, 247',
    textClass: 'text-purple-400',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    ringClass: 'ring-purple-500/30',
    btnBgClass: 'bg-purple-500 text-black',
    btnHoverClass: 'hover:bg-purple-400',
    shadowClass: 'shadow-[0_0_15px_rgba(168,85,247,0.4)]',
  },
  {
    id: 'rose',
    name: '焰火玫瑰',
    colorName: 'Vibrant Rose',
    primaryHex: '#f43f5e',
    primaryHoverHex: '#fb7185',
    bgGlowRgb: '244, 63, 94',
    textClass: 'text-rose-400',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30',
    ringClass: 'ring-rose-500/30',
    btnBgClass: 'bg-rose-500 text-black',
    btnHoverClass: 'hover:bg-rose-400',
    shadowClass: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]',
  },
];

export const CURRENCY_OPTIONS = [
  { symbol: 'NT$', label: 'NT$ - 新台幣 (TWD)' },
  { symbol: 'HK$', label: 'HK$ - 港幣 (HKD)' },
  { symbol: 'US$', label: 'US$ - 美元 (USD)' },
  { symbol: '¥', label: '¥ - 日圓 / 人民幣 (JPY / RMB)' },
  { symbol: '€', label: '€ - 歐元 (EUR)' },
  { symbol: '₩', label: '₩ - 韓元 (KRW)' },
  { symbol: '£', label: '£ - 英鎊 (GBP)' },
  { symbol: 'S$', label: 'S$ - 新加坡幣 (SGD)' },
  { symbol: 'A$', label: 'A$ - 澳幣 (AUD)' },
  { symbol: 'CA$', label: 'CA$ - 加幣 (CAD)' },
  { symbol: 'RM', label: 'RM - 馬來西亞令吉 (MYR)' },
  { symbol: '฿', label: '฿ - 泰銖 (THB)' },
];

export function getThemePreset(themeIdOrHex?: string): ThemePreset {
  if (!themeIdOrHex) return THEME_PRESETS[0];

  const matched = THEME_PRESETS.find((p) => p.id === themeIdOrHex.toLowerCase());
  if (matched) return matched;

  // Custom Hex theme fallback
  if (themeIdOrHex.startsWith('#')) {
    return {
      id: 'custom',
      name: '自訂色彩',
      colorName: 'Custom Color',
      primaryHex: themeIdOrHex,
      primaryHoverHex: themeIdOrHex,
      bgGlowRgb: '244, 114, 182',
      textClass: 'text-pink-400',
      bgClass: 'bg-pink-500/10',
      borderClass: 'border-pink-500/30',
      ringClass: 'ring-pink-500/30',
      btnBgClass: 'bg-pink-400 text-black',
      btnHoverClass: 'hover:bg-pink-300',
      shadowClass: 'shadow-[0_0_15px_rgba(244,114,182,0.4)]',
    };
  }

  return THEME_PRESETS[0];
}

export function applyThemeToCSSVariables(themeKey?: string) {
  const preset = getThemePreset(themeKey);
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', preset.primaryHex);
  root.style.setProperty('--theme-glow-rgb', preset.bgGlowRgb);
}
