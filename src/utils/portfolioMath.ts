import { PortfolioStock, StockTransaction } from '../types/portfolio';

export interface CalculatedStockMetrics {
  shares: number;
  avgCost: number;
  realizedPnL: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedRoiPercent: number;
}

/**
 * Calculate holdings, weighted average cost, and realized PnL from transactions
 */
export function calculateStockMetrics(
  transactions: StockTransaction[],
  currentPrice: number
): CalculatedStockMetrics {
  if (!transactions || transactions.length === 0) {
    return {
      shares: 0,
      avgCost: 0,
      realizedPnL: 0,
      marketValue: 0,
      unrealizedPnL: 0,
      unrealizedRoiPercent: 0,
    };
  }

  // Sort transactions chronologically (If same date, BUY must always precede SELL!)
  const sortedTx = [...transactions].sort((a, b) => {
    const timeA = new Date(a.date).getTime() || 0;
    const timeB = new Date(b.date).getTime() || 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    if (a.type === 'BUY' && b.type === 'SELL') return -1;
    if (a.type === 'SELL' && b.type === 'BUY') return 1;
    return a.id.localeCompare(b.id);
  });

  let currentShares = 0;
  let totalCostPool = 0;
  let realizedPnL = 0;

  for (const tx of sortedTx) {
    const shares = Math.abs(tx.shares) || 0;
    const price = Math.abs(tx.price) || 0;

    if (tx.type === 'BUY') {
      currentShares += shares;
      totalCostPool += shares * price;
    } else if (tx.type === 'SELL') {
      const avgCostBeforeSell = currentShares > 0 ? totalCostPool / currentShares : 0;
      const sharesToSell = Math.min(shares, currentShares);

      realizedPnL += sharesToSell * (price - avgCostBeforeSell);
      currentShares = Math.max(0, currentShares - sharesToSell);
      totalCostPool = currentShares * avgCostBeforeSell;
    }
  }

  const avgCost = currentShares > 0 ? totalCostPool / currentShares : 0;
  const marketValue = currentShares * currentPrice;
  const unrealizedPnL = currentShares * (currentPrice - avgCost);
  const costBasis = currentShares * avgCost;
  const unrealizedRoiPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

  return {
    shares: currentShares,
    avgCost,
    realizedPnL,
    marketValue,
    unrealizedPnL,
    unrealizedRoiPercent,
  };
}

/**
 * Ensure stock object has valid transactions array and updated metrics
 */
export function syncStockCalculations(stock: PortfolioStock): PortfolioStock {
  let txs = stock.transactions;

  if (!txs || txs.length === 0) {
    if (stock.shares > 0) {
      txs = [
        {
          id: `tx-init-${Date.now()}`,
          stockId: stock.id,
          type: 'BUY',
          shares: stock.shares,
          price: stock.avgCost,
          date: new Date().toISOString().split('T')[0],
          note: '初始建倉持股紀錄',
        },
      ];
    } else {
      txs = [];
    }
  }

  const metrics = calculateStockMetrics(txs, stock.currentPrice || 0);

  return {
    ...stock,
    transactions: txs,
    shares: metrics.shares,
    avgCost: metrics.avgCost,
    realizedPnL: metrics.realizedPnL,
  };
}

/**
 * Safely merge local and cloud stock portfolios with CRDT-style transaction deduplication
 */
export function mergeStockPortfolios(
  localStocks: PortfolioStock[],
  cloudStocks: PortfolioStock[]
): PortfolioStock[] {
  if (!Array.isArray(cloudStocks) || cloudStocks.length === 0) {
    return localStocks || [];
  }
  if (!Array.isArray(localStocks) || localStocks.length === 0) {
    return cloudStocks || [];
  }

  const mergedMap = new Map<string, PortfolioStock>();

  // 1. Add all local stocks
  localStocks.forEach((s) => {
    const key = s.symbol.toUpperCase();
    mergedMap.set(key, s);
  });

  // 2. Union with cloud stocks, merging trade logs
  cloudStocks.forEach((cStock) => {
    const key = cStock.symbol.toUpperCase();
    const existingLocal = mergedMap.get(key);

    if (!existingLocal) {
      mergedMap.set(key, cStock);
    } else {
      // Merge transaction trade logs by ID
      const txMap = new Map<string, StockTransaction>();
      (existingLocal.transactions || []).forEach((t) => txMap.set(t.id, t));
      (cStock.transactions || []).forEach((t) => txMap.set(t.id, t));

      const mergedTx = Array.from(txMap.values());
      const updatedStock = syncStockCalculations({
        ...existingLocal,
        name: cStock.name || existingLocal.name,
        currentPrice: cStock.currentPrice > 0 ? cStock.currentPrice : existingLocal.currentPrice,
        transactions: mergedTx,
      });

      mergedMap.set(key, updatedStock);
    }
  });

  return Array.from(mergedMap.values()).map((s) => syncStockCalculations(s));
}
