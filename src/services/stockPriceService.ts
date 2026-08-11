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

/**
 * Helper to parse Yahoo Finance chart JSON structure
 */
function parseYahooChartResponse(cleanSymbol: string, market: MarketType, data: any): StockQuote | null {
  try {
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
        name: meta.shortName || meta.longName || meta.symbol || cleanSymbol,
      };
    }
  } catch (e) {
    console.warn(`Error parsing quote JSON for ${cleanSymbol}:`, e);
  }
  return null;
}

/**
 * Fetch latest market quote for US & TW stock symbols with CORS proxy & fallback endpoints
 * Example symbols: "VOO", "NVDA", "AAPL", "TSLA", "QQQ", "2330.TW", "0050.TW"
 */
export async function fetchSingleStockQuote(symbol: string, market: MarketType): Promise<StockQuote | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return null;

  let yahooSymbol = cleanSymbol;
  if (market === 'TW' && !yahooSymbol.endsWith('.TW') && !yahooSymbol.endsWith('.TWO')) {
    yahooSymbol = `${yahooSymbol}.TW`;
  }

  // List of fallback endpoints (AllOrigins CORS Proxy -> Query1 Direct -> Query2 Direct)
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
        const quote = parseYahooChartResponse(cleanSymbol, market, data);
        if (quote) return quote;
      }
    } catch (e) {
      console.warn(`Stock price endpoint failed [${url}] for ${cleanSymbol}:`, e);
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
