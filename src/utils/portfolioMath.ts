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

  // Sort transactions chronologically
  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let currentShares = 0;
  let totalCostPool = 0;
  let realizedPnL = 0;

  for (const tx of sortedTx) {
    const shares = Math.abs(tx.shares);
    const price = Math.abs(tx.price);

    if (tx.type === 'BUY') {
      currentShares += shares;
      totalCostPool += shares * price;
    } else if (tx.type === 'SELL') {
      const avgCostBeforeSell = currentShares > 0 ? totalCostPool / currentShares : 0;
      const sharesToSell = Math.min(shares, currentShares);

      realizedPnL += sharesToSell * (price - avgCostBeforeSell);
      currentShares -= sharesToSell;
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

  // Migration helper: If stock has no transactions yet, auto-create initial BUY transaction from legacy values
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
          note: '初始開戶持股記錄',
        },
      ];
    } else {
      txs = [];
    }
  }

  const metrics = calculateStockMetrics(txs, stock.currentPrice);

  return {
    ...stock,
    transactions: txs,
    shares: metrics.shares,
    avgCost: metrics.avgCost,
    realizedPnL: metrics.realizedPnL,
  };
}
