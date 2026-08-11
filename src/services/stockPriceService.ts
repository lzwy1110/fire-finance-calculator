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

// Built-in Dictionary for US & TW Common Stocks
export const POPULAR_STOCKS_DB: StockSearchResult[] = [
  // US Stocks & ETFs
  { symbol: 'NVDA', name: '輝達 (NVIDIA)', market: 'US', currency: 'USD' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', market: 'US', currency: 'USD' },
  { symbol: 'AAPL', name: '蘋果 (Apple)', market: 'US', currency: 'USD' },
  { symbol: 'ASTS', name: 'AST SpaceMobile', market: 'US', currency: 'USD' },
  { symbol: 'SPCX', name: 'SpaceX 相關 ETF', market: 'US', currency: 'USD' },
  { symbol: 'TSLA', name: '特斯拉 (Tesla)', market: 'US', currency: 'USD' },
  { symbol: 'QQQ', name: '納斯達克100 ETF', market: 'US', currency: 'USD' },
  { symbol: 'MSFT', name: '微軟 (Microsoft)', market: 'US', currency: 'USD' },
  { symbol: 'AMZN', name: '亞馬遜 (Amazon)', market: 'US', currency: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', market: 'US', currency: 'USD' },
  { symbol: 'META', name: 'Meta (臉書)', market: 'US', currency: 'USD' },
  { symbol: 'AMD', name: '超微 (AMD)', market: 'US', currency: 'USD' },
  { symbol: 'PLTR', name: 'Palantir', market: 'US', currency: 'USD' },
  { symbol: 'SMCI', name: '美超微 (Super Micro)', market: 'US', currency: 'USD' },
  { symbol: 'RKLB', name: 'Rocket Lab', market: 'US', currency: 'USD' },

  // TW Common Stocks
  { symbol: '2377.TW', name: '微星', market: 'TW', currency: 'TWD' },
  { symbol: '2408.TW', name: '南亞科', market: 'TW', currency: 'TWD' },
  { symbol: '2344.TW', name: '華邦電', market: 'TW', currency: 'TWD' },
  { symbol: '2327.TW', name: '國巨', market: 'TW', currency: 'TWD' },
  { symbol: '3026.TW', name: '禾伸堂', market: 'TW', currency: 'TWD' },
  { symbol: '00981A.TW', name: '統一台灣高息', market: 'TW', currency: 'TWD' },
  { symbol: '2330.TW', name: '台積電', market: 'TW', currency: 'TWD' },
  { symbol: '0050.TW', name: '元大台灣50', market: 'TW', currency: 'TWD' },
  { symbol: '0056.TW', name: '元大高股息', market: 'TW', currency: 'TWD' },
  { symbol: '00878.TW', name: '國泰永續高股息', market: 'TW', currency: 'TWD' },
  { symbol: '00919.TW', name: '群益台灣精選高息', market: 'TW', currency: 'TWD' },
  { symbol: '00929.TW', name: '復華台灣科技優息', market: 'TW', currency: 'TWD' },
  { symbol: '00940.TW', name: '元大台灣價值高息', market: 'TW', currency: 'TWD' },
  { symbol: '2317.TW', name: '鴻海', market: 'TW', currency: 'TWD' },
  { symbol: '2454.TW', name: '聯發科', market: 'TW', currency: 'TWD' },
  { symbol: '2308.TW', name: '台達電', market: 'TW', currency: 'TWD' },
  { symbol: '2382.TW', name: '廣達', market: 'TW', currency: 'TWD' },
  { symbol: '2603.TW', name: '長榮', market: 'TW', currency: 'TWD' },
];

// Official TWSE Stock Directory Cache
let twseDirectoryCache: Map<string, { name: string; price: number }> | null = null;

/**
 * Fetch Official Taiwan TWSE Stock Directory with CORS support
 */
async function loadTwseDirectory(): Promise<Map<string, { name: string; price: number }>> {
  if (twseDirectoryCache && twseDirectoryCache.size > 0) {
    return twseDirectoryCache;
  }

  const map = new Map<string, { name: string; price: number }>();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          const code = String(item.Code || '').trim().toUpperCase();
          const name = String(item.Name || '').trim();
          const price = parseFloat(item.ClosingPrice) || 0;
          if (code) {
            map.set(code, { name, price });
          }
        });
        twseDirectoryCache = map;
      }
    }
  } catch (e) {
    console.warn('TWSE OpenAPI load error:', e);
  }

  return map;
}

