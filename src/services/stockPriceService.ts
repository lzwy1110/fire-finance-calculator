import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { MarketType } from '../types/portfolio';

export interface StockQuote {
  symbol: string;
  currentPrice: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  currency: 'USD' | 'TWD';
  name?: string;
  sparkline?: number[];
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
  // 1. Try Native CapacitorHttp on native Android/iOS
  if (Capacitor.isNativePlatform()) {
    try {
      const requestUrl = url.startsWith('/') && typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
      const res = await CapacitorHttp.get({
        url: requestUrl,
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
  }

  // 2. Direct web fetch
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const text = await res.text();
      return JSON.parse(text);
    }
  } catch (e) {}

  // 3. Resilient Multi-Proxy Fallback for Desktop Web Browser ONLY for ABSOLUTE HTTP URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const corsProxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://corsproxy.org/?${encodeURIComponent(url)}`,
    ];
    for (const proxy of corsProxies) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(proxy, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const text = await res.text();
          return JSON.parse(text);
        }
      } catch (err) {}
    }
  }

  return null;
}

/**
 * Fetch Live Taiwan Stock Quote via Official MIS TWSE/TPEX API
 */
async function fetchTaiwanStockQuote(symbol: string): Promise<StockQuote | null> {
  const rawCode = symbol.trim().toUpperCase().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
  if (!rawCode) return null;

  const suffixes = ['', 'L', 'R', 'U', 'K', 'A', 'B', 'C'];
  const channels: string[] = [];
  for (const s of suffixes) {
    channels.push(`tse_${rawCode}${s}.tw`);
    channels.push(`otc_${rawCode}${s}.tw`);
  }
  const exCh = channels.join('|');

  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${exCh}`;
  const data = await httpGetJson(url);

  if (data && Array.isArray(data.msgArray) && data.msgArray.length > 0) {
    const validItems = data.msgArray.filter((it: any) => Boolean(it && it.c && (it.n || it.nf)));
    const item = validItems.length > 0 ? validItems[0] : null;

    if (item) {
      const parseNum = (v: any) => {
        if (!v || v === '-') return null;
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      };

      const rawZ = parseNum(item.z); // Latest traded price
      const rawB = parseNum(item.b?.split('_')?.[0]); // Best bid
      const rawA = parseNum(item.a?.split('_')?.[0]); // Best ask
      const rawH = parseNum(item.h); // High
      const rawL = parseNum(item.l); // Low
      const rawO = parseNum(item.o); // Open
      const rawY = parseNum(item.y); // Yesterday close

      // Prioritize actual live traded price > top bid/ask > day range > yesterday close
      const livePrice = rawZ ?? rawB ?? rawA ?? rawH ?? rawL ?? rawO ?? rawY ?? 0;
      const prevClose = rawY ?? livePrice;
      const change = livePrice - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
      const realCode = item.c || rawCode;
      const stockName = item.n || item.nf || realCode;
      const isOtc = item.ex === 'otc';
      const normSym = `${realCode}.${isOtc ? 'TWO' : 'TW'}`;

      if (livePrice > 0 || stockName) {
        return {
          symbol: normSym,
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

  // 1. If Taiwan Stock, query MIS TWSE Official Real-Time API for instant live price
  let twLiveQuote: StockQuote | null = null;
  if (market === 'TW' || /^\d+[A-Za-z]?$/.test(cleanSymbol)) {
    twLiveQuote = await fetchTaiwanStockQuote(cleanSymbol);
  }

  // 2. US Stock or TW Fallback via Yahoo Finance Live Minute / Intraday Chart API (also retrieves intraday sparkline)
  const rawCode = cleanSymbol.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
  const isTw = market === 'TW' || cleanSymbol.endsWith('.TW') || cleanSymbol.endsWith('.TWO') || /^\d+[A-Za-z]?$/.test(cleanSymbol);

  let symbolsToTry = [cleanSymbol];
  if (isTw) {
    if (cleanSymbol.endsWith('.TWO')) {
      symbolsToTry = [`${rawCode}.TWO`, `${rawCode}.TW`];
    } else {
      symbolsToTry = [`${rawCode}.TW`, `${rawCode}.TWO`];
    }
  }

  for (const sym of symbolsToTry) {
    const endpoints = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=5m&includePrePost=true`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=5m&includePrePost=true`,
      `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`,
    ];

    for (const url of endpoints) {
      const data = await httpGetJson(url);
      const meta = data?.chart?.result?.[0]?.meta;
      const quote = data?.chart?.result?.[0]?.indicators?.quote?.[0];
      const validCloses = (quote?.close || []).filter((c: any) => typeof c === 'number' && c > 0);
      const lastCandleClose = validCloses.length > 0 ? validCloses[validCloses.length - 1] : 0;

      if (meta && (meta.regularMarketPrice > 0 || lastCandleClose > 0 || (twLiveQuote && twLiveQuote.currentPrice > 0))) {
        const currentPrice = (twLiveQuote && twLiveQuote.currentPrice > 0)
          ? twLiveQuote.currentPrice
          : (lastCandleClose > 0 ? lastCandleClose : meta.regularMarketPrice);
        const previousClose = (twLiveQuote && twLiveQuote.previousClose)
          ? twLiveQuote.previousClose
          : (meta.chartPreviousClose || meta.previousClose || currentPrice);
        const change = currentPrice - previousClose;
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
        const stockName = (twLiveQuote && twLiveQuote.name) ? twLiveQuote.name : (meta.shortName || meta.longName || cleanSymbol);

        let sparkline: number[] | undefined;
        if (validCloses.length >= 2) {
          const step = Math.max(1, Math.floor(validCloses.length / 24));
          sparkline = [];
          for (let i = 0; i < validCloses.length; i += step) {
            sparkline.push(Math.round(validCloses[i] * 100) / 100);
          }
          if (sparkline[sparkline.length - 1] !== Math.round(currentPrice * 100) / 100) {
            sparkline.push(Math.round(currentPrice * 100) / 100);
          }
        }

        return {
          symbol: isTw ? (cleanSymbol.includes('.') ? cleanSymbol : `${cleanSymbol}.TW`) : sym,
          currentPrice: Math.round(currentPrice * 100) / 100,
          previousClose: Math.round(previousClose * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round(changePercent * 100) / 100,
          currency: isTw ? 'TWD' : 'USD',
          name: stockName,
          sparkline,
        };
      }
    }
  }

  // If Yahoo was unreachable but TWSE live quote succeeded
  if (twLiveQuote && twLiveQuote.currentPrice > 0) {
    return twLiveQuote;
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
 * 100% Dynamic Live Stock Search Auto-Suggest (ZERO Static Dictionaries)
 * Option C: Accelerates Desktop Web Browser Search using Promise.race (Serverless Proxy vs Direct CORS Proxy)
 */
export async function searchStockSuggestionsAsync(
  keyword: string,
  targetMarket: MarketType = 'US'
): Promise<StockSearchResult[]> {
  const clean = keyword.trim();
  if (!clean) return [];

  const upperClean = clean.toUpperCase();
  const rawCode = upperClean.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
  const hasChinese = /[\u4e00-\u9fa5]/.test(clean);
  const isTw = targetMarket === 'TW' || /^\d+[A-Za-z]?$/.test(clean) || hasChinese;
  const mkt: MarketType = isTw ? 'TW' : 'US';
  const isNative = Capacitor.isNativePlatform();

  // 1. Chinese Keyword Live Search via Official TWSE & TPEX OpenAPI (Zero Hardcoded Dictionaries)
  if (hasChinese) {
    try {
      const proxyUrl = `/api/search?keyword=${encodeURIComponent(clean)}&market=TW`;
      const proxyRes = await httpGetJson(proxyUrl);
      if (proxyRes && proxyRes.success && Array.isArray(proxyRes.results) && proxyRes.results.length > 0) {
        return proxyRes.results.slice(0, 8);
      }
    } catch (e) {}

    // Fallback: Query official TWSE/TPEX OpenAPI directly on client/native
    try {
      const [twseData, tpexData] = await Promise.all([
        httpGetJson('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
        httpGetJson('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes'),
      ]);

      const matches: StockSearchResult[] = [];
      if (Array.isArray(twseData)) {
        const filtered = twseData.filter((it: any) => it && it.Code && it.Name && it.Name.includes(clean));
        for (const it of filtered) {
          matches.push({
            symbol: `${it.Code}.TW`,
            name: it.Name,
            price: parseFloat(it.ClosingPrice) || 0,
            market: 'TW',
            currency: 'TWD',
          });
        }
      }
      if (Array.isArray(tpexData)) {
        const filtered = tpexData.filter(
          (it: any) => it && it.SecuritiesCompanyCode && it.CompanyName && it.CompanyName.includes(clean)
        );
        for (const it of filtered) {
          matches.push({
            symbol: `${it.SecuritiesCompanyCode}.TWO`,
            name: it.CompanyName,
            price: parseFloat(it.Close) || 0,
            market: 'TW',
            currency: 'TWD',
          });
        }
      }

      matches.sort((a, b) => a.symbol.split('.')[0].length - b.symbol.split('.')[0].length);
      if (matches.length > 0) return matches.slice(0, 8);
    } catch (e) {}

    return [];
  }

  // 2. Mobile Android Native App: Direct Official TWSE MIS API Query via Native Java HTTP (0.05s)
  if (isNative && isTw) {
    try {
      const twQuote = await fetchTaiwanStockQuote(rawCode);
      if (twQuote && twQuote.name) {
        return [
          {
            symbol: twQuote.symbol,
            name: twQuote.name,
            market: 'TW',
            currency: 'TWD',
            price: twQuote.currentPrice,
          },
        ];
      }
    } catch (e) {}
  }

  // 3. Desktop Web Browser: Promise.race Acceleration (Races Serverless Proxy vs Direct CORS Proxy)
  const reqServerless = (async (): Promise<StockSearchResult[]> => {
    try {
      const proxyUrl = `/api/search?keyword=${encodeURIComponent(rawCode)}&market=${mkt}`;
      const proxyRes = await httpGetJson(proxyUrl);
      if (proxyRes && proxyRes.success && Array.isArray(proxyRes.results) && proxyRes.results.length > 0) {
        return proxyRes.results.slice(0, 6);
      }
    } catch (e) {}
    return [];
  })();

  const reqDirect = (async (): Promise<StockSearchResult[]> => {
    if (isTw) {
      try {
        const twQuote = await fetchTaiwanStockQuote(rawCode);
        if (twQuote && twQuote.name) {
          return [
            {
              symbol: twQuote.symbol,
              name: twQuote.name,
              market: 'TW',
              currency: 'TWD',
              price: twQuote.currentPrice,
            },
          ];
        }
      } catch (e) {}
    } else {
      try {
        const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(upperClean)}&quotesCount=6`;
        const yahooRes = await httpGetJson(yahooUrl);
        if (yahooRes && Array.isArray(yahooRes.quotes) && yahooRes.quotes.length > 0) {
          const matches: StockSearchResult[] = [];
          for (const q of yahooRes.quotes) {
            if (!q || !q.symbol) continue;
            const qSym = q.symbol.toUpperCase();
            if (!qSym.includes('.')) {
              matches.push({
                symbol: qSym,
                name: q.shortname || q.longname || qSym,
                market: 'US',
                currency: 'USD',
              });
            }
          }
          if (matches.length > 0) return matches.slice(0, 6);
        }
      } catch (e) {}
    }
    return [];
  })();

  try {
    const winner = await Promise.race([
      reqServerless.then((res) => (res.length > 0 ? res : new Promise<StockSearchResult[]>(() => {}))),
      reqDirect.then((res) => (res.length > 0 ? res : new Promise<StockSearchResult[]>(() => {}))),
      new Promise<StockSearchResult[]>((resolve) => setTimeout(() => resolve([]), 9000)),
    ]);

    if (Array.isArray(winner) && winner.length > 0) {
      return winner;
    }
  } catch (e) {}

  // Fallback check if race timed out
  const [sRes, dRes] = await Promise.all([reqServerless, reqDirect]);
  if (sRes.length > 0) return sRes;
  if (dRes.length > 0) return dRes;

  return [];
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

