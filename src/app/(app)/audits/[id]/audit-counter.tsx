"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QrReader } from "@/components/qr/qr-reader";
import { Alert, Button, Input } from "@/components/ui";
import { type CountOption, findCountOptions, recordCount } from "../actions";

export type AuditLine = {
  variantId: string;
  itemName: string;
  sizeLabel: string | null;
  expected: number;
  counted: number | null;
  countedBy: string | null;
};

/** Counting screen: tap or scan items and enter what's really there. */
export function AuditCounter({ auditId, lines: serverLines }: { auditId: string; lines: AuditLine[] }) {
  const router = useRouter();
  const [lines, setLines] = useState(serverLines);
  const [lastServer, setLastServer] = useState(serverLines);
  const [filter, setFilter] = useState("");
  const [uncountedOnly, setUncountedOnly] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [choices, setChoices] = useState<CountOption[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The line being typed in (only one input can have focus).
  const [editingId, setEditingId] = useState<string | null>(null);

  // Take fresh counts from the server (others counting), except the line being typed in.
  if (lastServer !== serverLines) {
    setLastServer(serverLines);
    setLines(serverLines.map((s) => (s.variantId === editingId ? (lines.find((l) => l.variantId === s.variantId) ?? s) : s)));
  }

  // Refresh every 15 seconds while the page is visible, to see other people's counts.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), 15000);
    return () => clearInterval(t);
  }, [router]);

  async function save(option: CountOption | AuditLine, counted: number | null) {
    setError(null);
    const result = await recordCount(auditId, option.variantId, counted);
    if ("error" in result) {
      setError(result.error ?? "Couldn't save the count.");
      return;
    }
    setLines((current) => {
      const existing = current.find((l) => l.variantId === option.variantId);
      const updated: AuditLine = {
        variantId: option.variantId,
        itemName: option.itemName,
        sizeLabel: option.sizeLabel,
        expected: result.expected,
        counted: result.counted,
        countedBy: result.by,
      };
      return existing ? current.map((l) => (l.variantId === option.variantId ? updated : l)) : [updated, ...current];
    });
  }

  function focusLine(variantId: string) {
    setHighlight(variantId);
    setFilter("");
    setUncountedOnly(false);
    requestAnimationFrame(() => {
      const input = document.getElementById(`count-${variantId}`) as HTMLInputElement | null;
      input?.scrollIntoView({ block: "center", behavior: "smooth" });
      input?.focus();
    });
  }

  async function pick(option: CountOption) {
    setChoices(null);
    setScanning(false);
    if (!lines.some((l) => l.variantId === option.variantId)) {
      // Not expected here: add it to the list (count starts empty).
      setLines((current) => [
        { variantId: option.variantId, itemName: option.itemName, sizeLabel: option.sizeLabel, expected: 0, counted: null, countedBy: null },
        ...current,
      ]);
    }
    focusLine(option.variantId);
  }

  const counted = lines.filter((l) => l.counted !== null).length;
  const term = filter.trim().toLowerCase();
  const shown = lines.filter(
    (l) => (!uncountedOnly || l.counted === null) && (!term || `${l.itemName} ${l.sizeLabel ?? ""}`.toLowerCase().includes(term)),
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-sm text-brand-600">
          <span>
            {counted} of {lines.length} counted
          </span>
          <span>{lines.length ? Math.round((counted / lines.length) * 100) : 0}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream-300" aria-hidden>
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${lines.length ? (counted / lines.length) * 100 : 0}%` }} />
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setScanning(true)}>
          Scan a label
        </Button>
        <Input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find on the list" aria-label="Find on the list" className="min-w-40 flex-1" />
        <label className="flex items-center gap-2 text-sm text-brand-700">
          <input type="checkbox" checked={uncountedOnly} onChange={(e) => setUncountedOnly(e.target.checked)} className="size-4 accent-[#2f6b47]" />
          Not counted yet
        </label>
      </div>

      <details className="rounded-lg border border-cream-300 bg-cream-50">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-brand-600">Found something that isn&apos;t on the list?</summary>
        <div className="space-y-2 border-t border-cream-300 p-3">
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setChoices(await findCountOptions({ query: searchQuery }));
            }}
          >
            <Input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Item name" aria-label="Search all items" />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </div>
      </details>

      {choices && !scanning && <Choices options={choices} onPick={pick} onClose={() => setChoices(null)} />}

      <ul className="divide-y divide-cream-200 overflow-hidden rounded-xl border border-cream-300 bg-cream-50">
        {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-brand-400">Nothing to show.</li>}
        {shown.map((line) => (
          <CountRow
            key={line.variantId}
            line={line}
            highlight={highlight === line.variantId}
            onEditing={(on) => setEditingId(on ? line.variantId : null)}
            onSave={(n) => save(line, n)}
          />
        ))}
      </ul>

      {scanning && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Scan a label to count">
          <QrReader
            continuous
            className="flex-1 pt-[env(safe-area-inset-top)] [&>div:first-child]:flex-1"
            onResult={async (path) => {
              const options = await findCountOptions({ path });
              if (options.length === 1) pick(options[0]);
              else if (options.length > 1) setChoices(options);
            }}
            footer={
              <>
                {choices && <Choices options={choices} onPick={pick} onClose={() => setChoices(null)} dark />}
                <button type="button" onClick={() => setScanning(false)} className="rounded-full bg-white/15 px-5 py-2 text-sm font-medium">
                  Done scanning
                </button>
              </>
            }
          />
        </div>
      )}
    </div>
  );
}

function Choices({ options, onPick, onClose, dark }: { options: CountOption[]; onPick: (o: CountOption) => void; onClose: () => void; dark?: boolean }) {
  return (
    <div className={`rounded-lg p-3 text-left ${dark ? "bg-white/10 text-white" : "border border-cream-300 bg-cream-50"}`}>
      <p className="mb-2 text-sm font-medium">{options.length ? "Which one?" : "Nothing found."}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.variantId}
            type="button"
            onClick={() => onPick(o)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${dark ? "bg-white/20" : "bg-brand-50 text-brand-800 ring-1 ring-brand-200"}`}
          >
            {o.itemName}
            {o.sizeLabel && ` · ${o.sizeLabel}`}
          </button>
        ))}
        <button type="button" onClick={onClose} className="px-2 text-sm underline">
          Close
        </button>
      </div>
    </div>
  );
}

