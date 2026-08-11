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
  { symbol: 'SPCX', name: 'Space Exploration Technologies (SpaceX)', market: 'US', currency: 'USD' },
  { symbol: 'TSLA', name: 'Tesla, Inc. (特斯拉)', market: 'US', currency: 'USD' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust (納斯達克100)', market: 'US', currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft Corporation (微軟)', market: 'US', currency: 'USD' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc. (亞馬遜)', market: 'US', currency: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Google)', market: 'US', currency: 'USD' },
  { symbol: 'META', name: 'Meta Platforms, Inc. (臉書)', market: 'US', currency: 'USD' },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', market: 'US', currency: 'USD' },
  { symbol: 'PLTR', name: 'Palantir Technologies Inc.', market: 'US', currency: 'USD' },
  { symbol: 'SMCI', name: 'Super Micro Computer, Inc.', market: 'US', currency: 'USD' },

  // TW Stocks & ETFs
  { symbol: '2330.TW', name: '台灣積體電路 (台積電 / TSMC)', market: 'TW', currency: 'TWD' },
  { symbol: '2377.TW', name: '微星科技 (MSI / Micro-Star)', market: 'TW', currency: 'TWD' },
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
  { symbol: '2301.TW', name: '光寶科技 (Lite-On)', market: 'TW', currency: 'TWD' },
  { symbol: '3231.TW', name: '緯創資通 (Wistron)', market: 'TW', currency: 'TWD' },
  { symbol: '6669.TW', name: '緯穎科技 (Wiwynn)', market: 'TW', currency: 'TWD' },
  { symbol: '3008.TW', name: '大立光 (Largan Precision)', market: 'TW', currency: 'TWD' },
  { symbol: '2881.TW', name: '富邦金控 (Fubon Financial)', market: 'TW', currency: 'TWD' },
  { symbol: '2882.TW', name: '國泰金控 (Cathay Financial)', market: 'TW', currency: 'TWD' },
];

/**
 * Dynamic Global Stock Search Auto-Suggest API (Yahoo Search API + Local Hot Database)
 * Supports searching ANY global stock (e.g. SPCX, 2377, MSI, PLTR, SMCI, 台積電, 微星...)
 */
export async function searchStockSuggestionsAsync(keyword: string): Promise<StockSearchResult[]> {
  const clean = keyword.trim().toLowerCase();
  if (!clean) return [];

  // 1. Instant local matches from built-in database
  const localMatches = POPULAR_STOCKS_DB.filter(
    (item) =>
      item.symbol.toLowerCase().includes(clean) ||
      item.name.toLowerCase().includes(clean)
  );

  // 2. Fetch live online search suggestions from Yahoo Search API
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(clean)}&quotesCount=10`);
    if (res.ok) {
      const data = await res.json();
      const quotes = data?.quotes || [];

      const onlineMatches: StockSearchResult[] = quotes
        .filter((q: any) => q && q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF'))
        .map((q: any) => {
          const sym = q.symbol.toUpperCase();
          const isTW = sym.endsWith('.TW') || sym.endsWith('.TWO') || q.exchange === 'TAI' || q.exchange === 'TWO';
          return {
            symbol: sym,
            name: q.longname || q.shortname || sym,
            market: isTW ? ('TW' as MarketType) : ('US' as MarketType),
            currency: isTW ? ('TWD' as const) : ('USD' as const),
          };
        });

      // Combine local & online results, avoiding duplicates
      const seen = new Set<string>();
      const combined: StockSearchResult[] = [];

      for (const item of [...localMatches, ...onlineMatches]) {
        const key = item.symbol.toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(item);
        }
      }

      return combined.slice(0, 10);
    }
  } catch (e) {
    console.warn('Online stock search error:', e);
  }

  return localMatches.slice(0, 10);
}

/**
 * Fetch latest market quote from Yahoo Finance endpoints cleanly
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
