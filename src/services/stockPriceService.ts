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

// Comprehensive Stock Name Mapping
export const KNOWN_STOCK_NAMES: Record<string, string> = {
  // TW Stocks & ETFs
  '2377': '微星 (MSI)',
  '2377.TW': '微星 (MSI)',
  '2408': '南亞科',
  '2408.TW': '南亞科',
  '2344': '華邦電',
  '2344.TW': '華邦電',
  '2327': '國巨',
  '2327.TW': '國巨',
  '3026': '禾伸堂',
  '3026.TW': '禾伸堂',
  '00981A': '統一台灣高息',
  '00981A.TW': '統一台灣高息',
  '2330': '台積電 (TSMC)',
  '2330.TW': '台積電 (TSMC)',
  '0050': '元大台灣50 ETF',
  '0050.TW': '元大台灣50 ETF',
  '0056': '元大高股息 ETF',
  '0056.TW': '元大高股息 ETF',
  '00878': '國泰永續高股息 ETF',
  '00878.TW': '國泰永續高股息 ETF',
  '00919': '群益台灣精選高息 ETF',
  '00919.TW': '群益台灣精選高息 ETF',
  '00929': '復華台灣科技優息 ETF',
  '00929.TW': '復華台灣科技優息 ETF',
  '00940': '元大台灣價值高息 ETF',
  '00940.TW': '元大台灣價值高息 ETF',
  '2317': '鴻海精密',
  '2317.TW': '鴻海精密',
  '2454': '聯發科',
  '2454.TW': '聯發科',
  '2308': '台達電',
  '2308.TW': '台達電',
  '2382': '廣達電腦',
  '2382.TW': '廣達電腦',
  '2301': '光寶科技',
  '2301.TW': '光寶科技',
  '3231': '緯創資通',
  '3231.TW': '緯創資通',
  '6669': '緯穎科技',
  '6669.TW': '緯穎科技',
  '2603': '長榮海運',
  '2603.TW': '長榮海運',
  '2609': '陽明海運',
  '2609.TW': '陽明海運',
  '2615': '萬海航運',
  '2615.TW': '萬海航運',
  '2881': '富邦金控',
  '2881.TW': '富邦金控',
  '2882': '國泰金控',
  '2882.TW': '國泰金控',
  '2886': '兆豐金控',
  '2886.TW': '兆豐金控',
  '2891': '中信金控',
  '2891.TW': '中信金控',
  '2409': '友達光電',
  '2409.TW': '友達光電',
  '3481': '群創光電',
  '3481.TW': '群創光電',
  '2303': '聯華電子',
  '2303.TW': '聯華電子',
  '2357': '華碩電腦',
  '2357.TW': '華碩電腦',
  '2353': '宏碁',
  '2353.TW': '宏碁',
  '2356': '英業達',
  '2356.TW': '英業達',
  '3008': '大立光',
  '3008.TW': '大立光',
  '2449': '京元電子',
  '2449.TW': '京元電子',

  // US Stocks & ETFs
  'NVDA': '輝達 (NVIDIA)',
  'VOO': 'Vanguard S&P 500 ETF',
  'AAPL': '蘋果 (Apple)',
  'ASTS': 'AST SpaceMobile',
  'SPCX': 'SpaceX 相關 ETF',
  'TSLA': '特斯拉 (Tesla)',
  'QQQ': '納斯達克100 ETF',
  'MSFT': '微軟 (Microsoft)',
  'AMZN': '亞馬遜 (Amazon)',
  'GOOGL': 'Alphabet (Google)',
  'META': 'Meta (臉書)',
  'AMD': '超微 (AMD)',
  'PLTR': 'Palantir',
  'SMCI': '美超微 (Super Micro)',
  'RKLB': 'Rocket Lab',
};

export const POPULAR_STOCKS_DB: StockSearchResult[] = Object.entries(KNOWN_STOCK_NAMES).map(([key, name]) => {
  const isTW = key.endsWith('.TW') || /^\d+[A-Za-z]?$/.test(key);
  const symbol = isTW && !key.endsWith('.TW') ? `${key}.TW` : key;
  return {
    symbol,
    name,
    market: isTW ? 'TW' : 'US',
    currency: isTW ? 'TWD' : 'USD',
  };
});

/**
 * Official MIS TWSE / TPEX Real-Time Taiwan Stock Quote Fetcher
 */
