import { CategoryItem, FIREConfig, QuickPreset, Transaction } from '../types';

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  {
    id: 'cat-food',
    name: '飲食',
    type: 'expense',
    icon: 'Utensils',
    color: 'emerald',
    subCategories: ['早餐', '午餐', '晚餐', '宵夜', '點心', '飲料手搖', '生鮮食材', '外送平台'],
  },
  {
    id: 'cat-entertainment',
    name: '娛樂',
    type: 'expense',
    icon: 'Gamepad2',
    color: 'violet',
    subCategories: ['電影影集', '電玩遊戲', '旅遊住宿', '朋友聚會', '串流訂閱', '戶外運動', '演唱會展覽'],
  },
  {
    id: 'cat-daily',
    name: '日用品',
    type: 'expense',
    icon: 'ShoppingBag',
    color: 'cyan',
    subCategories: ['居家衛生', '生活耗材', '小家電', '個人清潔', '廚房用品', '雜貨選品'],
  },
  {
    id: 'cat-housing',
    name: '居住',
    type: 'expense',
    icon: 'Home',
    color: 'amber',
    subCategories: ['房租/房貸', '水電費用', '天然瓦斯', '寬頻網路', '社區管理費', '裝修維修'],
  },
  {
    id: 'cat-transport',
    name: '交通',
    type: 'expense',
    icon: 'Car',
    color: 'blue',
    subCategories: ['機車/汽車加油', '公車捷運', '高鐵台鐵', '計程車/Uber', '停車費/路邊', '保養維修過路'],
  },
  {
    id: 'cat-medical',
    name: '醫療保健',
    type: 'expense',
    icon: 'HeartPulse',
    color: 'rose',
    subCategories: ['門診看診', '西藥/中藥', '保健食品', '健康檢查', '醫療商業保險'],
  },
  {
    id: 'cat-apparel',
    name: '服飾美容',
    type: 'expense',
    icon: 'Shirt',
    color: 'pink',
    subCategories: ['日常服飾', '鞋款包款', '剪髮理髮', '保養品美妝', '美容SPA'],
  },
  {
    id: 'cat-learning',
    name: '教育學習',
    type: 'expense',
    icon: 'GraduationCap',
    color: 'indigo',
    subCategories: ['書籍雜誌', '線上課程', '專業證照', '軟體工具訂閱'],
  },
  {
    id: 'cat-income',
    name: '收入',
    type: 'income',
    icon: 'Wallet',
    color: 'emerald',
    subCategories: ['正職薪資', '專案獎金', '副業接案', '股票股息', '利息收益', '二手販售', '紅包餽贈'],
  },
  {
    id: 'cat-investment',
    name: '投資資產',
    type: 'investment',
    icon: 'TrendingUp',
    color: 'purple',
    subCategories: ['指數型ETF (VOO/0050)', '高股息ETF', '台美股票定期定額', '加密貨幣', '定期存款', '黃金/債券'],
  },
  {
    id: 'cat-tax',
    name: '稅金規費',
    type: 'tax',
    icon: 'Receipt',
    color: 'orange',
    subCategories: ['綜合所得稅', '房屋稅/地價稅', '汽機車牌照稅', '證券交易稅', '二代健保補充保費'],
  },
];

export const DEFAULT_QUICK_PRESETS: QuickPreset[] = [
  { id: 'p1', label: '早餐', mainCategory: '飲食', subCategory: '早餐', amount: 85, icon: 'Coffee' },
  { id: 'p2', label: '便利便當午餐', mainCategory: '飲食', subCategory: '午餐', amount: 130, icon: 'Utensils' },
  { id: 'p3', label: '豐富晚餐', mainCategory: '飲食', subCategory: '晚餐', amount: 180, icon: 'Soup' },
  { id: 'p4', label: '宵夜鹽酥雞', mainCategory: '飲食', subCategory: '宵夜', amount: 120, icon: 'Flame' },
  { id: 'p5', label: '手搖飲料/點心', mainCategory: '飲食', subCategory: '點心', amount: 65, icon: 'CupSoda' },
  { id: 'p6', label: '捷運通勤', mainCategory: '交通', subCategory: '公車捷運', amount: 35, icon: 'Train' },
  { id: 'p7', label: '機車加油', mainCategory: '交通', subCategory: '機車/汽車加油', amount: 150, icon: 'Fuel' },
  { id: 'p8', label: '超市日用品', mainCategory: '日用品', subCategory: '生活耗材', amount: 260, icon: 'ShoppingBag' },
];

