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

// Rich Stock Dictionary for Instant Names & Symbols
export const POPULAR_STOCKS_DB: StockSearchResult[] = [
  // US Stocks & ETFs
  { symbol: 'NVDA', name: '輝達 (NVIDIA Corporation)', market: 'US', currency: 'USD' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', market: 'US', currency: 'USD' },
  { symbol: 'AAPL', name: '蘋果 (Apple Inc.)', market: 'US', currency: 'USD' },
  { symbol: 'ASTS', name: 'AST SpaceMobile', market: 'US', currency: 'USD' },
  { symbol: 'SPCX', name: 'SpaceX 相關 ETF (SPCX)', market: 'US', currency: 'USD' },
  { symbol: 'TSLA', name: '特斯拉 (Tesla)', market: 'US', currency: 'USD' },
  { symbol: 'QQQ', name: '納斯達克100 ETF (QQQ)', market: 'US', currency: 'USD' },
  { symbol: 'MSFT', name: '微軟 (Microsoft)', market: 'US', currency: 'USD' },
  { symbol: 'AMZN', name: '亞馬遜 (Amazon)', market: 'US', currency: 'USD' },
  { symbol: 'GOOGL', name: 'Google (Alphabet)', market: 'US', currency: 'USD' },
  { symbol: 'META', name: 'Meta (臉書)', market: 'US', currency: 'USD' },
  { symbol: 'AMD', name: '超微 (AMD)', market: 'US', currency: 'USD' },
  { symbol: 'PLTR', name: 'Palantir', market: 'US', currency: 'USD' },
  { symbol: 'SMCI', name: '美超微 (Super Micro)', market: 'US', currency: 'USD' },
  { symbol: 'RKLB', name: 'Rocket Lab', market: 'US', currency: 'USD' },

  // TW Stocks & ETFs
  { symbol: '2377.TW', name: '微星 (Micro-Star / MSI)', market: 'TW', currency: 'TWD' },
  { symbol: '2344.TW', name: '華邦電 (Winbond)', market: 'TW', currency: 'TWD' },
  { symbol: '2408.TW', name: '南亞科 (Nanya Tech)', market: 'TW', currency: 'TWD' },
  { symbol: '2327.TW', name: '國巨 (Yageo)', market: 'TW', currency: 'TWD' },
  { symbol: '3026.TW', name: '禾伸堂 (Holy Stone)', market: 'TW', currency: 'TWD' },
  { symbol: '00981A.TW', name: '統一台灣高息', market: 'TW', currency: 'TWD' },
  { symbol: '2330.TW', name: '台積電 (TSMC)', market: 'TW', currency: 'TWD' },
  { symbol: '0050.TW', name: '元大台灣50 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '0056.TW', name: '元大高股息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '00878.TW', name: '國泰永續高股息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '00919.TW', name: '群益台灣精選高息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '00929.TW', name: '復華台灣科技優息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '00940.TW', name: '元大台灣價值高息 ETF', market: 'TW', currency: 'TWD' },
  { symbol: '2317.TW', name: '鴻海精密 (Foxconn)', market: 'TW', currency: 'TWD' },
  { symbol: '2454.TW', name: '聯發科 (MediaTek)', market: 'TW', currency: 'TWD' },
  { symbol: '2308.TW', name: '台達電', market: 'TW', currency: 'TWD' },
  { symbol: '2382.TW', name: '廣達電腦', market: 'TW', currency: 'TWD' },
  { symbol: '2301.TW', name: '光寶科技', market: 'TW', currency: 'TWD' },
  { symbol: '3231.TW', name: '緯創資通', market: 'TW', currency: 'TWD' },
  { symbol: '6669.TW', name: '緯穎科技', market: 'TW', currency: 'TWD' },
  { symbol: '2603.TW', name: '長榮海運', market: 'TW', currency: 'TWD' },
  { symbol: '2609.TW', name: '陽明海運', market: 'TW', currency: 'TWD' },
  { symbol: '2615.TW', name: '萬海航運', market: 'TW', currency: 'TWD' },
  { symbol: '2881.TW', name: '富邦金控', market: 'TW', currency: 'TWD' },
  { symbol: '2882.TW', name: '國泰金控', market: 'TW', currency: 'TWD' },
  { symbol: '2886.TW', name: '兆豐金控', market: 'TW', currency: 'TWD' },
  { symbol: '2891.TW', name: '中信金控', market: 'TW', currency: 'TWD' },
  { symbol: '2409.TW', name: '友達光電', market: 'TW', currency: 'TWD' },
  { symbol: '3481.TW', name: '群創光電', market: 'TW', currency: 'TWD' },
  { symbol: '2303.TW', name: '聯華電子', market: 'TW', currency: 'TWD' },
  { symbol: '2357.TW', name: '華碩電腦', market: 'TW', currency: 'TWD' },
  { symbol: '2353.TW', name: '宏碁', market: 'TW', currency: 'TWD' },
  { symbol: '2356.TW', name: '英業達', market: 'TW', currency: 'TWD' },
  { symbol: '3008.TW', name: '大立光', market: 'TW', currency: 'TWD' },
  { symbol: '2449.TW', name: '京元電子', market: 'TW', currency: 'TWD' },
  { symbol: '3711.TW', name: '日月光投控', market: 'TW', currency: 'TWD' },
  { symbol: '2379.TW', name: '瑞昱半導體', market: 'TW', currency: 'TWD' },
  { symbol: '3034.TW', name: '聯詠科技', market: 'TW', currency: 'TWD' },
];

/**
 * Direct Live Quote Fetching for US & TW Stocks
 */
export async function fetchSingleStockQuote(symbol: string, market: MarketType): Promise<StockQuote | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return null;

  let yahooSymbol = cleanSymbol;
  if (market === 'TW' && !yahooSymbol.endsWith('.TW') && !yahooSymbol.endsWith('.TWO')) {
    yahooSymbol = `${yahooSymbol}.TW`;
  }

  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`)}`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

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
      // Try next endpoint
    }
  }

  return null;
}

