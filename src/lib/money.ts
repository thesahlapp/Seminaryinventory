const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return currency.format(Number(value));
}

export function formatMoneyCompact(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  return Math.abs(n) >= 10_000 ? compactCurrency.format(n) : currency.format(n);
}
