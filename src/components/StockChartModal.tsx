import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  TrendingUp,
  Activity,
  RotateCcw,
  Palette,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { PortfolioStock } from '../types';
import { fetchStockHistoricalChart, CandleData } from '../services/stockPriceService';

interface StockChartModalProps {
  stock: PortfolioStock | null;
  usdRate: number;
  currencySymbol: string;
  onClose: () => void;
}

type ChartType = 'line' | 'candle';
type LineRange = '1d' | '5d' | '1m' | '1y' | '5y';
type CandleResolution = '5m' | 'd' | 'w' | 'mo';

interface ColorTheme {
  id: string;
  name: string;
  upColor: string;
  downColor: string;
}

const COLOR_PRESETS: ColorTheme[] = [
  {
    id: 'classic-tw',
    name: '傳統台股 (紅漲綠跌)',
    upColor: '#ef4444',
    downColor: '#22c55e',
  },
  {
    id: 'classic-us',
    name: '傳統美股 (綠漲紅跌)',
    upColor: '#10b981',
    downColor: '#f43f5e',
  },
  {
    id: 'neon-purple',
    name: '螢光綠 + 奢華紫',
    upColor: '#01cd00',
    downColor: '#ab47bc',
  },
  {
    id: 'slate-obsidian',
    name: '曜石銀灰 + 深邃黑',
    upColor: '#939ba8',
    downColor: '#101115',
  },
];

const LOCAL_STORAGE_COLOR_KEY = 'fire_stock_chart_color_theme';

