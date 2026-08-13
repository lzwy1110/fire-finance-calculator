import { CapacitorHttp } from '@capacitor/core';
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
 * Universal Native HTTP GET Request (Bypasses WebView CORS restrictions natively via Android Java)
 */
async function httpGetJson(url: string): Promise<any> {
  // 1. Try Native CapacitorHttp (Native Android Java HTTP GET)
  try {
    const res = await CapacitorHttp.get({
      url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
    });
    if (res.status === 200 && res.data) {
      return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    }
  } catch (e) {
    // Non-native web browser fallback
  }

  // 2. Fallback to direct web fetch
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const text = await res.text();
      return JSON.parse(text);
    }
  } catch (e) {}

  // 3. Fallback to Web CORS Proxies for Desktop Web Browser
  const corsProxies = [
    `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  for (const proxyUrl of corsProxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const text = await res.text();
        return JSON.parse(text);
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Fetch Live Taiwan Stock Quote via Official MIS TWSE/TPEX API
 */
async function fetchTaiwanStockQuote(symbol: string): Promise<StockQuote | null> {
  const rawCode = symbol.trim().toUpperCase().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
  if (!rawCode) return null;

  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${rawCode}.tw|otc_${rawCode}.two`;
  const data = await httpGetJson(url);

  if (data && Array.isArray(data.msgArray) && data.msgArray.length > 0) {
    const match = data.msgArray.find((it: any) => it && (it.z !== '-' || it.y !== '-' || it.o !== '-'));
    const item = match || data.msgArray[0];

    if (item) {
      const livePrice = parseFloat(item.z) || parseFloat(item.y) || parseFloat(item.o) || parseFloat(item.a?.split('_')?.[0]) || 0;
      const prevClose = parseFloat(item.y) || livePrice;
      const change = livePrice - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
      const stockName = item.n || item.nf || rawCode;

      if (livePrice > 0) {
        return {
          symbol: `${rawCode}.TW`,
          currentPrice: livePrice,
          previousClose: prevClose,
          change,
          changePercent,
          currency: 'TWD',
          name: stockName,
        };
      }
    }
  }

  return null;
}

/**
 * Fetch Single Stock Quote Dynamically (No Static Dictionaries)
 */
export async function fetchSingleStockQuote(symbol: string, market: MarketType): Promise<StockQuote | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return null;

  // 1. If Taiwan Stock, query MIS TWSE Official Real-Time API via Native HTTP / Proxy
  if (market === 'TW') {
    const twQuote = await fetchTaiwanStockQuote(cleanSymbol);
    if (twQuote && twQuote.currentPrice > 0) {
      return twQuote;
    }
  }

  // 2. US Stock or TW Fallback via Yahoo Finance Chart API
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
    const data = await httpGetJson(url);
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

  // 3. Web Proxy Fallback via Backend Serverless Route (/api/quote) to bypass CORS on Desktop Web
  try {
    const proxyUrl = `/api/quote?symbol=${encodeURIComponent(cleanSymbol)}&market=${market}`;
    const proxyData = await httpGetJson(proxyUrl);
    if (proxyData && proxyData.success && proxyData.quote && proxyData.quote.currentPrice > 0) {
      return proxyData.quote;
    }
  } catch (e) {}

  return null;
}

const POPULAR_STOCK_NAMES: Record<string, string> = {
  // 🇹🇼 台股熱門標的
  '0050': '元大台灣50',
  '0050.TW': '元大台灣50',
  '0056': '元大高股息',
  '0056.TW': '元大高股息',
  '00878': '國泰永續高股息',
  '00878.TW': '國泰永續高股息',
  '00919': '群益台灣精選高息',
  '00919.TW': '群益台灣精選高息',
  '00929': '復華台灣科技優息',
  '00929.TW': '復華台灣科技優息',
  '00940': '元大台灣價值高息',
  '00940.TW': '元大台灣價值高息',
  '00981A': '中信上游半導體',
  '00981A.TW': '中信上游半導體',
  '00713': '元大台灣高息低波',
  '00713.TW': '元大台灣高息低波',
  '006208': '富邦台50',
  '006208.TW': '富邦台50',
  '2330': '台積電',
  '2330.TW': '台積電',
  '2317': '鴻海',
  '2317.TW': '鴻海',
  '2454': '聯發科',
  '2454.TW': '聯發科',
  '2308': '台達電',
  '2308.TW': '台達電',
  '2382': '廣達',
  '2382.TW': '廣達',
  '3008': '大立光',
  '3008.TW': '大立光',
  '2881': '富邦金',
  '2881.TW': '富邦金',
  '2882': '國泰金',
  '2882.TW': '國泰金',
  '2891': '中信金',
  '2891.TW': '中信金',
  '2886': '兆豐金',
  '2886.TW': '兆豐金',
  '2603': '長榮',
  '2603.TW': '長榮',

  // 🇺🇸 美股熱門標的
  'AAPL': 'Apple Inc. (蘋果)',
  'NVDA': 'NVIDIA Corporation (輝達)',
  'TSLA': 'Tesla Inc. (特斯拉)',
  'MSFT': 'Microsoft Corporation (微軟)',
  'GOOGL': 'Alphabet Inc. (Google)',
  'GOOG': 'Alphabet Inc. (Google)',
  'AMZN': 'Amazon.com Inc. (亞馬遜)',
  'META': 'Meta Platforms Inc. (臉書)',
  'AMD': 'Advanced Micro Devices (超微)',
  'SPY': 'SPDR S&P 500 ETF Trust',
  'VOO': 'Vanguard S&P 500 ETF',
  'QQQ': 'Invesco QQQ Trust (納斯達克100)',
  'VT': 'Vanguard Total World Stock ETF',
  'VTI': 'Vanguard Total Stock Market ETF',
};

