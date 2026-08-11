export type MarketType = 'US' | 'TW';
export type CurrencyType = 'USD' | 'TWD';

export interface PortfolioStock {
  id: string;
  symbol: string;             // e.g. "VOO", "NVDA", "AAPL", "2330.TW", "0050.TW"
  name: string;               // e.g. "Vanguard S&P 500 ETF"
  market: MarketType;         // 'US' or 'TW'
  shares: number;             // e.g. 50
  avgCost: number;            // Avg buy cost price per share (USD or TWD)
  currentPrice: number;       // Latest market price per share
  currency: CurrencyType;     // 'USD' or 'TWD'
  lastUpdated?: string;       // ISO Date timestamp
  previousClose?: number;     // Previous day closing price for daily change calculation
  notes?: string;             // Optional notes
}

export interface PortfolioSummary {
  totalMarketValueTWD: number;
  totalCostTWD: number;
  totalProfitTWD: number;
  totalRoiPercent: number;
  usMarketValueUSD: number;
  twMarketValueTWD: number;
}