export interface CandleData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockChartData {
  symbol: string;
  range: string;
  interval: string;
  candles: CandleData[];
}

/**
 * Fetch Historical Stock Chart & Candlestick Data Dynamically
 */
export async function fetchStockHistoricalChart(
  symbol: string,
  range: string = '1y',
  interval: string = '1d'
): Promise<StockChartData | null> {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return null;

  const rawCode = clean.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
  let yahooSymbol = clean;
  if (/^\d+[A-Za-z]?$/.test(clean)) {
    yahooSymbol = `${rawCode}.TW`;
  }

  // 1. Try serverless backend proxy /api/chart (Web)
  try {
    const proxyUrl = `/api/chart?symbol=${encodeURIComponent(yahooSymbol)}&range=${range}&interval=${interval}`;
    const data = await httpGetJson(proxyUrl);
    if (data && data.success && Array.isArray(data.candles) && data.candles.length > 0) {
      return data;
    }
  } catch (e) {}

  // 2. Try direct / proxy endpoints with both .TW and .TWO if needed
  const symbolsToTry = [yahooSymbol];
  if (clean.endsWith('.TW')) symbolsToTry.push(`${rawCode}.TWO`);
  else if (clean.endsWith('.TWO')) symbolsToTry.push(`${rawCode}.TW`);

  for (const sym of symbolsToTry) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${range}&interval=${interval}`;
    const data = await httpGetJson(url);
    const result = data?.chart?.result?.[0];
    if (result) {
      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];
      const closes = quote.close || [];
      const volumes = quote.volume || [];

      const candles: CandleData[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (
          typeof opens[i] === 'number' &&
          typeof highs[i] === 'number' &&
          typeof lows[i] === 'number' &&
          typeof closes[i] === 'number'
        ) {
          candles.push({
            time: timestamps[i],
            open: Math.round(opens[i] * 100) / 100,
            high: Math.round(highs[i] * 100) / 100,
            low: Math.round(lows[i] * 100) / 100,
            close: Math.round(closes[i] * 100) / 100,
            volume: volumes[i] || 0,
          });
        }
      }
      if (candles.length > 0) {
        return {
          symbol: sym,
          range,
          interval,
          candles,
        };
      }
    }
  }

  return null;
}
