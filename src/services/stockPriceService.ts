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

// Built-in Popular Stock Database for Instant Local Fallback
export const POPULAR_STOCKS_DB: StockSearchResult[] = [
  // US Stocks & ETFs
  { symbol: 'NVDA', name: 'NVIDIA Corporation (輝達)', market: 'US', currency: 'USD' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', market: 'US', currency: 'USD' },
  { symbol: 'AAPL', name: 'Apple Inc. (蘋果)', market: 'US', currency: 'USD' },
  { symbol: 'ASTS', name: 'AST SpaceMobile, Inc.', market: 'US', currency: 'USD' },
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
  { symbol: 'RKLB', name: 'Rocket Lab USA, Inc.', market: 'US', currency: 'USD' },

  // TW Stocks & ETFs (Common Defaults)
  { symbol: '2330.TW', name: '台積電', market: 'TW', currency: 'TWD' },
  { symbol: '3026.TW', name: '禾伸堂', market: 'TW', currency: 'TWD' },
  { symbol: '2408.TW', name: '南亞科', market: 'TW', currency: 'TWD' },
  { symbol: '00981A.TW', name: '統一台灣高息', market: 'TW', currency: 'TWD' },
  { symbol: '2377.TW', name: '微星', market: 'TW', currency: 'TWD' },
  { symbol: '0050.TW', name: '元大台灣50 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '0056.TW', name: '元大高股息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '00878.TW', name: '國泰永續高股息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '00919.TW', name: '群益台灣精選高息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '00929.TW', name: '復華台灣科技優息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '00940.TW', name: '元大台灣價值高息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '2317.TW', name: '鴻海精密', market: 'TW', currency: 'TWD' },
  { symbol: '2454.TW', name: '聯發科', market: 'TW', currency: 'TWD' },
  { symbol: '2308.TW', name: '台達電', market: 'TW', currency: 'TWD' },
  { symbol: '2382.TW', name: '廣達', market: 'TW', currency: 'TWD' },
  { symbol: '2603.TW', name: '長榮', market: 'TW', currency: 'TWD' },
];

// Official TWSE Stock List Cache
let twseStockListCache: { code: string; name: string }[] | null = null;

/**
 * Fetch official TWSE Taiwan Stock Directory (OpenAPI with CORS support)
 */
async function getTwseStockList(): Promise<{ code: string; name: string }[]> {
  if (twseStockListCache && twseStockListCache.length > 0) {
    return twseStockListCache;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        twseStockListCache = data.map((item: any) => ({
          code: String(item.Code || '').trim(),
          name: String(item.Name || '').trim(),
        }));
        return twseStockListCache;
      }
    }
  } catch (e) {
    console.warn('TWSE Stock List API query skipped:', e);
  }

  return [];
}

/**
 * Fast & Comprehensive Stock Search supporting ANY US symbol and ALL Taiwan stock codes & Chinese names
 */
export async function searchStockSuggestionsAsync(
  keyword: string,
  targetMarket?: MarketType
): Promise<StockSearchResult[]> {
  const clean = keyword.trim();
  const lowerClean = clean.toLowerCase();
  if (!clean) return [];

  const results: StockSearchResult[] = [];
  const seen = new Set<string>();

  // Helper to add search item
  const addResult = (item: StockSearchResult) => {
    const key = item.symbol.toUpperCase();
    if (!seen.has(key)) {
      if (!targetMarket || item.market === targetMarket) {
        seen.add(key);
        results.push(item);
      }
    }
  };

  // 1. Search Official TWSE Stock Database for TW Market or Chinese Input
  const hasChinese = /[\u4e00-\u9fa5]/.test(clean);
  if (targetMarket === 'TW' || hasChinese || /^\d+/.test(clean)) {
    const twseList = await getTwseStockList();
    for (const stock of twseList) {
      if (
        stock.code.toLowerCase().includes(lowerClean) ||
        stock.name.includes(clean)
      ) {
        const symbol = stock.code.endsWith('.TW') ? stock.code : `${stock.code}.TW`;
        addResult({
          symbol,
          name: stock.name,
          market: 'TW',
          currency: 'TWD',
        });
      }
      if (results.length >= 10) break;
    }
  }

  // 2. Search Local Built-in Database
  for (const item of POPULAR_STOCKS_DB) {
    if (
      item.symbol.toLowerCase().includes(lowerClean) ||
      item.name.toLowerCase().includes(lowerClean) ||
      item.name.includes(clean)
    ) {
      addResult(item);
    }
    if (results.length >= 10) break;
  }

  // 3. Search Yahoo Finance Global Search Endpoints
  if (results.length < 5) {
    const searchEndpoints = [
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(clean)}&quotesCount=10`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v1/finance/search?q=${clean}&quotesCount=10`)}`,
    ];

    for (const url of searchEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const res = await fetch(url, { signal: controller.signal });
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
                addResult({
                  symbol: sym,
                  name: q.shortname || q.longname || sym,
                  market: isTW ? 'TW' : 'US',
                  currency: isTW ? 'TWD' : 'USD',
                });
              }
            }
            if (results.length >= 5) break;
          }
        }
      } catch (e) {
        // Skip endpoint error
      }
    }
  }

  // 4. Absolute Fallback: Ensure typed code is ALWAYS selectable
  const upperClean = clean.toUpperCase();
  if (clean.length >= 2) {
    const isTwCodePattern = /^\d+[A-Za-z]?$/.test(clean);
    const isTW = targetMarket === 'TW' || isTwCodePattern || upperClean.endsWith('.TW');
    const fallbackSymbol = isTW && !upperClean.endsWith('.TW') ? `${upperClean}.TW` : upperClean;
    const finalMarket: MarketType = isTW ? 'TW' : 'US';

    addResult({
      symbol: fallbackSymbol,
      name: `新增標的 (${fallbackSymbol})`,
      market: finalMarket,
      currency: isTW ? 'TWD' : 'USD',
    });
  }

  return results.slice(0, 8);
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

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
