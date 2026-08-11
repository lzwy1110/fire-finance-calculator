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
  price?: number;
}

/**
 * Direct Live Quote Fetching (No AllOrigins proxy delay)
 */
export async function fetchSingleStockQuote(symbol: string, market: MarketType): Promise<StockQuote | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return null;

  let yahooSymbol = cleanSymbol;
  if (market === 'TW' && !yahooSymbol.endsWith('.TW') && !yahooSymbol.endsWith('.TWO')) {
    yahooSymbol = `${yahooSymbol}.TW`;
  }

  // Direct endpoints first for sub-second speed
  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`)}`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

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
      // Ignore and try fallback endpoint
    }
  }

  return null;
}

/**
 * Verified Live Data Source Search (No Hardcoded Dictionaries!)
 * Queries live data source directly and verifies symbol & current market price
 */
export async function searchStockSuggestionsAsync(
  keyword: string,
  targetMarket: MarketType = 'US'
): Promise<StockSearchResult[]> {
  const clean = keyword.trim().toUpperCase();
  if (!clean) return [];

  const results: StockSearchResult[] = [];
  const seen = new Set<string>();

  // Construct target Yahoo Ticker candidate
  let candidateSymbol = clean;
  if (targetMarket === 'TW' && !candidateSymbol.endsWith('.TW') && !candidateSymbol.endsWith('.TWO')) {
    candidateSymbol = `${candidateSymbol}.TW`;
  }

  // 1. Live Data Source Quote Verification
  try {
    const quote = await fetchSingleStockQuote(candidateSymbol, targetMarket);
    if (quote && quote.currentPrice > 0) {
      const key = quote.symbol.toUpperCase();
      seen.add(key);
      results.push({
        symbol: quote.symbol,
        name: quote.name || candidateSymbol,
        market: targetMarket,
        currency: targetMarket === 'TW' ? 'TWD' : 'USD',
        price: quote.currentPrice,
      });
    }
  } catch (e) {
    console.warn('Live quote verification error:', e);
  }

  // 2. Query Live Search API for additional matches
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(clean)}&quotesCount=8`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      const data = JSON.parse(text);
      const quotes = data?.quotes || [];

      if (Array.isArray(quotes)) {
        for (const q of quotes) {
          if (q && q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF')) {
            const sym = String(q.symbol).toUpperCase();
            const isTW = sym.endsWith('.TW') || sym.endsWith('.TWO') || q.exchange === 'TAI' || q.exchange === 'TWO';
            const mkt: MarketType = isTW ? 'TW' : 'US';

            if (mkt === targetMarket && !seen.has(sym)) {
              seen.add(sym);
              results.push({
                symbol: sym,
                name: q.shortname || q.longname || sym,
                market: mkt,
                currency: isTW ? 'TWD' : 'USD',
              });
            }
          }
        }
      }
    }
  } catch (e) {
    // Ignore search endpoint error
  }

  return results.slice(0, 8);
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