/**
 * 100% Dynamic Fast-Search Auto-Suggest with Prefix Matching and Real-Time Query
 */
export async function searchStockSuggestionsAsync(
  keyword: string,
  targetMarket: MarketType = 'US'
): Promise<StockSearchResult[]> {
  const clean = keyword.trim();
  if (!clean) return [];

  const upperClean = clean.toUpperCase();
  const rawCode = upperClean.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
  const isTw = targetMarket === 'TW' || /^\d+[A-Za-z]?$/.test(clean);
  const mkt: MarketType = isTw ? 'TW' : 'US';

  const candidatesMap = new Map<string, StockSearchResult>();

  // Helper to register candidates
  const addCandidate = (sym: string, name: string) => {
    const key = sym.toUpperCase();
    if (!candidatesMap.has(key)) {
      candidatesMap.set(key, {
        symbol: key,
        name: name || key,
        market: mkt,
        currency: mkt === 'TW' ? 'TWD' : 'USD',
      });
    }
  };

  // 1. Direct typed candidate
  const mainSym = isTw && !upperClean.endsWith('.TW') ? `${rawCode}.TW` : upperClean;
  const defaultName = POPULAR_STOCK_NAMES[rawCode] || POPULAR_STOCK_NAMES[upperClean] || POPULAR_STOCK_NAMES[mainSym] || `${mkt === 'TW' ? '台股' : '美股'} (${mainSym})`;
  addCandidate(mainSym, defaultName);

  // 2. Prefix matching in POPULAR_STOCK_NAMES (e.g. typing "00981" matches "00981A")
  for (const [key, name] of Object.entries(POPULAR_STOCK_NAMES)) {
    const keyUpper = key.toUpperCase();
    const cleanKey = keyUpper.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    if (cleanKey.startsWith(rawCode) || name.includes(clean)) {
      const sym = isTw && !keyUpper.endsWith('.TW') ? `${cleanKey}.TW` : keyUpper;
      addCandidate(sym, name);
    }
  }

  // 3. Dynamic Real-Time Yahoo Finance Search Endpoint
  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(rawCode)}&quotesCount=6&newsCount=0`;
    const searchData = await httpGetJson(searchUrl);
    if (searchData && Array.isArray(searchData.quotes)) {
      for (const q of searchData.quotes) {
        if (!q || !q.symbol) continue;
        const qSym = q.symbol.toUpperCase();
        if (mkt === 'TW' && (qSym.endsWith('.TW') || qSym.endsWith('.TWO') || /^\d+[A-Za-z]?$/.test(qSym))) {
          const normSym = qSym.endsWith('.TW') || qSym.endsWith('.TWO') ? qSym : `${qSym}.TW`;
          addCandidate(normSym, q.shortname || q.longname || qSym);
        } else if (mkt === 'US' && !qSym.includes('.')) {
          addCandidate(qSym, q.shortname || q.longname || qSym);
        }
      }
    }
  } catch (e) {}

  const results = Array.from(candidatesMap.values()).slice(0, 5);

  // 4. Fetch live quotes for candidates concurrently to attach real-time prices
  await Promise.all(
    results.map(async (item) => {
      try {
        const quote = await fetchSingleStockQuote(item.symbol, item.market);
        if (quote && quote.currentPrice > 0) {
          item.price = quote.currentPrice;
          if (quote.name && quote.name !== item.symbol) {
            item.name = quote.name;
          }
        }
      } catch (e) {}
    })
  );

  return results;
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
