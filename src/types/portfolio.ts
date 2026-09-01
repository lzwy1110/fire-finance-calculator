export type MarketType = 'US' | 'TW';
export type CurrencyType = 'USD' | 'TWD';

export interface StockTransaction {
  id: string;
  stockId?: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  date: string; // YYYY-MM-DD
  note?: string;
  isInitialHoldings?: boolean; // If true, skip cash balance deduction for pre-existing stock holdings
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
