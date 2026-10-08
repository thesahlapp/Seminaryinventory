"use client";

import { toCsv } from "@/lib/csv";

/** Downloads a table as CSV (built in the browser from the data on screen). */
export function CsvButton({ filename, header, rows }: { filename: string; header: string[]; rows: (string | number | null)[][] }) {
  return (
    <button
      type="button"
      className="rounded-md border border-cream-400 bg-cream-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-cream-100"
      onClick={() => {
        const blob = new Blob([toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      Download CSV
    </button>
  );
}
