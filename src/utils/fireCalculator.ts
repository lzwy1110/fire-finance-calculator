import { FIREConfig, FIREResult, Transaction } from '../types';

/**
 * Calculates FIRE (Financial Independence, Retire Early) metrics
 */
export function calculateFIRE(config: FIREConfig, actualMonthlyStats?: {
  actualAvgIncome: number;
  actualAvgExpense: number;
  actualAvgTax: number;
  actualAvgInvestment: number;
}): FIREResult {
  const currency = config.currencySymbol || 'NT$';

  // Annual retirement expenses
  const annualExpense = config.targetAnnualExpensePostRetirement || (config.monthlyExpenses * 12);
  const swr = (config.safeWithdrawalRate || 4.0) / 100; // e.g. 0.04

  // Target FIRE Number (e.g. $600k / 0.04 = $15,000,000)
  const targetFIREAmount = annualExpense / swr;
  const leanFIREAmount = targetFIREAmount * 0.8; // Lean FIRE (80% expenses)
  const fatFIREAmount = targetFIREAmount * 1.5; // Fat FIRE (150% expenses)

  // Use actual averages if available, otherwise config defaults
  const monthlyIncome = actualMonthlyStats?.actualAvgIncome ?? config.monthlyIncome;
  const monthlyExpense = actualMonthlyStats?.actualAvgExpense ?? config.monthlyExpenses;
  const monthlyTax = actualMonthlyStats?.actualAvgTax ?? config.monthlyTax;
  const monthlyInvestment = actualMonthlyStats?.actualAvgInvestment ?? config.monthlyInvestment;

  // Monthly savings available for accumulation = Income - Expense - Tax
  const netMonthlySavings = Math.max(0, monthlyIncome - monthlyExpense - monthlyTax);
  const totalMonthlyContribution = Math.max(netMonthlySavings, monthlyInvestment);

  const monthlySavingsRate = monthlyIncome > 0
    ? Math.min(100, Math.max(0, ((monthlyIncome - monthlyExpense - monthlyTax) / monthlyIncome) * 100))
    : 0;

  const currentNetWorth = config.currentNetWorth || 0;
  const currentProgressPercent = targetFIREAmount > 0
    ? Math.min(100, (currentNetWorth / targetFIREAmount) * 100)
    : 0;

  // Real Rate of Return = (Nominal Return - Inflation)
  const nominalReturn = (config.expectedInvestmentReturnRate || 6.5) / 100;
  const inflation = (config.expectedInflationRate || 2.5) / 100;
  // Fisher equation or net real rate:
  const realRateOfReturn = (1 + nominalReturn) / (1 + inflation) - 1;
  const rMonthly = realRateOfReturn / 12;

  let monthsToFIRE = 0;
  let simulatedNetWorth = currentNetWorth;

  if (simulatedNetWorth >= targetFIREAmount) {
    monthsToFIRE = 0;
  } else if (totalMonthlyContribution <= 0 && rMonthly <= 0) {
    monthsToFIRE = 999 * 12; // Practically unreachable
  } else {
    // Month-by-month compound accumulation simulation
    const MAX_MONTHS = 100 * 12; // 100 years safety cap
    while (simulatedNetWorth < targetFIREAmount && monthsToFIRE < MAX_MONTHS) {
      simulatedNetWorth = simulatedNetWorth * (1 + rMonthly) + totalMonthlyContribution;
      monthsToFIRE++;
    }
  }

  const yearsToFIRE = Number((monthsToFIRE / 12).toFixed(1));
  const daysToFIRE = Math.round(monthsToFIRE * 30.4375);

  // Projected FIRE date
  const now = new Date();
  const futureDate = new Date(now.valueOf() + daysToFIRE * 24 * 60 * 60 * 1000);
  const estimatedFIRERetirementDate = `${futureDate.getFullYear()}年${futureDate.getMonth() + 1}月${futureDate.getDate()}日`;

  const ageAtFIRE = Math.min(100, Number((config.currentAge + yearsToFIRE).toFixed(1)));
  const monthlyInterestIncomeAtRetirement = Math.round((targetFIREAmount * swr) / 12);

  // Coast FIRE: Amount needed NOW so that with zero future contributions, it grows to target FIRE by targetRetirementAge
  const yearsToRetire = Math.max(0, config.targetRetirementAge - config.currentAge);
  const coastFIREAmount = targetFIREAmount / Math.pow(1 + realRateOfReturn, yearsToRetire);

  return {
    targetFIREAmount: Math.round(targetFIREAmount),
    leanFIREAmount: Math.round(leanFIREAmount),
    fatFIREAmount: Math.round(fatFIREAmount),
    coastFIREAmount: Math.round(coastFIREAmount),
    netMonthlySavings: Math.round(netMonthlySavings),
    monthlySavingsRate: Number(monthlySavingsRate.toFixed(1)),
    currentProgressPercent: Number(currentProgressPercent.toFixed(1)),
    yearsToFIRE,
    daysToFIRE,
    estimatedFIRERetirementDate,
    ageAtFIRE,
    monthlyInterestIncomeAtRetirement,
  };
}