export const DEFAULT_FIRE_CONFIG: FIREConfig = {
  currentAge: 30,
  targetRetirementAge: 42,
  currentNetWorth: 3850000, // 3,850,000 NTD current assets
  monthlyIncome: 95000, // 95,000 NTD income
  monthlyExpenses: 32000, // 32,000 NTD expense
  monthlyTax: 4500, // 4,500 NTD tax
  monthlyInvestment: 52000, // 52,000 NTD investment
  targetAnnualExpensePostRetirement: 480000, // 480,000 NTD annual expense post-retirement (40k/month)
  expectedInvestmentReturnRate: 7.2, // 7.2% expected annual return
  expectedInflationRate: 2.2, // 2.2% expected inflation
  safeWithdrawalRate: 4.0, // 4% rule
  currencySymbol: 'NT$',
  themeColor: 'cyan',
};

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // August 2026
  { id: 't-101', type: 'income', amount: 95000, mainCategory: '收入', subCategory: '正職薪資', date: '2026-08-05', note: '8月公司薪資入帳' },
  { id: 't-102', type: 'income', amount: 12000, mainCategory: '收入', subCategory: '股票股息', date: '2026-08-10', note: '0050 季配息入帳' },
  { id: 't-103', type: 'investment', amount: 40000, mainCategory: '投資資產', subCategory: '指數型ETF (VOO/0050)', date: '2026-08-06', note: '定期定額買入 0050' },
  { id: 't-104', type: 'investment', amount: 15000, mainCategory: '投資資產', subCategory: '台美股票定期定額', date: '2026-08-08', note: '美股 VOO 扣款' },
  { id: 't-105', type: 'tax', amount: 4500, mainCategory: '稅金規費', subCategory: '二代健保補充保費', date: '2026-08-05', note: '薪資預扣稅款與補充保費' },
  
  { id: 't-106', type: 'expense', amount: 85, mainCategory: '飲食', subCategory: '早餐', date: '2026-08-10', note: '燕麥拿鐵 + 鮪魚蛋餅', isQuickPreset: true },
  { id: 't-107', type: 'expense', amount: 140, mainCategory: '飲食', subCategory: '午餐', date: '2026-08-10', note: '健康餐盒', isQuickPreset: true },
  { id: 't-108', type: 'expense', amount: 65, mainCategory: '飲食', subCategory: '點心', date: '2026-08-10', note: '無糖綠茶 + 堅果', isQuickPreset: true },
  { id: 't-109', type: 'expense', amount: 220, mainCategory: '飲食', subCategory: '晚餐', date: '2026-08-09', note: '日式拉麵' },
  { id: 't-110', type: 'expense', amount: 130, mainCategory: '飲食', subCategory: '宵夜', date: '2026-08-08', note: '週末宵夜串燒' },
  
  { id: 't-111', type: 'expense', amount: 18000, mainCategory: '居住', subCategory: '房租/房貸', date: '2026-08-01', note: '8月房屋租金' },
  { id: 't-112', type: 'expense', amount: 2150, mainCategory: '居住', subCategory: '水電費用', date: '2026-08-03', note: '夏季台電電費' },
  { id: 't-113', type: 'expense', amount: 699, mainCategory: '居住', subCategory: '寬頻網路', date: '2026-08-02', note: '光世代網路費' },
  
  { id: 't-114', type: 'expense', amount: 390, mainCategory: '娛樂', subCategory: '串流訂閱', date: '2026-08-04', note: 'Netflix & Spotify 家庭方案' },
  { id: 't-115', type: 'expense', amount: 1250, mainCategory: '娛樂', subCategory: '朋友聚會', date: '2026-08-07', note: '週末好友燒肉聚餐' },
  { id: 't-116', type: 'expense', amount: 500, mainCategory: '交通', subCategory: '機車/汽車加油', date: '2026-08-05', note: '95 無鉛汽油加滿' },
  { id: 't-117', type: 'expense', amount: 1280, mainCategory: '交通', subCategory: '公車捷運', date: '2026-08-01', note: 'TPASS 行政院通勤月票' },
  { id: 't-118', type: 'expense', amount: 890, mainCategory: '日用品', subCategory: '生活耗材', date: '2026-08-06', note: '全聯採買衛生紙、洗髮精' },
  
  // July 2026
  { id: 't-201', type: 'income', amount: 95000, mainCategory: '收入', subCategory: '正職薪資', date: '2026-07-05', note: '7月薪資' },
  { id: 't-202', type: 'income', amount: 18000, mainCategory: '收入', subCategory: '副業接案', date: '2026-07-18', note: '網頁設計副業尾款' },
  { id: 't-203', type: 'investment', amount: 50000, mainCategory: '投資資產', subCategory: '指數型ETF (VOO/0050)', date: '2026-07-06', note: '0050/VOO定期扣款' },
  { id: 't-204', type: 'tax', amount: 4500, mainCategory: '稅金規費', subCategory: '二代健保補充保費', date: '2026-07-05' },
  { id: 't-205', type: 'expense', amount: 18000, mainCategory: '居住', subCategory: '房租/房貸', date: '2026-07-01' },
  { id: 't-206', type: 'expense', amount: 9800, mainCategory: '飲食', subCategory: '外送平台', date: '2026-07-15', note: '7月飲食總計月結估算' },
  { id: 't-207', type: 'expense', amount: 3200, mainCategory: '娛樂', subCategory: '旅遊住宿', date: '2026-07-22', note: '宜蘭週末輕旅行民宿' },

  // June 2026
  { id: 't-301', type: 'income', amount: 95000, mainCategory: '收入', subCategory: '正職薪資', date: '2026-06-05' },
  { id: 't-302', type: 'tax', amount: 28000, mainCategory: '稅金規費', subCategory: '綜合所得稅', date: '2026-06-02', note: '114年度綜合所得稅結算申報' },
  { id: 't-303', type: 'investment', amount: 45000, mainCategory: '投資資產', subCategory: '指數型ETF (VOO/0050)', date: '2026-06-06' },
  { id: 't-304', type: 'expense', amount: 18000, mainCategory: '居住', subCategory: '房租/房貸', date: '2026-06-01' },
  { id: 't-305', type: 'expense', amount: 10500, mainCategory: '飲食', subCategory: '午餐', date: '2026-06-15' },
];
