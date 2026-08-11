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

// Finnhub Free Demo API Key for US stocks
const FINNHUB_KEY = 'csoqnk9r01qg41q04b0g';

/**
 * Fetch latest market quote for US & TW stock symbols
 * Example symbols: "VOO", "NVDA", "AAPL", "TSLA", "QQQ", "2330.TW", "0050.TW"
 */
export async function fetchSingleStockQuote(symbol: string, market: MarketType): Promise<StockQuote | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return null;

  // 1. Try Finnhub API first for US stocks
  if (market === 'US' && !cleanSymbol.includes('.TW')) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${cleanSymbol}&token=${FINNHUB_KEY}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.c === 'number' && data.c > 0) {
          const currentPrice = data.c;
          const previousClose = data.pc || currentPrice;
          const change = data.d || (currentPrice - previousClose);
          const changePercent = data.dp || (previousClose > 0 ? (change / previousClose) * 100 : 0);

          return {
            symbol: cleanSymbol,
            currentPrice,
            previousClose,
            change,
            changePercent,
            currency: 'USD',
          };
        }
      }
    } catch (e) {
      console.warn(`Finnhub fetch failed for ${cleanSymbol}, trying fallback...`, e);
    }
  }

  // 2. Try Yahoo Finance Chart API for both US and TW (.TW) stocks
  try {
    let yahooSymbol = cleanSymbol;
    if (market === 'TW' && !yahooSymbol.endsWith('.TW') && !yahooSymbol.endsWith('.TWO')) {
      yahooSymbol = `${yahooSymbol}.TW`;
    }

    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`);
    if (res.ok) {
      const data = await res.json();
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
          name: meta.shortName || meta.symbol || cleanSymbol,
        };
      }
    }
  } catch (e) {
    console.warn(`Yahoo Finance fetch failed for ${cleanSymbol}:`, e);
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