function CountRow({
  line,
  highlight,
  onEditing,
  onSave,
}: {
  line: AuditLine;
  highlight: boolean;
  onEditing: (editing: boolean) => void;
  onSave: (counted: number | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const value = draft ?? (line.counted === null ? "" : String(line.counted));
  const differs = line.counted !== null && line.counted !== line.expected;

  async function commit(next: string) {
    onEditing(false);
    setDraft(null);
    const text = next.trim();
    const counted = text === "" ? null : Number(text);
    if (counted !== null && (!Number.isInteger(counted) || counted < 0)) return;
    if (counted === line.counted) return;
    setSaving(true);
    await onSave(counted);
    setSaving(false);
  }

  const step = (delta: number) => {
    const base = line.counted ?? 0;
    const next = Math.max(0, base + delta);
    void commit(String(next));
  };

  return (
    <li className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${highlight ? "bg-brand-50" : ""} ${differs ? "border-l-4 border-l-amber-400" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-brand-800">
          {line.itemName}
          {line.sizeLabel && <span className="text-brand-500"> · {line.sizeLabel}</span>}
        </p>
        <p className="text-xs text-brand-400">
          Expected {line.expected}
          {line.counted !== null && line.countedBy && ` · counted by ${line.countedBy}`}
          {differs && <span className="font-medium text-amber-800"> · {line.counted! - line.expected > 0 ? "+" : ""}{line.counted! - line.expected}</span>}
        </p>
      </div>
      <div className={`inline-flex items-stretch overflow-hidden rounded-lg bg-cream-50 ring-1 ${saving ? "ring-brand-300" : line.counted !== null ? "ring-brand-400" : "ring-cream-400"}`}>
        <button type="button" onClick={() => step(-1)} className="flex size-10 items-center justify-center text-lg font-semibold text-brand-700 hover:bg-cream-200" aria-label={`One less: ${line.itemName}`}>
          −
        </button>
        <input
          id={`count-${line.variantId}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          placeholder="—"
          aria-label={`Counted: ${line.itemName}${line.sizeLabel ? ` ${line.sizeLabel}` : ""}`}
          onFocus={(e) => {
            onEditing(true);
            setDraft(value);
            e.target.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="h-10 w-16 border-x border-cream-300 bg-transparent text-center font-semibold tabular-nums text-ink outline-none focus:bg-cream-100"
        />
        <button type="button" onClick={() => step(1)} className="flex size-10 items-center justify-center text-lg font-semibold text-brand-700 hover:bg-cream-200" aria-label={`One more: ${line.itemName}`}>
          +
        </button>
      </div>
    </li>
  );
}
