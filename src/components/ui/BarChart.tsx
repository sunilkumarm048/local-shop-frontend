'use client';

import { useMemo } from 'react';

/**
 * Lightweight inline-SVG bar chart for time-series data.
 *
 * No external chart library — Recharts isn't in deps and adding deps was
 * risky given the Vercel build history. SVG bars with proportional heights,
 * hover tooltips via <title>, x-axis labels every Nth bar to avoid overlap.
 *
 * Pure presentation; data comes already-bucketed (one entry per day).
 */

interface DataPoint {
  label: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  /** Visual height of the chart area in px. Default 160. */
  height?: number;
  /** Color of bars. Defaults to brand green. */
  color?: string;
  /** Format the value for the tooltip / above-bar label. Default = String(v). */
  formatValue?: (v: number) => string;
}

export function BarChart({ data, height = 160, color = '#0C831F', formatValue }: Props) {
  const { max, niceMax } = useMemo(() => {
    const m = Math.max(1, ...data.map((d) => d.value));
    // Round up to a "nice" max so the gridline labels are clean
    const magnitude = Math.pow(10, Math.floor(Math.log10(m)));
    const nm = Math.ceil(m / magnitude) * magnitude;
    return { max: m, niceMax: nm };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground border rounded-md bg-muted/30">
        No data yet
      </div>
    );
  }

  // Picking which x labels to show: every ~7th day for a 30-day chart so
  // they don't overlap.
  const labelInterval = Math.max(1, Math.ceil(data.length / 6));

  const fmt = formatValue || ((v: number) => String(v));

  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
        <span>{fmt(niceMax)}</span>
        <span>peak {fmt(max)}</span>
      </div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full border rounded-md bg-white"
        style={{ height }}
        role="img"
        aria-label="bar chart"
      >
        {/* Horizontal gridline at 50% */}
        <line
          x1={0}
          x2={100}
          y1={height / 2}
          y2={height / 2}
          stroke="#eee"
          strokeWidth={0.5}
        />
        {data.map((d, i) => {
          const barWidth = 100 / data.length;
          const x = i * barWidth;
          const h = niceMax > 0 ? (d.value / niceMax) * (height - 4) : 0;
          const y = height - h;
          return (
            <g key={i}>
              <rect
                x={x + barWidth * 0.1}
                y={y}
                width={barWidth * 0.8}
                height={h}
                fill={color}
                opacity={d.value > 0 ? 0.95 : 0.15}
              >
                <title>{`${d.label}: ${fmt(d.value)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        {data
          .filter((_, i) => i % labelInterval === 0 || i === data.length - 1)
          .map((d) => (
            <span key={d.label}>{shortDate(d.label)}</span>
          ))}
      </div>
    </div>
  );
}

function shortDate(yyyymmdd: string): string {
  // "2026-05-12" → "May 12"
  const [, mm, dd] = yyyymmdd.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(mm) - 1]} ${Number(dd)}`;
}
