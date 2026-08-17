import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

let supabaseInstance: SupabaseClient | null = null;

export function cleanSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/rest\/v1$/i, '');
  url = url.replace(/\/rest\/v1\/$/i, '');
  return url.replace(/\/+$/, '');
}

export function getSupabaseClient(): SupabaseClient | null {
  const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const supabaseUrl = cleanSupabaseUrl(rawUrl);
  const supabaseKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR_SUPABASE') || supabaseKey.includes('YOUR_SUPABASE') || supabaseUrl.includes('your-project')) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
    } catch (err) {
      console.error('[Supabase Client Error]:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null;
}

const app = express();

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/api/health', async (req: Request, res: Response) => {
  const configured = isSupabaseConfigured();
  let dbStatus = 'disconnected';
  let message = 'Supabase 憑證未配置 (可於前端輸入憑證或在 Vercel 環境變數中設定)';

  if (configured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.from('fire_configs').select('sync_code').limit(1);
        if (!error) {
          dbStatus = 'connected';
          message = 'Vercel Serverless API + Supabase 資料庫連線正常！';
        } else {
          dbStatus = 'error';
          message = `Supabase 測試異常: ${error.message}`;
        }
      } catch (err: any) {
        dbStatus = 'error';
        message = `Supabase 連線失敗: ${err.message || err}`;
      }
    }
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabase: {
      configured,
      dbStatus,
      message,
    },
  });
});

app.get('/api/data', async (req: Request, res: Response) => {
  const syncCode = (req.query.syncCode as string) || 'FIRE-DEFAULT-2026';
  const supabase = getSupabaseClient();

  if (!supabase) {
    return res.json({
      success: false,
      mode: 'offline',
      message: 'Supabase 未配置，使用前端直連或 LocalStorage 模式',
    });
  }

  try {
    const [txRes, catRes, configRes, presetRes, portRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('sync_code', syncCode).order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('sync_code', syncCode),
      supabase.from('fire_configs').select('*').eq('sync_code', syncCode).maybeSingle(),
      supabase.from('quick_presets').select('*').eq('sync_code', syncCode),
      supabase.from('portfolio_stocks').select('*').eq('sync_code', syncCode),
    ]);

    const transactions = (txRes.data || []).map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      mainCategory: t.main_category,
      subCategory: t.sub_category,
      date: t.date,
      note: t.note,
      tags: t.tags || [],
      isQuickPreset: t.is_quick_preset,
    }));

    const categories = (catRes.data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
      subCategories: c.sub_categories || [],
    }));

    let fireConfig = null;
    if (configRes.data) {
      const cfg = configRes.data;
      const cashSavingsTWD = Number(cfg.cash_savings ?? cfg.current_net_worth ?? 0);
      const cashSavingsUSD = Number(cfg.cash_savings_usd ?? 0);
      const usdRate = Number(cfg.usd_rate ?? 32.0);
      const baseCashBalance = Number(cfg.base_cash_balance ?? cfg.cash_savings ?? cashSavingsTWD);

      fireConfig = {
        currentAge: Number(cfg.current_age),
        targetRetirementAge: Number(cfg.target_retirement_age),
        currentNetWorth: Number(cfg.current_net_worth),
        cashSavings: cashSavingsTWD,
        cashSavingsTWD: cashSavingsTWD,
        cashSavingsUSD: cashSavingsUSD,
        usdRate: usdRate > 0 ? usdRate : 32.0,
        baseCashBalance: baseCashBalance,
        monthlyIncome: Number(cfg.monthly_income),
        monthlyExpenses: Number(cfg.monthly_expenses),
        monthlyTax: Number(cfg.monthly_tax),
        monthlyInvestment: Number(cfg.monthly_investment),
        targetAnnualExpensePostRetirement: Number(cfg.target_annual_expense_post_retirement),
        expectedInvestmentReturnRate: Number(cfg.expected_investment_return_rate),
        expectedInflationRate: Number(cfg.expected_inflation_rate),
        safeWithdrawalRate: Number(cfg.safe_withdrawal_rate),
        currencySymbol: cfg.currency_symbol || 'NT$',
        themeColor: cfg.theme_color || 'cyan',
      };
    }

    const quickPresets = (presetRes.data || []).map((p: any) => ({
      id: p.id,
      label: p.label,
      mainCategory: p.main_category,
      subCategory: p.sub_category,
      amount: Number(p.amount),
      icon: p.icon,
    }));

    let portfolioStocks = (portRes.data || []).map((s: any) => ({
      id: String(s.id),
      symbol: String(s.symbol || ''),
      name: String(s.name || s.symbol || ''),
      market: s.market || 'US',
      shares: Number(s.shares) || 0,
      avgCost: Number(s.avg_cost) || 0,
      currentPrice: Number(s.current_price) || 0,
      currency: s.currency || 'USD',
      transactions: Array.isArray(s.transactions)
        ? s.transactions
        : typeof s.transactions === 'string'
        ? (() => {
            try {
              return JSON.parse(s.transactions);
            } catch (e) {
              return [];
            }
          })()
        : [],
    }));

    return res.json({
      success: true,
      mode: 'supabase',
      syncCode,
      data: {
        transactions: txRes.error ? null : transactions,
        categories: catRes.error ? null : (categories.length > 0 ? categories : null),
        fireConfig,
        quickPresets: presetRes.error ? null : (quickPresets.length > 0 ? quickPresets : null),
        portfolioStocks: portRes.error ? null : portfolioStocks,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || err });
  }
});

