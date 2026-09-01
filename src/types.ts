import { PortfolioStock } from './types/portfolio';

export type TransactionType = 'income' | 'expense' | 'investment' | 'tax';

export interface CategoryItem {
  id: string;
  name: string;
  type: TransactionType;
  icon: string; // Lucide icon name
  color: string;
  subCategories: string[];
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  mainCategory: string;
  subCategory: string;
  date: string; // YYYY-MM-DD
  note?: string;
  tags?: string[];
  isQuickPreset?: boolean;
}

export interface TaxItem {
  id: string;
  name: string;
  month: number; // 1-12
  amount: number;
  isPaid: boolean;
  paidDate?: string; // YYYY-MM-DD
  transactionId?: string; // Linked ledger transaction ID
  category?: 'vehicle' | 'income' | 'housing' | 'custom';
  note?: string;
}

export type FIREType = 'lean' | 'standard' | 'fat' | 'coast';

export interface FIREConfig {
  currentAge: number;
  targetRetirementAge: number;
  currentNetWorth: number; // 現有總資產 = 股票庫存市值 + 現金儲蓄 (NTD / USD)
  cashSavings?: number; // 即時計算之非投資淨資產 (向後相容/台幣總現金)
  cashSavingsTWD?: number; // 🇹🇼 台幣現金儲備
  cashSavingsUSD?: number; // 🇺🇸 美元現金儲備
  usdRate?: number; // 系統 USD/TWD 匯率快取 (例如 32.0)
  baseCashBalance?: number; // 使用者手動設定之非投資現金儲備基準 (活存/定存/備用金)
  monthlyIncome: number; // 預估月收入
  monthlyExpenses: number; // 預估月支出
  monthlyTax: number; // 預估月稅務扣除 (由年度稅金平攤或手動設定)
  monthlyInvestment: number; // 月投資金額
  targetAnnualExpensePostRetirement: number; // 退休後預期年支出
  expectedInvestmentReturnRate: number; // 預期年化報酬率 % (e.g., 7%)
  expectedInflationRate: number; // 預期年通膨率 % (e.g., 2.5%)
  safeWithdrawalRate: number; // 安全提領率 % (e.g., 4%)
  currencySymbol: string; // e.g. "NT$" or "$"
  themeColor?: string; // Theme preset id ('cyan' | 'sakura' | 'emerald' | 'amber' | 'violet' | 'rose') or custom hex color
  annualTaxes?: TaxItem[]; // 年度稅務待辦清單
  twStockFeeDiscount?: number; // 🇹🇼 台股電子下單手續費折數 (預設 0.28 即 2.8 折，0.1425% * discount)
  usStockFee?: number; // 🇺🇸 美股每筆交易手續費 (預設 0)
}

export interface QuickPreset {
  id: string;
  label: string;
  mainCategory: string;
  subCategory: string;
  amount: number;
  icon?: string;
}

export interface FIREResult {
  targetFIREAmount: number; // 總需 FIRE 目標金額 (4% rule = 年支出 * 25)
  leanFIREAmount: number; // 80% 基礎生活 FIRE
  fatFIREAmount: number; // 150% 寬裕 FIRE
  coastFIREAmount: number; // Coast FIRE
  netMonthlySavings: number; // 月淨儲蓄 (收入 - 支出 - 稅金)
  monthlySavingsRate: number; // 淨儲蓄率 %
  currentProgressPercent: number; // 目前資產佔 FIRE 目標 %
  yearsToFIRE: number; // 預估達到 FIRE 尚需年數
  daysToFIRE: number; // 預估達到 FIRE 尚需天數
  estimatedFIRERetirementDate: string; // 預計退休日期 YYYY-MM-DD
  ageAtFIRE: number; // 退休時年齡
  monthlyInterestIncomeAtRetirement: number; // 退休後每月提領被動收入
}

export interface CloudBackupData {
  version: string;
  lastSyncedAt: string;
  syncCode: string;
  transactions: Transaction[];
  categories: CategoryItem[];
  fireConfig: FIREConfig;
  quickPresets: QuickPreset[];
  portfolioStocks?: PortfolioStock[];
}

export * from './types/portfolio';
