export type MarketType = 'US' | 'TW';
export type CurrencyType = 'USD' | 'TWD';

export interface StockTransaction {
  id: string;
  stockId?: string;
  type: 'BUY' | 'SELL' | 'SPLIT' | 'DIVIDEND' | 'STOCK_DIVIDEND';
  shares: number;
  price: number;
  date: string; // YYYY-MM-DD
  note?: string;
  isInitialHoldings?: boolean; // If true, skip cash balance deduction for pre-existing stock holdings
  splitRatio?: number;        // e.g. 10 for 1:10 split, 0.1 for 10:1 reverse split
  splitNumerator?: number;   // e.g. 10
  splitDenominator?: number; // e.g. 1
  dividendPerShare?: number;  // Cash dividend per share (e.g. NT$ 1.5 or $0.85)
  dividendTotalCash?: number; // Actual cash credited into savings
  taxWithheld?: number;       // Tax withheld (e.g. US 30% dividend tax, TW 2.11% NHI fee)
  stockDividendPerShare?: number; // Stock dividend per share (e.g. NT$ 0.8)
  stockDividendRatio?: number;    // Stock dividend ratio (e.g. 0.08 for 8% bonus shares)
}

export interface StockSplitEvent {
  date: string;               // YYYY-MM-DD
  ratio: number;              // numerator / denominator, e.g. 10
  numerator: number;          // e.g. 10
  denominator: number;        // e.g. 1
  splitRatioText: string;     // e.g. "1 拆 10" or "10:1"
  status: 'upcoming' | 'effective_pending' | 'applied';
}

export interface StockDividendEvent {
  date: string;               // Ex-dividend date (YYYY-MM-DD)
  amount: number;             // Cash dividend per share
  status: 'upcoming' | 'effective_pending' | 'applied';
  paymentDate?: string;       // Estimated or actual payment date
}

export interface StockRightEvent {
  date: string;               // Ex-rights date (YYYY-MM-DD)
  stockDividendRatio: number; // e.g. 0.08 (8% stock dividend, 1000 shares get 80 shares)
  stockDividendPerShare: number; // e.g. 0.8 元 (stockDividendRatio * 10)
  status: 'upcoming' | 'effective_pending' | 'applied';
}

export interface PortfolioStock {
  id: string;
  symbol: string;             // e.g. "VOO", "NVDA", "AAPL", "2330.TW", "0050.TW"
  name: string;               // e.g. "Vanguard S&P 500 ETF"
  market: MarketType;         // 'US' or 'TW'
  shares: number;             // Holding shares (calculated from transactions)
  avgCost: number;            // Weighted avg buy cost price per share (USD or TWD)
  currentPrice: number;       // Latest market price per share
  currency: CurrencyType;     // 'USD' or 'TWD'
  lastUpdated?: string;       // ISO Date timestamp
  previousClose?: number;     // Previous day closing price for daily change calculation
  notes?: string;             // Optional notes
  transactions?: StockTransaction[]; // List of Buy/Sell transaction logs
  realizedPnL?: number;       // Realized Profit/Loss locked from sell trades
  sparkline?: number[];       // Sampled recent intraday price points for mini chart
  pendingSplit?: StockSplitEvent; // Optional pending or upcoming split event detected
  pendingDividend?: StockDividendEvent; // Optional pending or upcoming dividend event detected
  pendingRight?: StockRightEvent; // Optional pending or upcoming stock dividend (ex-rights) event detected
}

export interface PortfolioSummary {
  totalMarketValueTWD: number;
  totalCostTWD: number;
  totalProfitTWD: number;
  totalRoiPercent: number;
  usMarketValueUSD: number;
  twMarketValueTWD: number;
  totalRealizedPnLTWD?: number;
}
