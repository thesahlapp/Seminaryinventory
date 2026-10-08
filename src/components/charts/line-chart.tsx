"use client";

import { useId, useMemo, useRef, useState } from "react";

export type LineSeries = { name: string; color: string; values: number[] };

/**
 * Line chart (one y-axis) with a crosshair tooltip listing every series at the
 * hovered point. Colors are CSS variables so light/dark mode both work.
 */
export function LineChart({
  labels,
  series,
  format = (n) => n.toLocaleString(),
  height = 220,
  area = false,
  ariaLabel,
}: {
  /** One label per x position (e.g. "Oct 3"). */
  labels: string[];
  series: LineSeries[];
  format?: (n: number) => string;
  height?: number;
  /** Light wash under a single series. */
  area?: boolean;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gradientId = useId();
  const width = 640;
  const pad = { top: 12, right: 12, bottom: 26, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { max, ticks } = useMemo(() => {
    const raw = Math.max(1, ...series.flatMap((s) => s.values));
    const step = niceStep(raw / 4);
    const top = Math.ceil(raw / step) * step;
    return { max: top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
  }, [series]);

  const n = labels.length;
  const x = (i: number) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  function onMove(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const px = ((clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - pad.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  if (n === 0) return <p className="py-8 text-center text-sm text-brand-400">No data in this period.</p>;

  return (
    <div className="relative">
      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-600" aria-label="Legend">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
          if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
        }}
        onBlur={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-cream-300)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-brand-400 text-[11px] tabular-nums">
              {format(t)}
            </text>
          </g>
        ))}
        {labels.map((label, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-brand-400 text-[11px]">
              {label}
            </text>
          ) : null,
        )}
        {area && series.length === 1 && (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={series[0].color} stopOpacity={0.14} />
                <stop offset="100%" stopColor={series[0].color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <path
              d={`M ${x(0)} ${y(0)} ${series[0].values.map((v, i) => `L ${x(i)} ${y(v)}`).join(" ")} L ${x(n - 1)} ${y(0)} Z`}
              fill={`url(#${gradientId})`}
            />
          </>
        )}
        {series.map((s) => (
          <path
            key={s.name}
            d={s.values.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${y(v)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {/* End dots */}
        {series.map((s) => (
          <circle key={s.name} cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} fill={s.color} stroke="var(--color-cream-50)" strokeWidth={2} />
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-brand-300)" strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="var(--color-cream-50)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-6 z-10 min-w-36 rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${(x(hover) / width) * 100}%`,
            transform: `translateX(${x(hover) / width > 0.6 ? "calc(-100% - 10px)" : "10px"})`,
          }}
          role="status"
        >
          <p className="mb-1 font-medium text-brand-600">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-brand-500">
                <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
                {s.name}
              </span>
              <strong className="tabular-nums text-brand-800">{format(s.values[hover] ?? 0)}</strong>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const n = raw / power;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * power;
}
