/** "12 → 7 (−5)" for the history tables. */
export function QuantityChange({ from, to, compact = false }: { from: number; to: number; compact?: boolean }) {
  const delta = to - from;
  const deltaText = delta > 0 ? `+${delta}` : `${delta}`;
  const tone = delta > 0 ? "text-brand-600" : "text-red-700";

  if (compact) return <span className={`font-semibold tabular-nums ${tone}`}>{deltaText}</span>;

  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-brand-400">{from} → </span>
      <span className="font-semibold">{to}</span>
      <span className={`ml-2 text-xs ${tone}`}>({deltaText})</span>
    </span>
  );
}
