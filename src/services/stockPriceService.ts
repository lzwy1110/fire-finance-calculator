import { MarketType } from '../types/portfolio';

export interface StockQuote {
  symbol: string;
  currentPrice: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  currency: 'USD' | 'TWD';
  name?: string;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  market: MarketType;
  currency: 'USD' | 'TWD';
}

// Built-in Popular Stock Database for Instant Local Auto-Complete Search
export const POPULAR_STOCKS_DB: StockSearchResult[] = [
  // US Stocks & ETFs
  { symbol: 'NVDA', name: 'NVIDIA Corporation (輝達)', market: 'US', currency: 'USD' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', market: 'US', currency: 'USD' },
  { symbol: 'AAPL', name: 'Apple Inc. (蘋果)', market: 'US', currency: 'USD' },
  { symbol: 'TSLA', name: 'Tesla, Inc. (特斯拉)', market: 'US', currency: 'USD' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust (納斯達克100)', market: 'US', currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft Corporation (微軟)', market: 'US', currency: 'USD' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc. (亞馬遜)', market: 'US', currency: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Google)', market: 'US', currency: 'USD' },
  { symbol: 'META', name: 'Meta Platforms, Inc. (臉書)', market: 'US', currency: 'USD' },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', market: 'US', currency: 'USD' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.', market: 'US', currency: 'USD' },
  { symbol: 'VT', name: 'Vanguard Total World Stock ETF', market: 'US', currency: 'USD' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', market: 'US', currency: 'USD' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', market: 'US', currency: 'USD' },
  { symbol: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF', market: 'US', currency: 'USD' },

  // TW Stocks & ETFs
  { symbol: '2330.TW', name: '台灣積體電路 (台積電 / TSMC)', market: 'TW', currency: 'TWD' },
  { symbol: '0050.TW', name: '元大台灣50 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '0056.TW', name: '元大高股息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '00878.TW', name: '國泰永續高股息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '00919.TW', name: '群益台灣精選高息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '00929.TW', name: '復華台灣科技優息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '00940.TW', name: '元大台灣價值高息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '2317.TW', name: '鴻海精密 (Foxconn)', market: 'TW', currency: 'TWD' },
  { symbol: '2454.TW', name: '聯發科 (MediaTek)', market: 'TW', currency: 'TWD' },
  { symbol: '2308.TW', name: '台達電 (Delta Electronics)', market: 'TW', currency: 'TWD' },
  { symbol: '2382.TW', name: '廣達電腦 (Quanta)', market: 'TW', currency: 'TWD' },
  { symbol: '3008.TW', name: '大立光 (Largan Precision)', market: 'TW', currency: 'TWD' },
  { symbol: '2881.TW', name: '富邦金控 (Fubon Financial)', market: 'TW', currency: 'TWD' },
  { symbol: '2882.TW', name: '國泰金控 (Cathay Financial)', market: 'TW', currency: 'TWD' },
];

/**
 * Autocomplete Search Suggestions Filter
 */
export function searchStockSuggestions(keyword: string): StockSearchResult[] {
  const clean = keyword.trim().toLowerCase();
  if (!clean) return [];

  return POPULAR_STOCKS_DB.filter(
    (item) =>
      item.symbol.toLowerCase().includes(clean) ||
      item.name.toLowerCase().includes(clean)
  ).slice(0, 8);
}

/**
 * Fetch latest market quote from Yahoo Finance endpoints cleanly without artificial filters
 */
export async function fetchSingleStockQuote(symbol: string, market: MarketType): Promise<StockQuote | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return null;

  let yahooSymbol = cleanSymbol;
  if (market === 'TW' && !yahooSymbol.endsWith('.TW') && !yahooSymbol.endsWith('.TWO')) {
    yahooSymbol = `${yahooSymbol}.TW`;
  }

  const endpoints = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`)}`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        const data = JSON.parse(text);
        const meta = data?.chart?.result?.[0]?.meta;

        if (meta && typeof meta.regularMarketPrice === 'number' && meta.regularMarketPrice > 0) {
          const currentPrice = meta.regularMarketPrice;
          const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
          const change = currentPrice - previousClose;
          const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

          return {
            symbol: cleanSymbol,
            currentPrice,
            previousClose,
            change,
            changePercent,
            currency: market === 'TW' ? 'TWD' : 'USD',
            name: meta.shortName || meta.longName || cleanSymbol,
          };
        }
      }
    } catch (e) {
      console.warn(`Stock API endpoint error for ${cleanSymbol}:`, e);
    }
  }

  return null;
}

/**
 * Fetch quotes for multiple stocks concurrently
 */
export async function batchFetchStockQuotes(
  stocks: { symbol: string; market: MarketType }[]
): Promise<Record<string, StockQuote>> {
  const results: Record<string, StockQuote> = {};

  const promises = stocks.map(async (s) => {
    const quote = await fetchSingleStockQuote(s.symbol, s.market);
    if (quote) {
      results[s.symbol.toUpperCase()] = quote;
    }
  });

  await Promise.allSettled(promises);
  return results;
}
