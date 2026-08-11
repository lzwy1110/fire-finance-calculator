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
    console.warn('CapacitorHttp error, trying web fetch fallback:', e);
  }

  // 2. Fallback to web fetch
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const text = await res.text();
      return JSON.parse(text);
    }
  } catch (e) {
    console.warn('Web fetch error:', e);
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

  // 1. If Taiwan Stock, query MIS TWSE Official Real-Time API via Native HTTP
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

  return null;
}

/**
 * 100% Dynamic Pure Search Auto-Suggest (Zero Hardcoded Dictionaries)
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
  const sym = isTw && !upperClean.endsWith('.TW') ? `${rawCode}.TW` : upperClean;
  const mkt: MarketType = isTw ? 'TW' : 'US';

  const results: StockSearchResult[] = [];

  // Query live quote dynamically for typed symbol
  const quote = await fetchSingleStockQuote(sym, mkt);

  if (quote && quote.currentPrice > 0) {
    results.push({
      symbol: quote.symbol,
      name: quote.name || sym,
      market: mkt,
      currency: mkt === 'TW' ? 'TWD' : 'USD',
      price: quote.currentPrice,
    });
  } else {
    // If live quote pending, present clean candidate
    results.push({
      symbol: sym,
      name: `${mkt === 'TW' ? '台股' : '美股'} (${sym})`,
      market: mkt,
      currency: mkt === 'TW' ? 'TWD' : 'USD',
    });
  }

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
