import { RecurringExpense, RecurringFrequency, Transaction } from '../types';

/**
 * Returns YYYY-MM-DD in local time (preventing UTC offset shifts)
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the maximum days in a given year and month (1-indexed month: 1=Jan, 12=Dec)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Clamps the day to valid range [1, daysInMonth]
 */
export function clampDay(year: number, month: number, day: number): number {
  const maxDays = getDaysInMonth(year, month);
  return Math.min(Math.max(1, day), maxDays);
}

/**
 * Returns month step for a given frequency
 */
export function getFrequencyMonths(frequency: RecurringFrequency): number {
  switch (frequency) {
    case 'monthly':
      return 1;
    case 'bimonthly':
      return 2;
    case 'quarterly':
      return 3;
    case 'semiannual':
      return 6;
    case 'annual':
      return 12;
    default:
      return 1;
  }
}

/**
 * Add specified months to a date string while respecting the target billingDay
 */
export function addMonthsToDate(dateStr: string, monthsToAdd: number, billingDay: number): string {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  const totalMonths = (year * 12 + (month - 1)) + monthsToAdd;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  const newDay = clampDay(newYear, newMonth, billingDay);

  return `${newYear}-${String(newMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;
}

/**
 * Calculate the initial or next deduction date on or after referenceDate
 */
export function calculateNextDeductionDate(
  expense: {
    frequency: RecurringFrequency;
    billingDay: number;
    billingMonth?: number;
  },
  referenceDateStr?: string
): string {
  const refDateStr = referenceDateStr || getLocalDateString();
  const [refYearStr, refMonthStr] = refDateStr.split('-');
  const refYear = parseInt(refYearStr, 10);
  const refMonth = parseInt(refMonthStr, 10);

  if (expense.frequency === 'monthly') {
    const targetDay = clampDay(refYear, refMonth, expense.billingDay);
    const thisMonthDate = `${refYear}-${String(refMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
    if (thisMonthDate >= refDateStr) {
      return thisMonthDate;
    }
    return addMonthsToDate(thisMonthDate, 1, expense.billingDay);
  }

  if (expense.frequency === 'annual') {
    const targetMonth = expense.billingMonth && expense.billingMonth >= 1 && expense.billingMonth <= 12
      ? expense.billingMonth
      : 1;
    const targetDayThisYear = clampDay(refYear, targetMonth, expense.billingDay);
    const thisYearDate = `${refYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDayThisYear).padStart(2, '0')}`;
    if (thisYearDate >= refDateStr) {
      return thisYearDate;
    }
    const targetDayNextYear = clampDay(refYear + 1, targetMonth, expense.billingDay);
    return `${refYear + 1}-${String(targetMonth).padStart(2, '0')}-${String(targetDayNextYear).padStart(2, '0')}`;
  }

  // bimonthly (2), quarterly (3), semiannual (6)
  const interval = getFrequencyMonths(expense.frequency);
  const baseMonth = expense.billingMonth && expense.billingMonth >= 1 && expense.billingMonth <= 12
    ? expense.billingMonth
    : 1;

  let stepMonth = baseMonth;
  while (stepMonth > interval) {
    stepMonth -= interval;
  }

  for (let y = refYear; y <= refYear + 2; y++) {
    for (let m = stepMonth; m <= 12; m += interval) {
      const day = clampDay(y, m, expense.billingDay);
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (dateStr >= refDateStr) {
        return dateStr;
      }
    }
  }

  // Fallback
  return addMonthsToDate(refDateStr, interval, expense.billingDay);
}

export type DeductionStatus = 'due_today' | 'upcoming' | 'passed_this_month' | 'paused';

export interface DeductionStatusInfo {
  status: DeductionStatus;
  daysRemaining: number;
  label: string;
  badgeClass: string;
}

/**
 * Get visual status information for a recurring expense item
 */
export function getDeductionStatus(expense: RecurringExpense, todayStr: string = getLocalDateString()): DeductionStatusInfo {
  if (!expense.isActive) {
    return {
      status: 'paused',
      daysRemaining: -1,
      label: '已暫停',
      badgeClass: 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60',
    };
  }

  if (expense.nextDeductedDate === todayStr) {
    return {
      status: 'due_today',
      daysRemaining: 0,
      label: '⚡ 今日扣款',
      badgeClass: 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse font-medium',
    };
  }

  // Check diff in days
  const today = new Date(todayStr + 'T00:00:00');
  const nextDate = new Date(expense.nextDeductedDate + 'T00:00:00');
  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    if (diffDays === 1) {
      return {
        status: 'upcoming',
        daysRemaining: 1,
        label: '⏳ 明天扣款',
        badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-medium',
      };
    }
    if (diffDays <= 7) {
      return {
        status: 'upcoming',
        daysRemaining: diffDays,
        label: `⏳ 還有 ${diffDays} 天`,
        badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      };
    }
    return {
      status: 'upcoming',
      daysRemaining: diffDays,
      label: `${diffDays} 天後`,
      badgeClass: 'bg-blue-500/15 text-blue-300 border border-blue-500/25',
    };
  }

  // If already deducted in the current calendar month and next is future month
  if (expense.lastDeductedDate && expense.lastDeductedDate.slice(0, 7) === todayStr.slice(0, 7)) {
    return {
      status: 'passed_this_month',
      daysRemaining: 0,
      label: '✔ 本月已扣',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    };
  }

  return {
    status: 'upcoming',
    daysRemaining: Math.max(0, diffDays),
    label: expense.nextDeductedDate,
    badgeClass: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
  };
}

