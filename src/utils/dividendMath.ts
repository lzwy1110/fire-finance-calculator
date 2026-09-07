import {
  PortfolioStock,
  FIREConfig,
  MarketType,
  DividendCalendarItem,
  DividendMonthlyBucket,
  DividendRecoveryInfo,
  DividendCalendarSummary,
} from '../types';

/**
 * Calculate 12-Month Dividend Calendar & FIRE Passive Income Projection
 */
export function calculateDividendCalendar(
  stocks: PortfolioStock[],
  year: number,
  usdRate: number = 32.0,
  fireConfig?: Partial<FIREConfig>,
  marketFilter: 'ALL' | 'US' | 'TW' = 'ALL'
): DividendCalendarSummary {
  const yearStr = String(year);
  const items: DividendCalendarItem[] = [];

  // 1. Initialize 12 empty monthly buckets
  const monthlyBuckets: DividendMonthlyBucket[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      month: m,
      monthLabel: `${m}月`,
      confirmedTWD: 0,
      declaredTWD: 0,
      totalTWD: 0,
      items: [],
    };
  });

  // Track recorded dividends to prevent double counting with pending/declared dividends
  const recordedDividendKeys = new Set<string>();

  // 2. Aggregate Confirmed Dividends from Stock Transactions
  for (const stock of stocks) {
    if (marketFilter !== 'ALL' && stock.market !== marketFilter) continue;

    if (Array.isArray(stock.transactions)) {
      for (const tx of stock.transactions) {
        if (tx.type === 'DIVIDEND' && tx.date && tx.date.startsWith(yearStr)) {
          const month = parseInt(tx.date.slice(5, 7), 10);
          if (isNaN(month) || month < 1 || month > 12) continue;

          const shares = tx.shares || stock.shares || 0;
          const perShare = tx.dividendPerShare || tx.price || 0;
          const grossAmount = perShare * shares;
          const taxWithheld = tx.taxWithheld || 0;

          // Net cash in native currency
          let netNative = typeof tx.dividendTotalCash === 'number' && tx.dividendTotalCash > 0
            ? tx.dividendTotalCash
            : Math.max(0, grossAmount - taxWithheld);

          // Net cash in TWD
          const isUSD = stock.currency === 'USD' || stock.market === 'US';
          const netTWD = isUSD ? Math.round(netNative * usdRate) : Math.round(netNative);

          const item: DividendCalendarItem = {
            id: `tx-div-${tx.id}`,
            stockId: stock.id,
            symbol: stock.symbol,
            name: stock.name,
            market: stock.market,
            currency: stock.currency,
            exDate: tx.date,
            paymentDate: tx.date,
            amountPerShare: perShare,
            shares,
            grossAmount,
            taxWithheld,
            netAmount: netNative,
            netAmountTWD: netTWD,
            status: 'confirmed',
            transactionId: tx.id,
          };

          items.push(item);
          monthlyBuckets[month - 1].confirmedTWD += netTWD;
          monthlyBuckets[month - 1].totalTWD += netTWD;
          monthlyBuckets[month - 1].items.push(item);

          recordedDividendKeys.add(`${stock.symbol}_${tx.date}`);
        }
      }
    }
  }

  // 3. Aggregate Declared / Upcoming Dividends from Active Holdings
  for (const stock of stocks) {
    if (stock.shares <= 0) continue;
    if (marketFilter !== 'ALL' && stock.market !== marketFilter) continue;

    if (stock.pendingDividend && stock.pendingDividend.date) {
      const pDiv = stock.pendingDividend;
      const exDate = pDiv.date;
      const paymentDate = pDiv.paymentDate || exDate;

      // Check if event belongs to selected year
      const dateToCheck = paymentDate || exDate;
      if (dateToCheck.startsWith(yearStr)) {
        // Skip if user already recorded transaction for this exact date
        if (recordedDividendKeys.has(`${stock.symbol}_${exDate}`)) {
          continue;
        }

        const month = parseInt(dateToCheck.slice(5, 7), 10);
        if (isNaN(month) || month < 1 || month > 12) continue;

        const shares = stock.shares;
        const perShare = pDiv.amount || 0;
        const grossAmount = perShare * shares;
        const isUSD = stock.currency === 'USD' || stock.market === 'US';

        // Tax calculation: US 30% withholding, TW 2.11% NHI if >= 20,000
        let taxWithheld = 0;
        if (isUSD) {
          taxWithheld = Math.round(grossAmount * 0.30 * 100) / 100;
        } else {
          if (grossAmount >= 20000) {
            taxWithheld = Math.round(Math.min(grossAmount, 10000000) * 0.0211);
          }
        }

        const netNative = Math.max(0, grossAmount - taxWithheld);
        const netTWD = isUSD ? Math.round(netNative * usdRate) : Math.round(netNative);

        const item: DividendCalendarItem = {
          id: `pending-div-${stock.id}-${exDate}`,
          stockId: stock.id,
          symbol: stock.symbol,
          name: stock.name,
          market: stock.market,
          currency: stock.currency,
          exDate,
          paymentDate,
          amountPerShare: perShare,
          shares,
          grossAmount,
          taxWithheld,
          netAmount: netNative,
          netAmountTWD: netTWD,
          status: 'declared',
        };

        items.push(item);
        monthlyBuckets[month - 1].declaredTWD += netTWD;
        monthlyBuckets[month - 1].totalTWD += netTWD;
        monthlyBuckets[month - 1].items.push(item);
      }
    }
  }

  // 4. Calculate Portfolio Totals & FIRE Metrics
  let totalConfirmedTWD = 0;
  let totalProjectedTWD = 0;

  for (const b of monthlyBuckets) {
    totalConfirmedTWD += b.confirmedTWD;
    totalProjectedTWD += b.declaredTWD;
  }

  const totalAnnualTWD = totalConfirmedTWD + totalProjectedTWD;
  const avgMonthlyDividendTWD = Math.round(totalAnnualTWD / 12);

  // Monthly living expense target from fireConfig
  const monthlyExpenseTWD = Math.max(
    1,
    fireConfig?.monthlyExpenses ||
      (fireConfig?.targetAnnualExpensePostRetirement
        ? Math.round(fireConfig.targetAnnualExpensePostRetirement / 12)
        : 30000)
  );

  const expenseCoverageRatio = parseFloat(((avgMonthlyDividendTWD / monthlyExpenseTWD) * 100).toFixed(1));

  // Portfolio total market value in TWD
  let totalPortfolioMarketValueTWD = 0;
  for (const s of stocks) {
    if (s.shares > 0) {
      const price = s.currentPrice || s.avgCost || 0;
      const isUSD = s.currency === 'USD' || s.market === 'US';
      totalPortfolioMarketValueTWD += price * s.shares * (isUSD ? usdRate : 1);
    }
  }

  const portfolioYieldPercent =
    totalPortfolioMarketValueTWD > 0
      ? parseFloat(((totalAnnualTWD / totalPortfolioMarketValueTWD) * 100).toFixed(2))
      : 0;

  // 5. Rank top dividend contributors
  const symbolMap: Record<string, { symbol: string; name: string; totalTWD: number }> = {};
  for (const item of items) {
    if (!symbolMap[item.symbol]) {
      symbolMap[item.symbol] = { symbol: item.symbol, name: item.name, totalTWD: 0 };
    }
    symbolMap[item.symbol].totalTWD += item.netAmountTWD;
  }

  const topContributors = Object.values(symbolMap)
    .sort((a, b) => b.totalTWD - a.totalTWD)
    .map((c) => ({
      ...c,
      percentage: totalAnnualTWD > 0 ? parseFloat(((c.totalTWD / totalAnnualTWD) * 100).toFixed(1)) : 0,
    }));

  // Sort items chronologically by paymentDate or exDate
  items.sort((a, b) => (b.paymentDate || b.exDate).localeCompare(a.paymentDate || a.exDate));

  return {
    year,
    totalConfirmedTWD,
    totalProjectedTWD,
    totalAnnualTWD,
    avgMonthlyDividendTWD,
    monthlyExpenseTWD,
    expenseCoverageRatio,
    portfolioYieldPercent,
    monthlyBuckets,
    items,
    topContributors,
  };
}