/**
 * Robust Search Auto-Suggest with Proper Name Resolution
 */
export async function searchStockSuggestionsAsync(
  keyword: string,
  targetMarket: MarketType = 'US'
): Promise<StockSearchResult[]> {
  const clean = keyword.trim();
  const lowerClean = clean.toLowerCase();
  const upperClean = clean.toUpperCase();
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

  // 1. Search Dictionary FIRST for clean human-readable names (e.g. 2377 -> 微星, 2344 -> 華邦電)
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

  // 2. Generate Primary Candidate if not already matched by dictionary
  const isTwCodePattern = /^\d+[A-Za-z]?$/.test(clean);
  const isTW = targetMarket === 'TW' || isTwCodePattern || upperClean.endsWith('.TW');
  const candidateSymbol = isTW && !upperClean.endsWith('.TW') ? `${upperClean}.TW` : upperClean;
  const candidateMarket: MarketType = isTW ? 'TW' : 'US';

  if (!seen.has(candidateSymbol.toUpperCase()) && (!targetMarket || candidateMarket === targetMarket)) {
    addResult({
      symbol: candidateSymbol,
      name: `股票標的 (${candidateSymbol})`,
      market: candidateMarket,
      currency: isTW ? 'TWD' : 'USD',
    });
  }

  // 3. Background fetch live quote & real company name for candidate
  try {
    const quote = await fetchSingleStockQuote(candidateSymbol, candidateMarket);
    if (quote && quote.currentPrice > 0) {
      results.forEach((r) => {
        if (r.symbol.toUpperCase() === candidateSymbol.toUpperCase()) {
          r.price = quote.currentPrice;
          if (quote.name && (r.name.startsWith('股票標的') || r.name === candidateSymbol)) {
            r.name = quote.name;
          }
        }
      });
    }
  } catch (e) {
    // Non-blocking
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