app.post('/api/data/sync', async (req: Request, res: Response) => {
  const { syncCode, transactions, categories, fireConfig, quickPresets, portfolioStocks } = req.body;
  const targetSyncCode = syncCode || 'FIRE-DEFAULT-2026';
  const supabase = getSupabaseClient();

  if (!supabase) {
    return res.json({
      success: false,
      mode: 'offline',
      message: 'Supabase 未連線',
    });
  }

  try {
    if (fireConfig) {
      const configRow = {
        sync_code: targetSyncCode,
        current_age: fireConfig.currentAge,
        target_retirement_age: fireConfig.targetRetirementAge,
        current_net_worth: fireConfig.currentNetWorth,
        cash_savings: fireConfig.cashSavingsTWD != null ? fireConfig.cashSavingsTWD : (fireConfig.cashSavings || 0),
        cash_savings_usd: fireConfig.cashSavingsUSD != null ? fireConfig.cashSavingsUSD : 0,
        usd_rate: fireConfig.usdRate != null ? fireConfig.usdRate : 32.0,
        base_cash_balance: fireConfig.baseCashBalance != null ? fireConfig.baseCashBalance : 0,
        monthly_income: fireConfig.monthlyIncome,
        monthly_expenses: fireConfig.monthlyExpenses,
        monthly_tax: fireConfig.monthlyTax,
        monthly_investment: fireConfig.monthlyInvestment,
        target_annual_expense_post_retirement: fireConfig.targetAnnualExpensePostRetirement,
        expected_investment_return_rate: fireConfig.expectedInvestmentReturnRate,
        expected_inflation_rate: fireConfig.expectedInflationRate,
        safe_withdrawal_rate: fireConfig.safeWithdrawalRate,
        currency_symbol: fireConfig.currencySymbol || 'NT$',
        theme_color: fireConfig.themeColor || 'cyan',
        updated_at: new Date().toISOString(),
      };
      await supabase.from('fire_configs').upsert(configRow);
    }

    if (Array.isArray(categories)) {
      if (categories.length > 0) {
        const catRows = categories.map((c: any) => ({
          id: c.id,
          sync_code: targetSyncCode,
          name: c.name,
          type: c.type,
          icon: c.icon,
          color: c.color,
          sub_categories: c.subCategories || [],
          updated_at: new Date().toISOString(),
        }));
        const currentCatIds = categories.map((c: any) => String(c.id));
        await supabase.from('categories').upsert(catRows);
        try {
          const { data: existingCats } = await supabase.from('categories').select('id').eq('sync_code', targetSyncCode);
          if (Array.isArray(existingCats)) {
            const currentCatIdSet = new Set(currentCatIds);
            const toDelete = existingCats.filter((r: any) => !currentCatIdSet.has(r.id)).map((r: any) => r.id);
            if (toDelete.length > 0) await supabase.from('categories').delete().in('id', toDelete);
          }
        } catch (e) {}
      } else {
        await supabase.from('categories').delete().eq('sync_code', targetSyncCode);
      }
    }

    if (Array.isArray(transactions)) {
      if (transactions.length > 0) {
        const txRows = transactions.map((t: any) => ({
          id: t.id,
          sync_code: targetSyncCode,
          type: t.type,
          amount: t.amount,
          main_category: t.mainCategory,
          sub_category: t.subCategory || '',
          date: t.date,
          note: t.note || '',
          tags: t.tags || [],
          is_quick_preset: Boolean(t.isQuickPreset),
          updated_at: new Date().toISOString(),
        }));
        const currentTxIds = transactions.map((t: any) => String(t.id));
        await supabase.from('transactions').upsert(txRows);
        try {
          const { data: existingTxs } = await supabase.from('transactions').select('id').eq('sync_code', targetSyncCode);
          if (Array.isArray(existingTxs)) {
            const currentTxIdSet = new Set(currentTxIds);
            const toDelete = existingTxs.filter((r: any) => !currentTxIdSet.has(r.id)).map((r: any) => r.id);
            if (toDelete.length > 0) await supabase.from('transactions').delete().in('id', toDelete);
          }
        } catch (e) {}
      } else {
        await supabase.from('transactions').delete().eq('sync_code', targetSyncCode);
      }
    }

    if (Array.isArray(quickPresets)) {
      if (quickPresets.length > 0) {
        const presetRows = quickPresets.map((p: any) => ({
          id: p.id,
          sync_code: targetSyncCode,
          label: p.label,
          main_category: p.mainCategory,
          sub_category: p.subCategory,
          amount: p.amount,
          icon: p.icon || 'Zap',
          updated_at: new Date().toISOString(),
        }));
        const currentPresetIds = quickPresets.map((p: any) => String(p.id));
        await supabase.from('quick_presets').upsert(presetRows);
        try {
          const { data: existingPresets } = await supabase.from('quick_presets').select('id').eq('sync_code', targetSyncCode);
          if (Array.isArray(existingPresets)) {
            const currentPresetIdSet = new Set(currentPresetIds);
            const toDelete = existingPresets.filter((r: any) => !currentPresetIdSet.has(r.id)).map((r: any) => r.id);
            if (toDelete.length > 0) await supabase.from('quick_presets').delete().in('id', toDelete);
          }
        } catch (e) {}
      } else {
        await supabase.from('quick_presets').delete().eq('sync_code', targetSyncCode);
      }
    }

    if (Array.isArray(portfolioStocks)) {
      if (portfolioStocks.length > 0) {
        const portRows = portfolioStocks.map((s: any) => ({
          id: String(s.id),
          sync_code: targetSyncCode,
          symbol: String(s.symbol || '').toUpperCase(),
          name: String(s.name || s.symbol || ''),
          market: s.market === 'TW' ? 'TW' : 'US',
          shares: Number(s.shares) || 0,
          avg_cost: Number(s.avgCost) || 0,
          current_price: Number(s.currentPrice) || 0,
          currency: s.currency === 'TWD' ? 'TWD' : 'USD',
          transactions: Array.isArray(s.transactions) ? s.transactions : [],
          updated_at: new Date().toISOString(),
        }));
        const currentIds = portfolioStocks.map((s: any) => String(s.id));
        await supabase.from('portfolio_stocks').upsert(portRows);
        try {
          const { data: existingRows } = await supabase
            .from('portfolio_stocks')
            .select('id')
            .eq('sync_code', targetSyncCode);
          if (Array.isArray(existingRows)) {
            const currentIdSet = new Set(currentIds);
            const toDelete = existingRows.filter((r: any) => !currentIdSet.has(r.id)).map((r: any) => r.id);
            if (toDelete.length > 0) {
              await supabase.from('portfolio_stocks').delete().in('id', toDelete);
            }
          }
        } catch (delErr) {}
      } else {
        await supabase.from('portfolio_stocks').delete().eq('sync_code', targetSyncCode);
      }
    }

    return res.json({
      success: true,
      mode: 'supabase',
      lastSyncedAt: new Date().toISOString(),
      message: '全量數據已成功備份與同步至 Supabase！',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || err });
  }
});