/**
 * Returns human-readable label for frequency
 */
export function getFrequencyLabel(frequency: RecurringFrequency, billingDay: number, billingMonth?: number): string {
  switch (frequency) {
    case 'monthly':
      return `每月 ${billingDay} 日`;
    case 'bimonthly':
      return `每 2 個月 (${billingMonth ? `${billingMonth}月起 ` : ''}${billingDay} 日)`;
    case 'quarterly':
      return `每季 (${billingMonth ? `${billingMonth}月起 ` : ''}${billingDay} 日)`;
    case 'semiannual':
      return `每半年 (${billingMonth ? `${billingMonth}月起 ` : ''}${billingDay} 日)`;
    case 'annual':
      return `每年 ${billingMonth || 1}月${billingDay} 日`;
    default:
      return `每月 ${billingDay} 日`;
  }
}

/**
 * Normalizes any recurring expense to an equivalent monthly burn rate in TWD
 */
export function calculateMonthlyEquivalent(expense: RecurringExpense, usdRate: number = 32.0): number {
  const rate = (expense.currency === 'USD') ? usdRate : 1;
  const twdAmount = expense.amount * rate;

  switch (expense.frequency) {
    case 'monthly':
      return twdAmount;
    case 'bimonthly':
      return twdAmount / 2;
    case 'quarterly':
      return twdAmount / 3;
    case 'semiannual':
      return twdAmount / 6;
    case 'annual':
      return twdAmount / 12;
    default:
      return twdAmount;
  }
}

export interface DeductionResult {
  updatedExpenses: RecurringExpense[];
  newTransactions: Transaction[];
  deductedItems: Array<{
    expense: RecurringExpense;
    transaction: Transaction;
  }>;
  totalDeductedTWD: number;
  totalDeductedUSD: number;
}

/**
 * Idempotent automatic recurring expense processor
 * Checks for due expenses, creates transactions, and updates last/next deduction dates
 */
export function processDueRecurringExpenses(
  expenses: RecurringExpense[],
  todayStr: string = getLocalDateString(),
  usdRate: number = 32.0
): DeductionResult {
  const updatedExpenses: RecurringExpense[] = [];
  const newTransactions: Transaction[] = [];
  const deductedItems: Array<{ expense: RecurringExpense; transaction: Transaction }> = [];
  let totalDeductedTWD = 0;
  let totalDeductedUSD = 0;

  for (const exp of expenses) {
    // Only process active items
    if (!exp.isActive) {
      updatedExpenses.push(exp);
      continue;
    }

    // Check if due today or past due, and NOT already deducted today
    const isDue = exp.nextDeductedDate <= todayStr;
    const notDeductedToday = exp.lastDeductedDate !== todayStr;

    if (isDue && notDeductedToday) {
      const currency = exp.currency || 'TWD';
      const txId = `tx-rec-${exp.id}-${todayStr}-${Math.random().toString(36).slice(2, 7)}`;
      const isUSD = currency === 'USD';
      const ledgerAmount = isUSD ? Math.round(exp.amount * usdRate) : exp.amount;
      const noteDetails = isUSD ? ` ($${exp.amount} USD)` : '';

      const newTx: Transaction = {
        id: txId,
        type: 'expense',
        amount: ledgerAmount,
        currency,
        mainCategory: exp.mainCategory || '生活開銷',
        subCategory: exp.subCategory || '固定扣款',
        date: todayStr,
        note: `[自動扣款] ${exp.name}${noteDetails}${exp.note ? ` - ${exp.note}` : ''}`,
      };

      // Advance nextDeductedDate
      const stepMonths = getFrequencyMonths(exp.frequency);
      let nextDate = addMonthsToDate(exp.nextDeductedDate, stepMonths, exp.billingDay);
      while (nextDate <= todayStr) {
        nextDate = addMonthsToDate(nextDate, stepMonths, exp.billingDay);
      }

      const updatedItem: RecurringExpense = {
        ...exp,
        lastDeductedDate: todayStr,
        nextDeductedDate: nextDate,
      };

      updatedExpenses.push(updatedItem);
      newTransactions.push(newTx);
      deductedItems.push({
        expense: exp,
        transaction: newTx,
      });

      if (isUSD) {
        totalDeductedUSD += exp.amount;
      } else {
        totalDeductedTWD += exp.amount;
      }
    } else {
      updatedExpenses.push(exp);
    }
  }

  return {
    updatedExpenses,
    newTransactions,
    deductedItems,
    totalDeductedTWD,
    totalDeductedUSD,
  };
}