async function fetchTaiwanStockQuote(symbol: string): Promise<StockQuote | null> {
  const rawCode = symbol.trim().toUpperCase().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
  if (!rawCode) return null;

  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${rawCode}.tw|otc_${rawCode}.two`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const items = data?.msgArray;

      if (Array.isArray(items) && items.length > 0) {
        const match = items.find((it: any) => it && (it.z !== '-' || it.y !== '-' || it.o !== '-'));
        const item = match || items[0];

        if (item) {
          const livePrice = parseFloat(item.z) || parseFloat(item.y) || parseFloat(item.o) || parseFloat(item.a?.split('_')?.[0]) || 0;
          const prevClose = parseFloat(item.y) || livePrice;
          const change = livePrice - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
          const resolvedName = KNOWN_STOCK_NAMES[rawCode] || item.n || item.nf || rawCode;

          if (livePrice > 0) {
            return {
              symbol: `${rawCode}.TW`,
              currentPrice: livePrice,
              previousClose: prevClose,
              change,
              changePercent,
              currency: 'TWD',
              name: resolvedName,
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn(`MIS TWSE Fetch error for ${rawCode}:`, e);
  }

  return null;
}

/**
 * Fetch Single Stock Quote (Official TWSE MIS for TW, Direct Yahoo Chart for US)
 */
export async function fetchSingleStockQuote(symbol: string, market: MarketType): Promise<StockQuote | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return null;

  // 1. If Taiwan Stock, query MIS TWSE Official Real-Time API
  if (market === 'TW') {
    const twQuote = await fetchTaiwanStockQuote(cleanSymbol);
    if (twQuote && twQuote.currentPrice > 0) {
      return twQuote;
    }
  }

  // 2. Query Yahoo Finance Direct Endpoints
  const rawCode = cleanSymbol.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
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
          const resolvedName = KNOWN_STOCK_NAMES[rawCode] || KNOWN_STOCK_NAMES[yahooSymbol] || meta.shortName || meta.longName || cleanSymbol;

          return {
            symbol: cleanSymbol,
            currentPrice,
            previousClose,
            change,
            changePercent,
            currency: market === 'TW' ? 'TWD' : 'USD',
            name: resolvedName,
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
 * Fast Search Auto-Suggest with Instant Real-Time Quote Resolution
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

  // 1. Search Built-in Known Names Dictionary
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

  // 2. Candidate Fallback Generation for typed code
  const isTw = targetMarket === 'TW' || /^\d+[A-Za-z]?$/.test(clean);
  const sym = isTw && !upperClean.endsWith('.TW') ? `${rawCode}.TW` : upperClean;
  const mkt: MarketType = isTw ? 'TW' : 'US';
  const resolvedName = KNOWN_STOCK_NAMES[rawCode] || KNOWN_STOCK_NAMES[sym] || `${mkt === 'TW' ? '台股' : '美股'} (${sym})`;

  if (!seen.has(sym.toUpperCase()) && (!targetMarket || mkt === targetMarket)) {
    addResult({
      symbol: sym,
      name: resolvedName,
      market: mkt,
      currency: isTw ? 'TWD' : 'USD',
    });
  }

  // 3. Fetch Live Quote for top candidate
  if (results.length > 0) {
    const topItem = results[0];
    try {
      const quote = await fetchSingleStockQuote(topItem.symbol, topItem.market);
      if (quote && quote.currentPrice > 0) {
        topItem.price = quote.currentPrice;
        if (quote.name && (topItem.name.startsWith('台股') || topItem.name.startsWith('美股'))) {
          topItem.name = quote.name;
        }
      }
    } catch (e) {
      // Non-blocking
    }
  }

  return results.slice(0, 8);
}

/**
 * Fetch quotes for multiple stocks concurrently with key alias matching
 */
export async function batchFetchStockQuotes(
  stocks: { symbol: string; market: MarketType }[]
): Promise<Record<string, StockQuote>> {
  const results: Record<string, StockQuote> = {};

  const promises = stocks.map(async (s) => {
    const quote = await fetchSingleStockQuote(s.symbol, s.market);
    if (quote) {
      const symUpper = s.symbol.toUpperCase();
      const rawCode = symUpper.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');

      results[symUpper] = quote;
      results[rawCode] = quote;
      results[`${rawCode}.TW`] = quote;
      results[`${rawCode}.TWO`] = quote;
    }
  });

  await Promise.allSettled(promises);
  return results;
}