/**
 * Universal Server-Side Stock Quote Fetcher (Bypasses Browser CORS completely)
 */
async function fetchQuoteOnServer(symbol: string, market: string) {
  const cleanSymbol = symbol.trim().toUpperCase();
  const rawCode = cleanSymbol.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');

  if (market === 'TW' || /^\d+[A-Za-z]?$/.test(cleanSymbol)) {
    try {
      const suffixes = ['', 'L', 'R', 'U', 'K', 'A', 'B', 'C'];
      const channels: string[] = [];
      for (const s of suffixes) {
        channels.push(`tse_${rawCode}${s}.tw`);
        channels.push(`otc_${rawCode}${s}.tw`);
      }
      const exCh = channels.join('|');
      const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${exCh}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.msgArray) && data.msgArray.length > 0) {
          const validItems = data.msgArray.filter((it: any) => Boolean(it && it.c && (it.n || it.nf)));
          const item = validItems.length > 0 ? validItems[0] : null;
          if (item) {
            const livePrice = parseFloat(item.z) || parseFloat(item.y) || parseFloat(item.o) || 0;
            const prevClose = parseFloat(item.y) || livePrice;
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
      }
    } catch (e) {}
  }

  // Yahoo Finance Proxy fallback for US & TW
  let yahooSymbol = cleanSymbol;
  if ((market === 'TW' || /^\d+[A-Za-z]?$/.test(cleanSymbol)) && !yahooSymbol.endsWith('.TW') && !yahooSymbol.endsWith('.TWO')) {
    yahooSymbol = `${rawCode}.TW`;
  }

  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (res.ok) {
        const data = await res.json();
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
    } catch (e) {}
  }

  return null;
}