export const StockChartModal: React.FC<StockChartModalProps> = ({
  stock,
  currencySymbol,
  onClose,
}) => {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [lineRange, setLineRange] = useState<LineRange>('1y');
  const [candleResolution, setCandleResolution] = useState<CandleResolution>('d');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Color theme state
  const [customUp, setCustomUp] = useState<string>('#01cd00');
  const [customDown, setCustomDown] = useState<string>('#ab47bc');
  const [selectedThemeId, setSelectedThemeId] = useState<string>('neon-purple');
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);

  // Canvas ref and zoom/pan state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewWindow, setViewWindow] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
  const [hoverData, setHoverData] = useState<{ candle: CandleData; x: number; y: number } | null>(null);

  // Drag states for X-Axis (Pan) and Y-Axis (Scale)
  const [isDraggingX, setIsDraggingX] = useState<boolean>(false);
  const [isDraggingY, setIsDraggingY] = useState<boolean>(false);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [dragStartWindow, setDragStartWindow] = useState<{ start: number; end: number }>({ start: 0, end: 100 });

  // Y-axis zoom/scale multiplier (1 = default auto-fit)
  const [yScaleMultiplier, setYScaleMultiplier] = useState<number>(1);
  const [dragStartYMultiplier, setDragStartYMultiplier] = useState<number>(1);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Load color preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COLOR_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.themeId) setSelectedThemeId(parsed.themeId);
        if (parsed.upColor) setCustomUp(parsed.upColor);
        if (parsed.downColor) setCustomDown(parsed.downColor);
      }
    } catch (e) {}
  }, []);

  const handleSelectPreset = (preset: ColorTheme) => {
    setSelectedThemeId(preset.id);
    setCustomUp(preset.upColor);
    setCustomDown(preset.downColor);
    try {
      localStorage.setItem(
        LOCAL_STORAGE_COLOR_KEY,
        JSON.stringify({ themeId: preset.id, upColor: preset.upColor, downColor: preset.downColor })
      );
    } catch (e) {}
  };

  const handleCustomColorChange = (type: 'up' | 'down', color: string) => {
    setSelectedThemeId('custom');
    if (type === 'up') setCustomUp(color);
    if (type === 'down') setCustomDown(color);

    try {
      localStorage.setItem(
        LOCAL_STORAGE_COLOR_KEY,
        JSON.stringify({
          themeId: 'custom',
          upColor: type === 'up' ? color : customUp,
          downColor: type === 'down' ? color : customDown,
        })
      );
    } catch (e) {}
  };

  // Determine query parameters based on chartType and selected timeframe
  const { queryRange, queryInterval, periodLabel } = useMemo(() => {
    if (chartType === 'line') {
      switch (lineRange) {
        case '1d':
          return { queryRange: '1d', queryInterval: '5m', periodLabel: '今日' };
        case '5d':
          return { queryRange: '5d', queryInterval: '15m', periodLabel: '近5日' };
        case '1m':
          return { queryRange: '1mo', queryInterval: '1d', periodLabel: '近1個月' };
        case '1y':
          return { queryRange: '1y', queryInterval: '1d', periodLabel: '近1年' };
        case '5y':
        default:
          return { queryRange: '5y', queryInterval: '1wk', periodLabel: '近5年' };
      }
    } else {
      switch (candleResolution) {
        case '5m':
          return { queryRange: '1d', queryInterval: '5m', periodLabel: '5分' };
        case 'd':
          return { queryRange: '1y', queryInterval: '1d', periodLabel: '天 (日K)' };
        case 'w':
          return { queryRange: '5y', queryInterval: '1wk', periodLabel: '週 (週K)' };
        case 'mo':
        default:
          return { queryRange: 'max', queryInterval: '1mo', periodLabel: '月 (月K)' };
      }
    }
  }, [chartType, lineRange, candleResolution]);

  // Fetch chart data when stock, chartType, or timeframe changes
  useEffect(() => {
    if (!stock) return;
    let isCancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      setHoverData(null);
      setYScaleMultiplier(1);

      try {
        const res = await fetchStockHistoricalChart(stock.symbol, queryRange, queryInterval);
        if (isCancelled) return;

        if (res && res.candles && res.candles.length > 0) {
          setCandles(res.candles);
          setViewWindow({ start: 0, end: res.candles.length - 1 });
        } else {
          setError('暫無該標的歷史走勢資料');
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError('載入歷史走勢圖表失敗，請稍後再試');
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [stock, queryRange, queryInterval]);

  // Current active colors
  const activeUpColor = selectedThemeId === 'custom' ? customUp : COLOR_PRESETS.find((p) => p.id === selectedThemeId)?.upColor || customUp;
  const activeDownColor = selectedThemeId === 'custom' ? customDown : COLOR_PRESETS.find((p) => p.id === selectedThemeId)?.downColor || customDown;

  // Visible slice of candles based on viewWindow
  const visibleCandles = useMemo(() => {
    if (candles.length === 0) return [];
    const s = Math.max(0, Math.min(viewWindow.start, candles.length - 1));
    const e = Math.max(s, Math.min(viewWindow.end, candles.length - 1));
    return candles.slice(s, e + 1);
  }, [candles, viewWindow]);

  // Top header return indicator calculation
  const headerReturn = useMemo(() => {
    if (candles.length === 0) return { diff: 0, percent: 0, isPositive: true, label: '今日' };

    if (chartType === 'candle') {
      // In K-Line mode: uniformly display Daily Change (今日日漲跌)
      const last = candles[candles.length - 1];
      const prev = candles.length >= 2 ? candles[candles.length - 2] : null;
      const prevClose = prev ? prev.close : last.open;
      const diff = last.close - prevClose;
      const percent = prevClose > 0 ? (diff / prevClose) * 100 : 0;
      return {
        diff,
        percent,
        isPositive: diff >= 0,
        label: '今日',
      };
    } else {
      // In Line Chart mode: display Period Return over selected timeframe
      if (visibleCandles.length === 0) return { diff: 0, percent: 0, isPositive: true, label: periodLabel };
      const first = visibleCandles[0];
      const last = visibleCandles[visibleCandles.length - 1];
      const startPrice = first.open || first.close;
      const endPrice = last.close;
      const diff = endPrice - startPrice;
      const percent = startPrice > 0 ? (diff / startPrice) * 100 : 0;
      return {
        diff,
        percent,
        isPositive: diff >= 0,
        label: periodLabel,
      };
    }
  }, [candles, visibleCandles, chartType, periodLabel]);

  // Calculate Price Range with Y-Scale Multiplier
  const { minPrice, maxPrice } = useMemo(() => {
    if (visibleCandles.length === 0) return { minPrice: 0, maxPrice: 100 };
    let min = Infinity;
    let max = -Infinity;
    visibleCandles.forEach((c) => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    });

    const cost = stock?.avgCost || 0;
    if (cost > 0) {
      if (cost < min) min = cost * 0.98;
      if (cost > max) max = cost * 1.02;
    }

    const mid = (max + min) / 2;
    const halfSpan = Math.max(0.5, ((max - min) / 2) * (1 / yScaleMultiplier));
    const padding = halfSpan * 0.08;

    return {
      minPrice: mid - halfSpan - padding,
      maxPrice: mid + halfSpan + padding,
    };
  }, [visibleCandles, stock?.avgCost, yScaleMultiplier]);

  // Draw chart on Canvas
  const renderChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || visibleCandles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 700;
    const height = 360;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 25, right: 70, bottom: 35, left: 15 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const getY = (val: number) => {
      const ratio = (val - minPrice) / (maxPrice - minPrice);
      return padding.top + chartH - ratio * chartH;
    };

    const getX = (idx: number) => {
      if (visibleCandles.length <= 1) return padding.left + chartW / 2;
      return padding.left + (idx / (visibleCandles.length - 1)) * chartW;
    };

    // Draw Y-axis background highlight for draggable area
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.fillRect(padding.left + chartW, padding.top, padding.right, chartH);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const priceVal = minPrice + (i / gridSteps) * (maxPrice - minPrice);
      const y = getY(priceVal);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      // Price labels on right
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(priceVal.toFixed(2), padding.left + chartW + 8, y + 3);
    }

    // Draw Your Avg Cost Line (Orange/Amber Dashed Line)
    if (stock && stock.avgCost > 0) {
      const costY = getY(stock.avgCost);
      if (costY >= padding.top && costY <= padding.top + chartH) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, costY);
        ctx.lineTo(padding.left + chartW, costY);
        ctx.stroke();

        // Avg Cost Badge
        ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
        ctx.fillRect(padding.left + chartW + 4, costY - 9, 62, 18);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.strokeRect(padding.left + chartW + 4, costY - 9, 62, 18);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`成本 ${stock.avgCost.toFixed(1)}`, padding.left + chartW + 7, costY + 3);
        ctx.restore();
      }
    }

    if (chartType === 'line') {
      // 1. Line Chart Mode with Glowing Area Gradient
      const lineGradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
      lineGradient.addColorStop(0, 'rgba(16, 185, 129, 0.28)');
      lineGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

      // Draw Area
      ctx.beginPath();
      ctx.moveTo(getX(0), padding.top + chartH);
      visibleCandles.forEach((c, idx) => {
        ctx.lineTo(getX(idx), getY(c.close));
      });
      ctx.lineTo(getX(visibleCandles.length - 1), padding.top + chartH);
      ctx.closePath();
      ctx.fillStyle = lineGradient;
      ctx.fill();

      // Draw Stroke
      ctx.beginPath();
      ctx.strokeStyle = activeUpColor;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      visibleCandles.forEach((c, idx) => {
        const x = getX(idx);
        const y = getY(c.close);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else {
      // 2. Candlestick K-Line Mode
      const candleWidth = Math.max(2, (chartW / visibleCandles.length) * 0.7);

      visibleCandles.forEach((c, idx) => {
        const x = getX(idx);
        const isUp = c.close >= c.open;
        const color = isUp ? activeUpColor : activeDownColor;

        const openY = getY(c.open);
        const closeY = getY(c.close);
        const highY = getY(c.high);
        const lowY = getY(c.low);

        // High-Low Wick Line
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // Candle Body
        const bodyY = Math.min(openY, closeY);
        const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

        ctx.fillStyle = color;
        ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, bodyHeight);
      });
    }

    // Draw Crosshair on Hover
    if (hoverData) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(hoverData.x, padding.top);
      ctx.lineTo(hoverData.x, padding.top + chartH);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(padding.left, hoverData.y);
      ctx.lineTo(padding.left + chartW, hoverData.y);
      ctx.stroke();

      // Draw active point
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hoverData.x, hoverData.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Time Axis Labels (Show ~5 dates)
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    const dateInterval = Math.max(1, Math.floor(visibleCandles.length / 5));
    for (let i = 0; i < visibleCandles.length; i += dateInterval) {
      const d = new Date(visibleCandles[i].time * 1000);
      const dateStr =
        queryInterval === '5m' || queryInterval === '15m'
          ? `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
          : `${d.getMonth() + 1}/${d.getDate()}`;
      ctx.fillText(dateStr, getX(i), height - 10);
    }
  }, [visibleCandles, minPrice, maxPrice, chartType, activeUpColor, activeDownColor, stock, hoverData, queryInterval]);

  useEffect(() => {
    renderChart();
  }, [renderChart]);

  // Non-passive native event listeners on Canvas (Wheel + Touch) to prevent background page scroll and provide smooth mobile gestures
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- 1. Mouse Wheel Zoom (Desktop) ---
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault(); // Stop whole page scrolling
      e.stopPropagation();

      if (candles.length < 5) return;

      const zoomFactor = e.deltaY < 0 ? 0.85 : 1.15;
      const currentLen = viewWindow.end - viewWindow.start;
      const newLen = Math.max(10, Math.min(candles.length, Math.round(currentLen * zoomFactor)));

      const center = Math.round((viewWindow.start + viewWindow.end) / 2);
      const half = Math.round(newLen / 2);
      let newStart = center - half;
      let newEnd = center + half;

      if (newStart < 0) {
        newStart = 0;
        newEnd = Math.min(candles.length - 1, newLen);
      }
      if (newEnd >= candles.length) {
        newEnd = candles.length - 1;
        newStart = Math.max(0, newEnd - newLen);
      }

      setViewWindow({ start: newStart, end: newEnd });
    };

    // --- 2. Mobile Touch Gestures (Android / iOS) ---
    let touchMode: 'none' | 'pinch' | 'y-scale' | 'crosshair' = 'none';
    let initialPinchDist = 0;
    let initialPinchWindow = { start: 0, end: 100 };
    let touchStartY = 0;
    let touchStartYMultiplier = 1;
    let lastTapTime = 0;

    const handleNativeTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const padding = { top: 25, right: 70, bottom: 35, left: 15 };
      const chartW = canvas.clientWidth - padding.left - padding.right;

      // Handle Double Tap to Reset
      const now = Date.now();
      if (now - lastTapTime < 300) {
        setViewWindow({ start: 0, end: candles.length - 1 });
        setYScaleMultiplier(1);
        setHoverData(null);
        lastTapTime = 0;
        return;
      }
      lastTapTime = now;

      if (e.touches.length === 2) {
        // Two-Finger Pinch to Zoom X-Axis
        touchMode = 'pinch';
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        initialPinchWindow = { ...viewWindow };
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        if (x > padding.left + chartW) {
          // Touch in Right-hand Y-axis Price Column -> Drag to Scale Price Axis
          touchMode = 'y-scale';
          touchStartY = touch.clientY;
          touchStartYMultiplier = yScaleMultiplier;
        } else {
          // Touch in Chart Area -> Continuous Crosshair Inspection
          touchMode = 'crosshair';
          if (x >= padding.left && x <= padding.left + chartW && visibleCandles.length > 0) {
            const ratio = (x - padding.left) / chartW;
            const idx = Math.min(
              visibleCandles.length - 1,
              Math.max(0, Math.round(ratio * (visibleCandles.length - 1)))
            );
            const candle = visibleCandles[idx];
            const getY = (val: number) => {
              const chartH = canvas.clientHeight - padding.top - padding.bottom;
              return padding.top + chartH - ((val - minPrice) / (maxPrice - minPrice)) * chartH;
            };
            setHoverData({ candle, x, y: getY(candle.close) });
          }
        }
      }
    };

    const handleNativeTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const padding = { top: 25, right: 70, bottom: 35, left: 15 };
      const chartW = canvas.clientWidth - padding.left - padding.right;

      if (e.touches.length === 2 && touchMode === 'pinch') {
        // Two-Finger Pinch Zoom Calculation
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (initialPinchDist > 0 && currentDist > 0) {
          const pinchFactor = initialPinchDist / currentDist;
          const origLen = initialPinchWindow.end - initialPinchWindow.start;
          const newLen = Math.max(10, Math.min(candles.length, Math.round(origLen * pinchFactor)));

          const center = Math.round((initialPinchWindow.start + initialPinchWindow.end) / 2);
          const half = Math.round(newLen / 2);
          let newStart = center - half;
          let newEnd = center + half;

          if (newStart < 0) {
            newStart = 0;
            newEnd = Math.min(candles.length - 1, newLen);
          }
          if (newEnd >= candles.length) {
            newEnd = candles.length - 1;
            newStart = Math.max(0, newEnd - newLen);
          }

          setViewWindow({ start: newStart, end: newEnd });
        }
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;

        if (touchMode === 'y-scale') {
          // Adjust Y-Scale on Price Column Drag
          const deltaY = touchStartY - touch.clientY;
          const scaleDelta = 1 + deltaY * 0.008;
          const newMultiplier = Math.max(0.2, Math.min(8.0, touchStartYMultiplier * scaleDelta));
          setYScaleMultiplier(newMultiplier);
        } else if (touchMode === 'crosshair') {
          // Continuous Touch Crosshair & Tooltip Drag
          if (x >= padding.left && x <= padding.left + chartW && visibleCandles.length > 0) {
            const ratio = (x - padding.left) / chartW;
            const idx = Math.min(
              visibleCandles.length - 1,
              Math.max(0, Math.round(ratio * (visibleCandles.length - 1)))
            );
            const candle = visibleCandles[idx];
            const getY = (val: number) => {
              const chartH = canvas.clientHeight - padding.top - padding.bottom;
              return padding.top + chartH - ((val - minPrice) / (maxPrice - minPrice)) * chartH;
            };
            setHoverData({ candle, x, y: getY(candle.close) });
          }
        }
      }
    };

    const handleNativeTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 0) {
        touchMode = 'none';
      }
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    canvas.addEventListener('touchstart', handleNativeTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleNativeTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleNativeTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleNativeWheel);
      canvas.removeEventListener('touchstart', handleNativeTouchStart);
      canvas.removeEventListener('touchmove', handleNativeTouchMove);
      canvas.removeEventListener('touchend', handleNativeTouchEnd);
      canvas.removeEventListener('touchcancel', handleNativeTouchEnd);
    };
  }, [candles, viewWindow, visibleCandles, yScaleMultiplier, minPrice, maxPrice]);

  // Mouse Down: Distinguish between X-axis drag (Pan) and Y-axis drag (Price Scale)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = { top: 25, right: 70, bottom: 35, left: 15 };
    const chartW = canvas.clientWidth - padding.left - padding.right;

    if (x > padding.left + chartW) {
      // Y-axis area clicked -> start Y-scale dragging
      setIsDraggingY(true);
      setDragStartY(e.clientY);
      setDragStartYMultiplier(yScaleMultiplier);
    } else {
      // Chart area clicked -> start X-pan dragging
      setIsDraggingX(true);
      setDragStartX(e.clientX);
      setDragStartWindow({ ...viewWindow });
    }
  };

  // Mouse Move: Handle Tooltips, Pan, and Y-Scale Drag
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || visibleCandles.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = { top: 25, right: 70, bottom: 35, left: 15 };
    const chartW = canvas.clientWidth - padding.left - padding.right;

    // 1. Handle Y-axis Price Scale Dragging
    if (isDraggingY) {
      const deltaY = dragStartY - e.clientY; // drag up to expand, drag down to compress
      const scaleDelta = 1 + deltaY * 0.008;
      const newMultiplier = Math.max(0.2, Math.min(8.0, dragStartYMultiplier * scaleDelta));
      setYScaleMultiplier(newMultiplier);
      return;
    }

    // 2. Handle X-axis Time Pan Dragging
    if (isDraggingX) {
      const deltaPx = e.clientX - dragStartX;
      const visibleLen = dragStartWindow.end - dragStartWindow.start;
      const shiftIndex = Math.round((-deltaPx / chartW) * visibleLen);

      let newStart = dragStartWindow.start + shiftIndex;
      let newEnd = dragStartWindow.end + shiftIndex;

      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd >= candles.length) {
        newStart -= newEnd - (candles.length - 1);
        newEnd = candles.length - 1;
      }

      newStart = Math.max(0, newStart);
      newEnd = Math.min(candles.length - 1, newEnd);
      setViewWindow({ start: newStart, end: newEnd });
      return;
    }

    // 3. Hover Cursor and Tooltip
    if (x > padding.left + chartW) {
      // Hovering over Y-axis
      canvas.style.cursor = 'ns-resize';
      setHoverData(null);
    } else if (x >= padding.left && x <= padding.left + chartW) {
      // Hovering over chart area
      canvas.style.cursor = 'crosshair';
      const ratio = (x - padding.left) / chartW;
      const idx = Math.min(visibleCandles.length - 1, Math.max(0, Math.round(ratio * (visibleCandles.length - 1))));
      const candle = visibleCandles[idx];
      const getY = (val: number) => {
        const chartH = canvas.clientHeight - padding.top - padding.bottom;
        return padding.top + chartH - ((val - minPrice) / (maxPrice - minPrice)) * chartH;
      };
      setHoverData({ candle, x, y: getY(candle.close) });
    } else {
      canvas.style.cursor = 'default';
      setHoverData(null);
    }
  };

  const handleMouseUp = () => {
    setIsDraggingX(false);
    setIsDraggingY(false);
  };

  // Double click on Canvas: Reset Y-scale or X-window
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = { top: 25, right: 70, bottom: 35, left: 15 };
    const chartW = canvas.clientWidth - padding.left - padding.right;

    if (x > padding.left + chartW) {
      setYScaleMultiplier(1);
    } else {
      handleResetZoom();
    }
  };

  const handleResetZoom = () => {
    if (candles.length > 0) {
      setViewWindow({ start: 0, end: candles.length - 1 });
      setYScaleMultiplier(1);
      setHoverData(null);
    }
  };

  if (!stock) return null;

  const isUS = stock.market === 'US';
  const priceDisplay = stock.currentPrice.toFixed(2);
  const costDiff = stock.avgCost > 0 ? stock.currentPrice - stock.avgCost : 0;
  const costDiffPercent = stock.avgCost > 0 ? (costDiff / stock.avgCost) * 100 : 0;
  const isCostProfit = costDiff >= 0;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[95vh] relative transform transition-all scale-100">
        {/* Background Ambient Glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* 1. Header */}
        <div className="p-5 md:p-6 border-b border-white/10 flex items-start justify-between relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                {stock.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-lg bg-white/10 text-xs font-mono font-bold text-gray-300">
                {stock.symbol}
              </span>
              {/* US Market 15-min Delay Notice Badge */}
              {isUS && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-400">
                  <Clock className="w-3 h-3" />
                  <span>⏱️ 15m 延遲</span>
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-2xl md:text-3xl font-black text-white font-mono tracking-tight">
                {currencySymbol} {priceDisplay}
              </span>

              {/* Dynamic Header Return: Daily in K-Line vs Period Return in Line */}
              <span
                className={`flex items-center text-xs md:text-sm font-bold ${
                  headerReturn.isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {headerReturn.isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {headerReturn.isPositive ? '+' : ''}
                {currencySymbol} {headerReturn.diff.toFixed(2)} ({headerReturn.percent > 0 ? '+' : ''}
                {headerReturn.percent.toFixed(2)}% {headerReturn.label})
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Control Toolbar */}
        <div className="px-5 py-3 bg-white/[0.02] border-b border-white/5 flex items-center justify-between gap-3 flex-wrap relative z-10 text-xs">
          {/* Smart Dynamic Timeframe Switcher */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
            {chartType === 'line' ? (
              // Line Chart Mode: 1D, 5D, 1M, 1Y, 5Y (From short to long)
              (['1d', '5d', '1m', '1y', '5y'] as LineRange[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setLineRange(t)}
                  className={`px-2.5 py-1 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                    lineRange === t
                      ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))
            ) : (
              // K-Line Mode: 5分, 天, 週, 月
              ([
                { id: '5m', label: '5分' },
                { id: 'd', label: '天' },
                { id: 'w', label: '週' },
                { id: 'mo', label: '月' },
              ] as { id: CandleResolution; label: string }[]).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCandleResolution(item.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    candleResolution === item.id
                      ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Chart Type Toggle */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setChartType('line')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  chartType === 'line'
                    ? 'bg-white/15 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>折線</span>
              </button>
              <button
                onClick={() => setChartType('candle')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  chartType === 'candle'
                    ? 'bg-white/15 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>K 線</span>
              </button>
            </div>

            {/* K-Line Color Theme Selector */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/5 hover:border-white/20 text-gray-300 hover:text-white flex items-center gap-1.5 font-medium transition-all cursor-pointer"
                title="自訂 K 線配色"
              >
                <div
                  className="w-3 h-3 rounded-full border border-white/20"
                  style={{ backgroundColor: activeUpColor }}
                />
                <div
                  className="w-3 h-3 rounded-full border border-white/20 -ml-2"
                  style={{ backgroundColor: activeDownColor }}
                />
                <Palette className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
              </button>

              {/* Color Picker Dropdown Modal */}
              {showColorPicker && (
                <div className="absolute right-0 mt-2 w-72 bg-[#18181f] border border-white/15 rounded-2xl p-4 shadow-2xl z-30 space-y-3.5 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="font-bold text-white text-xs">K 線顏色自訂</span>
                    <button
                      onClick={() => setShowColorPicker(false)}
                      className="text-gray-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Preset Options */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-gray-400 font-semibold">快速風格預設</div>
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                          selectedThemeId === preset.id
                            ? 'bg-white/10 border border-white/20 text-white font-bold'
                            : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        <span className="text-xs">{preset.name}</span>
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-4 h-4 rounded-md shadow-sm"
                            style={{ backgroundColor: preset.upColor }}
                          />
                          <div
                            className="w-4 h-4 rounded-md shadow-sm"
                            style={{ backgroundColor: preset.downColor }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Custom Hex Inputs */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="text-[11px] text-gray-400 font-semibold">自訂色碼 (Hex)</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">上漲 (陽線)</label>
                        <div className="flex items-center gap-1.5 bg-black/50 px-2 py-1.5 rounded-lg border border-white/10">
                          <input
                            type="color"
                            value={customUp}
                            onChange={(e) => handleCustomColorChange('up', e.target.value)}
                            className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                          />
                          <input
                            type="text"
                            value={customUp}
                            onChange={(e) => handleCustomColorChange('up', e.target.value)}
                            className="w-full bg-transparent text-[11px] font-mono text-white focus:outline-none uppercase"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">下跌 (陰線)</label>
                        <div className="flex items-center gap-1.5 bg-black/50 px-2 py-1.5 rounded-lg border border-white/10">
                          <input
                            type="color"
                            value={customDown}
                            onChange={(e) => handleCustomColorChange('down', e.target.value)}
                            className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                          />
                          <input
                            type="text"
                            value={customDown}
                            onChange={(e) => handleCustomColorChange('down', e.target.value)}
                            className="w-full bg-transparent text-[11px] font-mono text-white focus:outline-none uppercase"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reset Zoom Button */}
            <button
              onClick={handleResetZoom}
              className="p-1.5 rounded-xl bg-black/40 border border-white/5 hover:border-white/20 text-gray-400 hover:text-white transition-all cursor-pointer"
              title="重置縮放與價格軸"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3. Main Chart Canvas Area */}
        <div className="p-4 md:p-6 relative flex-1 min-h-[360px] flex items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <span className="text-xs font-medium">正在取得即時歷史走勢...</span>
            </div>
          ) : error ? (
            <div className="text-center p-8 space-y-2">
              <p className="text-gray-400 text-sm">{error}</p>
              <button
                onClick={() => setLineRange(lineRange)}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer"
              >
                重試載入
              </button>
            </div>
          ) : (
            <div className="w-full relative select-none">
              {/* Refactored Hover Tooltip Card (Open/Close on left, High/Low on right, No Cost Gap) */}
              {hoverData && (
                <div
                  className="absolute top-2 left-4 bg-[#141419]/90 backdrop-blur-md border border-white/20 rounded-2xl p-3 text-[11px] text-gray-200 pointer-events-none shadow-2xl z-20 space-y-1.5"
                >
                  <div className="text-gray-400 font-semibold border-b border-white/10 pb-1 flex items-center gap-1.5">
                    <span>📅</span>
                    <span>
                      {(() => {
                        const d = new Date(hoverData.candle.time * 1000);
                        if (queryInterval === '5m' || queryInterval === '15m') {
                          return `${d.toLocaleDateString('zh-TW')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                        }
                        return d.toLocaleDateString('zh-TW');
                      })()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-400">開盤:</span>
                        <strong className="text-white">{hoverData.candle.open.toFixed(2)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-400">收盤:</span>
                        <strong
                          className={
                            hoverData.candle.close >= hoverData.candle.open
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }
                        >
                          {hoverData.candle.close.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-400">最高:</span>
                        <strong className="text-emerald-400">{hoverData.candle.high.toFixed(2)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-400">最低:</span>
                        <strong className="text-rose-400">{hoverData.candle.low.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* HTML5 Canvas */}
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                onMouseLeave={() => {
                  setIsDraggingX(false);
                  setIsDraggingY(false);
                  setHoverData(null);
                }}
                className="w-full h-[360px]"
              />

              <div className="text-[10px] text-gray-500 text-center pt-1">
                💡 滾輪縮放時間軸，拖曳右側價格表可上下拉伸價格軸，雙擊還原
              </div>
            </div>
          )}
        </div>

        {/* 4. Bottom Metric Cards */}
        <div className="p-4 md:p-6 bg-white/[0.02] border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10 text-xs">
          <div className="bg-black/30 border border-white/5 rounded-2xl p-3 space-y-1">
            <span className="text-gray-400 font-medium">持有股數</span>
            <div className="text-base font-bold text-white font-mono">
              {stock.shares.toLocaleString()} 股
            </div>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-2xl p-3 space-y-1">
            <span className="text-gray-400 font-medium">買入均價 (成本)</span>
            <div className="text-base font-bold text-amber-300 font-mono">
              {currencySymbol} {stock.avgCost > 0 ? stock.avgCost.toFixed(2) : '--'}
            </div>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-2xl p-3 space-y-1">
            <span className="text-gray-400 font-medium">目前總市值</span>
            <div className="text-base font-bold text-white font-mono">
              {currencySymbol} {(stock.shares * stock.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-2xl p-3 space-y-1">
            <span className="text-gray-400 font-medium">現價 vs 買入成本</span>
            {stock.avgCost > 0 ? (
              <div
                className={`text-xs font-bold font-mono pt-0.5 flex items-center gap-1 ${
                  isCostProfit ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isCostProfit ? '+' : ''}
                {currencySymbol}
                {costDiff.toFixed(1)} ({costDiffPercent > 0 ? '+' : ''}
                {costDiffPercent.toFixed(1)}%)
              </div>
            ) : (
              <div className="text-xs font-mono text-gray-500 pt-0.5">尚無成本數據</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