/**
 * Calculate Dividend Recovery Metrics (填權息分析)
 */
export function calculateDividendRecovery(
  currentPrice: number,
  dividendAmount: number,
  preClosePrice: number,
  meta?: {
    symbol?: string;
    name?: string;
    market?: MarketType;
    currency?: 'USD' | 'TWD';
    exDate?: string;
    stockDividendRatio?: number; // Optional stock dividend ratio R for simultaneous ex-rights & ex-dividend
    closesHistory?: number[];
    timestampsHistory?: number[];
    exTimestamp?: number;
  }
): DividendRecoveryInfo {
  const divAmt = Math.max(0.0001, dividendAmount);
  const ratio = Math.max(0, meta?.stockDividendRatio || 0);

  // Official TWSE Ex-rights & Ex-dividend Reference Price: (PreClose - CashDiv) / (1 + Ratio)
  const exRefPrice = Math.max(0, (preClosePrice - divAmt) / (1 + ratio));
  const priceGap = currentPrice - preClosePrice;
  const isRecovered = currentPrice >= preClosePrice;

  // Recovery Rate formula: ((Current - ExRef) / Total Drop) * 100
  const totalDrop = Math.max(0.0001, preClosePrice - exRefPrice);
  const rawRecoveryRate = ((currentPrice - exRefPrice) / totalDrop) * 100;
  const recoveryRate = parseFloat(rawRecoveryRate.toFixed(1));

  let status: 'recovered' | 'recovering' | 'discount' = 'discount';
  if (isRecovered) {
    status = 'recovered';
  } else if (currentPrice > exRefPrice) {
    status = 'recovering';
  } else {
    status = 'discount';
  }

  let daysToRecover: number | undefined;
  let recoveredDate: string | undefined;

  // If historical daily candle trajectory is provided, determine exact trading days to recover
  if (
    meta?.closesHistory &&
    meta?.timestampsHistory &&
    meta?.exTimestamp &&
    meta.closesHistory.length === meta.timestampsHistory.length
  ) {
    const exIdx = meta.timestampsHistory.findIndex((ts) => ts === meta.exTimestamp);
    if (exIdx >= 0) {
      for (let i = exIdx; i < meta.closesHistory.length; i++) {
        if (meta.closesHistory[i] >= preClosePrice) {
          daysToRecover = i - exIdx + 1;
          recoveredDate = new Date(meta.timestampsHistory[i] * 1000).toISOString().split('T')[0];
          break;
        }
      }
    }
  }

  return {
    symbol: meta?.symbol || '',
    name: meta?.name,
    market: meta?.market || 'TW',
    currency: meta?.currency || 'TWD',
    exDate: meta?.exDate || '',
    dividendAmount: divAmt,
    preClosePrice,
    exRefPrice,
    currentPrice,
    recoveryRate,
    isRecovered,
    daysToRecover,
    recoveredDate,
    status,
    priceGap: parseFloat(priceGap.toFixed(2)),
  };
}