app.get(['/api/quote', '/quote'], async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string) || '';
  const market = (req.query.market as string) || 'US';

  if (!symbol) {
    return res.status(400).json({ success: false, error: 'Symbol is required' });
  }

  const quote = await fetchQuoteOnServer(symbol, market);
  if (quote) {
    return res.json({ success: true, quote });
  }
  return res.json({ success: false, error: 'Stock quote not found' });
});

app.get(['/api/search', '/search'], async (req: Request, res: Response) => {
  const keyword = ((req.query.keyword as string) || (req.query.q as string) || '').trim();
  const market = ((req.query.market as string) || 'TW').toUpperCase();

  if (!keyword) {
    return res.json({ success: true, results: [] });
  }

  const clean = keyword.toUpperCase();
  const rawCode = clean.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
  const hasChinese = /[\u4e00-\u9fa5]/.test(keyword);
  const isTw = market === 'TW' || /^\d+[A-Za-z]?$/.test(clean) || hasChinese;

  if (isTw) {
    // 1. Chinese Keyword Live Search via Official TWSE & TPEX OpenAPI (Zero Hardcoded Dictionaries)
    if (hasChinese) {
      try {
        const [twseRes, tpexRes] = await Promise.allSettled([
          fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
          }),
          fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
          }),
        ]);

        const matches: Array<{ symbol: string; name: string; price: number; market: string; currency: string }> = [];

        if (twseRes.status === 'fulfilled' && twseRes.value.ok) {
          const twseData = await twseRes.value.json();
          if (Array.isArray(twseData)) {
            const filtered = twseData.filter((it: any) => it && it.Code && it.Name && it.Name.includes(keyword));
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
        }

        if (tpexRes.status === 'fulfilled' && tpexRes.value.ok) {
          const tpexData = await tpexRes.value.json();
          if (Array.isArray(tpexData)) {
            const filtered = tpexData.filter(
              (it: any) => it && it.SecuritiesCompanyCode && it.CompanyName && it.CompanyName.includes(keyword)
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
        }

        // Sort main stocks & ETFs (code <= 6 chars) first
        matches.sort((a, b) => {
          const codeA = a.symbol.split('.')[0];
          const codeB = b.symbol.split('.')[0];
          return codeA.length - codeB.length;
        });

        if (matches.length > 0) {
          return res.json({ success: true, results: matches.slice(0, 8) });
        }
      } catch (e) {}
    }

    // 2. Stock Code Direct Channel Search via TWSE MIS Real-Time API
    try {
      const suffixes = ['', 'L', 'R', 'U', 'K', 'A', 'B', 'C'];
      const channels: string[] = [];
      for (const s of suffixes) {
        channels.push(`tse_${rawCode}${s}.tw`);
        channels.push(`otc_${rawCode}${s}.tw`);
      }
      const exCh = channels.join('|');

      const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${exCh}`;
      const twseRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
      });

      if (twseRes.ok) {
        const data = await twseRes.json();
        if (data && Array.isArray(data.msgArray)) {
          const results = data.msgArray
            .filter((it: any) => Boolean(it && it.c && (it.n || it.nf)))
            .map((it: any) => {
              const isOtc = it.ex === 'otc';
              const normSym = `${it.c || rawCode}.${isOtc ? 'TWO' : 'TW'}`;
              return {
                symbol: normSym,
                name: it.n || it.nf || it.c,
                price: parseFloat(it.z) || parseFloat(it.y) || parseFloat(it.o) || 0,
                market: 'TW',
                currency: 'TWD',
              };
            });

          if (results.length > 0) {
            return res.json({ success: true, results });
          }
        }
      }
    } catch (e) {}
  }

  // Fallback to Yahoo Finance Search
  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(rawCode)}&quotesCount=6`;
    const yRes = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (yRes.ok) {
      const data = await yRes.json();
      if (data && Array.isArray(data.quotes)) {
        const results = data.quotes.map((q: any) => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          market: isTw ? 'TW' : 'US',
          currency: isTw ? 'TWD' : 'USD',
        }));
        return res.json({ success: true, results });
      }
    }
  } catch (e) {}

  return res.json({ success: true, results: [] });
});

/**
 * Historical Stock Chart & Candlestick Endpoint
 */
app.get(['/api/chart', '/chart'], async (req: Request, res: Response): Promise<any> => {
  const symbol = (req.query.symbol as string || '').trim().toUpperCase();
  const range = (req.query.range as string || '1y').toLowerCase();
  const interval = (req.query.interval as string || '1d').toLowerCase();

  if (!symbol) {
    return res.status(400).json({ success: false, error: 'Symbol is required' });
  }

  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
    const yRes = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (yRes.ok) {
      const data = await yRes.json();
      const result = data?.chart?.result?.[0];
      if (result) {
        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};
        const opens = quote.open || [];
        const highs = quote.high || [];
        const lows = quote.low || [];
        const closes = quote.close || [];
        const volumes = quote.volume || [];

        const candles = [];
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
        return res.json({ success: true, symbol, range, interval, candles });
      }
    }
  } catch (e) {}

  return res.status(500).json({ success: false, error: 'Failed to fetch historical chart data' });
});

export default app;