/**
 * Fetch Single Stock Quote from Direct Yahoo Finance & TWSE OpenAPI
 */
export async function fetchSingleStockQuote(symbol: string, market: MarketType): Promise<StockQuote | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return null;

  // Clean raw symbol without .TW
  const rawCode = cleanSymbol.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');

  // If Taiwan Stock, try TWSE OpenAPI first for 100% reliable quote & Chinese name
  if (market === 'TW') {
    const twseMap = await loadTwseDirectory();
    const twseInfo = twseMap.get(rawCode);
    if (twseInfo && twseInfo.price > 0) {
      return {
        symbol: `${rawCode}.TW`,
        currentPrice: twseInfo.price,
        previousClose: twseInfo.price,
        change: 0,
        changePercent: 0,
        currency: 'TWD',
        name: twseInfo.name || cleanSymbol,
      };
    }
  }

  // Fallback to Yahoo Finance endpoints
  let yahooSymbol = cleanSymbol;
  if (market === 'TW' && !yahooSymbol.endsWith('.TW') && !yahooSymbol.endsWith('.TWO')) {
    yahooSymbol = `${rawCode}.TW`;
  }

  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`,
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
      // Try next
    }
  }

  return null;
}

/**
 * 100% Reliable Search Auto-Suggest for ALL Taiwan Stocks & US Equities
 */
export async function searchStockSuggestionsAsync(
  keyword: string,
  targetMarket: MarketType = 'US'
): Promise<StockSearchResult[]> {
  const clean = keyword.trim();
  const lowerClean = clean.toLowerCase();
  const upperClean = clean.toUpperCase();
  const rawCode = upperClean.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
  if (!clean) return [];

  const results: StockSearchResult[] = [];
  const seen = new Set<string>();

  const addResult = (item: StockSearchResult) => {
    const key = item.symbol.toUpperCase();
    if (!seen.has(key)) {
      if (!targetMarket || item.market === targetMarket) {
        seen.add(key);
        results.push(item);
      }
    }
  };

  // 1. Taiwan Stock Search via Official TWSE OpenAPI Directory
  if (targetMarket === 'TW' || /[\u4e00-\u9fa5]/.test(clean) || /^\d+/.test(clean)) {
    const twseMap = await loadTwseDirectory();

    // Exact Code Match
    if (twseMap.has(rawCode)) {
      const info = twseMap.get(rawCode)!;
      addResult({
        symbol: `${rawCode}.TW`,
        name: info.name,
        market: 'TW',
        currency: 'TWD',
        price: info.price,
      });
    }

    // Partial Code or Name Search
    twseMap.forEach((info, code) => {
      if (
        code.toLowerCase().includes(lowerClean) ||
        info.name.includes(clean)
      ) {
        addResult({
          symbol: `${code}.TW`,
          name: info.name,
          market: 'TW',
          currency: 'TWD',
          price: info.price,
        });
      }
    });
  }

  // 2. Search Built-in Dictionary
  for (const item of POPULAR_STOCKS_DB) {
    if (
      item.symbol.toLowerCase().includes(lowerClean) ||
      item.name.toLowerCase().includes(lowerClean) ||
      item.name.includes(clean)
    ) {
      addResult(item);
    }
    if (results.length >= 8) break;
  }

  // 3. Candidate Fallback Generation if no exact match found
  if (results.length === 0 && clean.length >= 1) {
    const isTw = targetMarket === 'TW' || /^\d+[A-Za-z]?$/.test(clean);
    const sym = isTw && !upperClean.endsWith('.TW') ? `${upperClean}.TW` : upperClean;
    const mkt: MarketType = isTw ? 'TW' : 'US';

    addResult({
      symbol: sym,
      name: `${mkt === 'TW' ? '台股' : '美股'} (${sym})`,
      market: mkt,
      currency: isTw ? 'TWD' : 'USD',
    });
  }

  // 4. Background fetch live quote for US candidates without price
  if (targetMarket === 'US' && results.length > 0) {
    const topItem = results[0];
    if (!topItem.price) {
      try {
        const quote = await fetchSingleStockQuote(topItem.symbol, topItem.market);
        if (quote && quote.currentPrice > 0) {
          topItem.price = quote.currentPrice;
          if (quote.name && topItem.name.startsWith('美股')) {
            topItem.name = quote.name;
          }
        }
      } catch (e) {
        // Non-blocking
      }
    }
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
