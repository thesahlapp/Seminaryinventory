"use client";

export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-cream"
    >
      Try again
    </button>
  );
}
