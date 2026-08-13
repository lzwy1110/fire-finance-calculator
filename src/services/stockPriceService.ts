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

  const exCh = [
    `tse_${rawCode}.tw`,
    `otc_${rawCode}.two`,
    `tse_${rawCode}A.tw`,
    `otc_${rawCode}A.two`,
    `tse_${rawCode}B.tw`,
    `otc_${rawCode}B.two`,
  ].join('|');

  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${exCh}`;
  const data = await httpGetJson(url);

  if (data && Array.isArray(data.msgArray) && data.msgArray.length > 0) {
    const validItems = data.msgArray.filter((it: any) => it && (it.z !== '-' || it.y !== '-' || it.o !== '-'));
    const item = validItems.length > 0 ? validItems[0] : data.msgArray[0];

    if (item && (item.z || item.y || item.o)) {
      const livePrice = parseFloat(item.z) || parseFloat(item.y) || parseFloat(item.o) || parseFloat(item.a?.split('_')?.[0]) || 0;
      const prevClose = parseFloat(item.y) || livePrice;
      const change = livePrice - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
      const realCode = item.c || rawCode;
      const stockName = item.n || item.nf || realCode;

      if (livePrice > 0) {
        return {
          symbol: `${realCode}.TW`,
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
  if (market === 'TW' || /^\d+[A-Za-z]?$/.test(cleanSymbol)) {
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

/**
 * 100% Dynamic Fast-Search Auto-Suggest with Official TWSE Names (ZERO Hardcoded Dictionaries)
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
  const addCandidate = (sym: string, name: string, price?: number) => {
    const key = sym.toUpperCase();
    if (!candidatesMap.has(key)) {
      candidatesMap.set(key, {
        symbol: key,
        name: name || key,
        market: mkt,
        currency: mkt === 'TW' ? 'TWD' : 'USD',
        price,
      });
    }
  };

  // 1. If TW stock code, query TWSE MIS API dynamically for official Chinese name & live price
  if (isTw) {
    try {
      const twQuote = await fetchTaiwanStockQuote(rawCode);
      if (twQuote) {
        addCandidate(twQuote.symbol, twQuote.name || `${rawCode}.TW`, twQuote.currentPrice);
      }
    } catch (e) {}
  } else {
    // 2. US Stock: query single quote dynamically
    try {
      const usQuote = await fetchSingleStockQuote(upperClean, 'US');
      if (usQuote) {
        addCandidate(usQuote.symbol, usQuote.name || upperClean, usQuote.currentPrice);
      } else {
        addCandidate(upperClean, `美股 (${upperClean})`);
      }
    } catch (e) {
      addCandidate(upperClean, `美股 (${upperClean})`);
    }
  }

  // 3. Fallback / Secondary Web Proxy Query for Desktop Web if needed
  if (candidatesMap.size === 0 && isTw) {
    try {
      const proxyUrl = `/api/quote?symbol=${encodeURIComponent(rawCode)}&market=TW`;
      const proxyData = await httpGetJson(proxyUrl);
      if (proxyData && proxyData.success && proxyData.quote) {
        const q = proxyData.quote;
        addCandidate(q.symbol, q.name || q.symbol, q.currentPrice);
      }
    } catch (e) {}
  }

  return Array.from(candidatesMap.values()).slice(0, 5);
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