/**
 * Generate projection curve points for charts (Year 0 to Year 30 or FIRE year)
 */
export function generateFIRETrajectoryCurve(config: FIREConfig, years = 25) {
  const annualExpense = config.targetAnnualExpensePostRetirement || (config.monthlyExpenses * 12);
  const swr = (config.safeWithdrawalRate || 4.0) / 100;
  const targetFIREAmount = annualExpense / swr;

  const nominalReturn = (config.expectedInvestmentReturnRate || 6.5) / 100;
  const inflation = (config.expectedInflationRate || 2.5) / 100;
  const realRate = (1 + nominalReturn) / (1 + inflation) - 1;
  const rMonthly = realRate / 12;

  const monthlySavings = Math.max(0, config.monthlyIncome - config.monthlyExpenses - config.monthlyTax);
  const monthlyContribution = Math.max(monthlySavings, config.monthlyInvestment);

  let currentNW = config.currentNetWorth;
  const points = [];

  const currentYear = new Date().getFullYear();

  for (let y = 0; y <= years; y++) {
    points.push({
      yearLabel: `${currentYear + y}年 (${config.currentAge + y}歲)`,
      yearIndex: y,
      netWorth: Math.round(currentNW),
      targetFIRE: Math.round(targetFIREAmount),
      leanFIRE: Math.round(targetFIREAmount * 0.8),
      isAchieved: currentNW >= targetFIREAmount,
    });

    // Advance 12 months
    for (let m = 0; m < 12; m++) {
      currentNW = currentNW * (1 + rMonthly) + monthlyContribution;
    }
  }

  return points;
}

/**
 * Summarize transactions by month or year
 */
export function calculateMonthlyStats(transactions: Transaction[], yearMonth: string) {
  // yearMonth format: "YYYY-MM"
  const filtered = transactions.filter((t) => t.date.startsWith(yearMonth));

  let totalIncome = 0;
  let totalExpense = 0;
  let totalTax = 0;
  let totalInvestment = 0;

  const mainCategoryMap: Record<string, number> = {};
  const subCategoryMap: Record<string, number> = {};

  filtered.forEach((t) => {
    if (t.type === 'income') totalIncome += t.amount;
    if (t.type === 'expense') {
      totalExpense += t.amount;
      mainCategoryMap[t.mainCategory] = (mainCategoryMap[t.mainCategory] || 0) + t.amount;
      const subKey = `${t.mainCategory} > ${t.subCategory}`;
      subCategoryMap[subKey] = (subCategoryMap[subKey] || 0) + t.amount;
    }
    if (t.type === 'tax') totalTax += t.amount;
    if (t.type === 'investment') totalInvestment += t.amount;
  });

  const netSavings = totalIncome - totalExpense - totalTax;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  return {
    yearMonth,
    totalIncome,
    totalExpense,
    totalTax,
    totalInvestment,
    netSavings,
    savingsRate: Number(savingsRate.toFixed(1)),
    mainCategoryMap,
    subCategoryMap,
    count: filtered.length,
  };
}

export function calculateYearlyStats(transactions: Transaction[], year: string) {
  // year format: "YYYY"
  const filtered = transactions.filter((t) => t.date.startsWith(year));

  let totalIncome = 0;
  let totalExpense = 0;
  let totalTax = 0;
  let totalInvestment = 0;

  const monthlyBreakdown: Array<{
    month: string;
    income: number;
    expense: number;
    tax: number;
    investment: number;
    netSavings: number;
  }> = [];

  for (let m = 1; m <= 12; m++) {
    const monthStr = `${year}-${String(m).padStart(2, '0')}`;
    const mStats = calculateMonthlyStats(transactions, monthStr);
    totalIncome += mStats.totalIncome;
    totalExpense += mStats.totalExpense;
    totalTax += mStats.totalTax;
    totalInvestment += mStats.totalInvestment;

    monthlyBreakdown.push({
      month: `${m}月`,
      income: mStats.totalIncome,
      expense: mStats.totalExpense,
      tax: mStats.totalTax,
      investment: mStats.totalInvestment,
      netSavings: mStats.netSavings,
    });
  }

  const netSavings = totalIncome - totalExpense - totalTax;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  return {
    year,
    totalIncome,
    totalExpense,
    totalTax,
    totalInvestment,
    netSavings,
    savingsRate: Number(savingsRate.toFixed(1)),
    monthlyBreakdown,
    count: filtered.length,
  };
}
