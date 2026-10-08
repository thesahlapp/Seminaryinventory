import Link from "next/link";

/**
 * Horizontal bars (single series): label, bar, value at the bar's tip.
 * Bars use the single-series chart colour; text uses text colours.
 */
export function BarList({
  rows,
  format = (n) => n.toLocaleString(),
  empty = "No data in this period.",
}: {
  rows: { label: string; value: number; href?: string; detail?: string }[];
  format?: (n: number) => string;
  empty?: string;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-brand-400">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(6rem,40%)_1fr] items-center gap-3 text-sm" title={`${row.label}: ${format(row.value)}`}>
          <span className="truncate text-brand-700">
            {row.href ? (
              <Link href={row.href} className="hover:underline">
                {row.label}
              </Link>
            ) : (
              row.label
            )}
            {row.detail && <span className="block text-xs text-brand-400">{row.detail}</span>}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-3 max-w-[85%] rounded-r bg-chart-single"
              style={{ width: `${Math.max(2, (row.value / max) * 85)}%` }}
              aria-hidden
            />
            <span className="shrink-0 tabular-nums text-brand-800">{format(row.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
