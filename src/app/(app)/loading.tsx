export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-md bg-cream-300" />
      <div className="h-64 animate-pulse rounded-xl border border-cream-300 bg-cream-100" />
    </div>
  );
}