/**
 * Format FIRE Milestone label based on living expense coverage ratio
 */
export function getFIRECoverageMilestone(coverageRatio: number): {
  label: string;
  badgeColor: string;
  description: string;
} {
  if (coverageRatio >= 100) {
    return {
      label: '🏆 完整財務自由 (Full FIRE)',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      description: '每月被動股息已 100% 涵蓋基礎生活開銷，達成被動收入完全自足！',
    };
  }
  if (coverageRatio >= 80) {
    return {
      label: '🚀 緊縮生活自由 (Lean FIRE)',
      badgeColor: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
      description: '被動收入已達 80% 生活費，可全額支應極簡生活必要開支！',
    };
  }
  if (coverageRatio >= 50) {
    return {
      label: '🛡️ 半退休門檻 (Barista FIRE)',
      badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      description: '股息已覆蓋一半生活支出，工作只需打平剩餘開銷即可享受半退休！',
    };
  }
  if (coverageRatio >= 20) {
    return {
      label: '⚡ 支出抵減中 (Expense Offset)',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      description: '被動現金流已能定期支付水電帳單與房租部分款項，累積複利中！',
    };
  }
  return {
    label: '🌱 股息種子期 (Accumulation)',
    badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    description: '持續買進優質高股息與成長型資產，擴大被動收入雪球！',
  };
}
