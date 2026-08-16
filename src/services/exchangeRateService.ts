import { Capacitor, CapacitorHttp } from '@capacitor/core';

const CACHE_KEY_USD_RATE = 'fire_cached_usd_rate';
const DEFAULT_USD_RATE = 32.0;

/**
 * Universal Native HTTP GET Request (Bypasses WebView CORS restrictions on Android natively)
 */
async function fetchJsonSafely(url: string, timeoutMs = 3000): Promise<any> {
  // 1. Native CapacitorHttp for Android APK
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
    // Non-native fallback
  }

  // 2. Direct Web Fetch
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}

  // 3. Web CORS Proxy Fallback
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}

  return null;
}

/**
 * Fetch live USD/TWD exchange rate once on startup
 */
export async function fetchLiveUsdRate(): Promise<number> {
  // 1. Try free open.er-api.com
  try {
    const data = await fetchJsonSafely('https://open.er-api.com/v6/latest/USD', 2500);
    if (data && data.rates && typeof data.rates.TWD === 'number' && data.rates.TWD > 20 && data.rates.TWD < 50) {
      const rate = Number(data.rates.TWD.toFixed(2));
      localStorage.setItem(CACHE_KEY_USD_RATE, rate.toString());
      return rate;
    }
  } catch (e) {}

  // 2. Try Yahoo Finance USDTWD=X
  try {
    const data = await fetchJsonSafely(
      'https://query1.finance.yahoo.com/v8/finance/chart/USDTWD=X?interval=1d&range=1d',
      2500
    );
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price === 'number' && price > 20 && price < 50) {
      const rate = Number(price.toFixed(2));
      localStorage.setItem(CACHE_KEY_USD_RATE, rate.toString());
      return rate;
    }
  } catch (e) {}

  // 3. Fallback to cached rate or default
  try {
    const cached = localStorage.getItem(CACHE_KEY_USD_RATE);
    if (cached) {
      const parsed = parseFloat(cached);
      if (!isNaN(parsed) && parsed > 20 && parsed < 50) {
        return parsed;
      }
    }
  } catch (e) {}

  return DEFAULT_USD_RATE;
}
