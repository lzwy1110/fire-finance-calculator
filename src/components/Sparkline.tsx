import React from 'react';

interface SparklineProps {
  data?: number[];
  isPositive: boolean;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data = [],
  isPositive,
  width = 64,
  height = 24,
  className = '',
  fill = false,
}) => {
  const strokeColor = isPositive ? '#34d399' : '#fb7185'; // Emerald-400 vs Rose-400

  // If no data or fewer than 2 points, render a subtle horizontal dashed baseline
  if (!data || data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`shrink-0 opacity-30 ${className}`}
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const validData = data.filter((n) => typeof n === 'number' && !isNaN(n) && n > 0);
  if (validData.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`shrink-0 opacity-30 ${className}`}
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min || 1;
  const padding = 2;
  const h = height - padding * 2;
  const w = width;

  // Compute SVG polyline (x, y) coordinates
  const points = validData.map((val, idx) => {
    const x = (idx / (validData.length - 1)) * w;
    const y = padding + h - ((val - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const gradId = `spark-${Math.abs(min).toFixed(0)}-${Math.abs(max).toFixed(0)}-${validData.length}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`shrink-0 overflow-visible ${className}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
        </linearGradient>
      </defs>

      {fill && (
        <path
          d={`${pathD} L ${width},${height} L 0,${height} Z`}
          fill={`url(#${gradId})`}
        />
      )}

      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
