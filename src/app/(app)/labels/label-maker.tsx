"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardHeader, Input, Select } from "@/components/ui";
import { LABEL_TEMPLATES, type LabelTemplate } from "@/lib/label-templates";
import { qrPath } from "@/lib/qr";
import { type LabelSource, searchLabelSources } from "./actions";

type Entry = {
  key: string;
  path: string;
  title: string;
  subtitle: string | null;
  sku: string | null;
  copies: number;
};

const KIND_LABELS = { item: "Items", location: "Locations", kit: "Kits" } as const;

function entriesFor(source: LabelSource, variantIds?: string[]): Entry[] {
  if (source.kind === "item" && source.sizes.length && variantIds) {
    return source.sizes
      .filter((s) => variantIds.includes(s.id))
      .map((s) => ({
        key: `v:${s.id}`,
        path: qrPath("variant", s.id),
        title: source.name,
        subtitle: `Size ${s.label}`,
        sku: source.sku,
        copies: 1,
      }));
  }
  return [
    {
      key: `${source.kind}:${source.id}`,
      path: qrPath(source.kind, source.id),
      title: source.name,
      subtitle: source.kind === "location" ? "Location" : source.kind === "kit" ? "Kit" : null,
      sku: source.sku,
      copies: 1,
    },
  ];
}

export function LabelMaker({ initial }: { initial: LabelSource[] }) {
  const [entries, setEntries] = useState<Entry[]>(() =>
    initial.flatMap((s) => entriesFor(s, s.sizes.length ? s.sizes.map((x) => x.id) : undefined)),
  );
  const [kind, setKind] = useState<LabelSource["kind"]>("item");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LabelSource[]>([]);
  const [templateId, setTemplateId] = useState("5160");
  const [startAt, setStartAt] = useState(1);
  const [showSku, setShowSku] = useState(true);
  const [svgs, setSvgs] = useState<Record<string, string>>({});

  const template = LABEL_TEMPLATES.find((t) => t.id === templateId)!;
  const perSheet = template.columns * template.rows;

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const found = await searchLabelSources(kind, query);
      if (!cancelled) setResults(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [kind, query]);

  // Generate each distinct QR code once.
  useEffect(() => {
    const missing = [...new Set(entries.map((e) => e.path))].filter((p) => !svgs[p]);
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(
      missing.map(async (path) => [
        path,
        await QRCode.toString(`${window.location.origin}${path}`, {
          type: "svg",
          margin: 0,
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        }),
      ]),
    ).then((pairs) => !cancelled && setSvgs((prev) => ({ ...prev, ...Object.fromEntries(pairs) })));
    return () => {
      cancelled = true;
    };
  }, [entries, svgs]);

  const add = (newEntries: Entry[]) =>
    setEntries((prev) => [...prev, ...newEntries.filter((e) => !prev.some((p) => p.key === e.key))]);

  // Blank positions first (for part-used sheets), then each label repeated by its copies.
  const slots = useMemo(() => {
    const labels = entries.flatMap((e) => Array.from({ length: Math.max(1, e.copies) }, () => e));
    return [...Array.from({ length: Math.max(0, startAt - 1) }, () => null), ...labels];
  }, [entries, startAt]);
  const sheets = Array.from({ length: Math.ceil(slots.length / perSheet) }, (_, i) => slots.slice(i * perSheet, (i + 1) * perSheet));
  const labelCount = slots.filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Exact page size and no browser margins when printing */}
      <style>{`@page { size: ${template.page.css}; margin: 0; }`}</style>

      <div className="print:hidden">
        <h1 className="font-display text-2xl font-semibold text-brand-700">Print labels</h1>
        <p className="mt-1 text-sm text-brand-500">
          Pick what to label, choose your Avery sheet, then Print. In the print dialog, set scale to 100% (“Actual size”)
          and turn off headers and footers.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] print:hidden">
        <Card>
          <CardHeader title="Add labels" />
          <div className="space-y-3 p-4">
            <div className="flex gap-1 rounded-lg bg-cream-200 p-1" role="tablist">
              {(Object.keys(KIND_LABELS) as LabelSource["kind"][]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  onClick={() => setKind(k)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${kind === k ? "bg-cream-50 text-brand-700 shadow-sm" : "text-brand-600"}`}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${KIND_LABELS[kind].toLowerCase()}`} />
            <ul className="max-h-80 divide-y divide-cream-200 overflow-y-auto rounded-lg border border-cream-300">
              {results.length === 0 && <li className="px-3 py-3 text-sm text-brand-400">Nothing found.</li>}
              {results.map((source) => (
                <li key={source.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium text-brand-800">{source.name}</span>
                    {source.sku && <span className="ml-2 font-mono text-xs text-brand-400">{source.sku}</span>}
                    {source.sizes.length > 0 && (
                      <span className="block text-xs text-brand-400">{source.sizes.map((s) => s.label).join(", ")}</span>
                    )}
                  </span>
                  <span className="flex gap-1.5">
                    {source.sizes.length > 0 && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => add(entriesFor(source, source.sizes.map((s) => s.id)))}>
                        + Each size
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="secondary" onClick={() => add(entriesFor(source))}>
                      + {source.sizes.length ? "One label" : "Add"}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title={`Selected (${labelCount} label${labelCount === 1 ? "" : "s"})`} />
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-brand-500">
                Label sheet
                <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  {LABEL_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.description}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1 text-xs font-medium text-brand-500">
                Start at label # (skip used labels)
                <Input type="number" min={1} max={perSheet} value={startAt} onChange={(e) => setStartAt(Math.min(perSheet, Math.max(1, Number(e.target.value) || 1)))} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-brand-700">
              <input type="checkbox" checked={showSku} onChange={(e) => setShowSku(e.target.checked)} className="size-4 accent-[#2f6b47]" />
              Show SKU on item labels
            </label>
            {entries.length === 0 ? (
              <p className="text-sm text-brand-400">Nothing selected yet.</p>
            ) : (
              <ul className="max-h-64 divide-y divide-cream-200 overflow-y-auto rounded-lg border border-cream-300">
                {entries.map((entry) => (
                  <li key={entry.key} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-brand-800">{entry.title}</span>
                      {entry.subtitle && <span className="text-brand-500"> · {entry.subtitle}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <label className="flex items-center gap-1 text-xs text-brand-500">
                        ×
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={entry.copies}
                          aria-label={`Copies of ${entry.title} ${entry.subtitle ?? ""}`}
                          onChange={(e) =>
                            setEntries(entries.map((x) => (x.key === entry.key ? { ...x, copies: Math.max(1, Number(e.target.value) || 1) } : x)))
                          }
                          className="w-14 rounded border border-cream-400 bg-cream-50 px-1.5 py-0.5 text-sm text-ink"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setEntries(entries.filter((x) => x.key !== entry.key))}
                        className="rounded px-1.5 text-brand-400 hover:text-red-700"
                        aria-label={`Remove ${entry.title}`}
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={labelCount === 0} onClick={() => window.print()}>
                Print {sheets.length} sheet{sheets.length === 1 ? "" : "s"}
              </Button>
              {entries.length > 0 && (
                <Button type="button" variant="ghost" onClick={() => setEntries([])}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {labelCount > 0 && (
        <section aria-label="Preview">
          <h2 className="mb-2 text-sm font-medium text-brand-500 print:hidden">Preview</h2>
          <div className="space-y-4 print:space-y-0">
            {sheets.map((sheet, i) => (
              <ScaledSheet key={i} template={template}>
                {sheet.map((entry, position) =>
                  entry ? (
                    <Label
                      key={position}
                      template={template}
                      position={position}
                      entry={entry}
                      svg={svgs[entry.path]}
                      showSku={showSku}
                    />
                  ) : null,
                )}
              </ScaledSheet>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** One physical sheet at true size, scaled down to fit the screen (but not when printing). */
function ScaledSheet({ template, children }: { template: LabelTemplate; children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const mmToPx = 96 / 25.4;

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / (template.page.width * mmToPx)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [template, mmToPx]);

  return (
    <div ref={outerRef} className="w-full print:h-auto! print:w-auto" style={{ height: `calc(${template.page.height}mm * ${scale})` }}>
      <div
        className="force-light relative origin-top-left overflow-hidden bg-white shadow-md ring-1 ring-black/10 print:break-after-page print:shadow-none print:ring-0 print:[transform:none]"
        style={{ width: `${template.page.width}mm`, height: `${template.page.height}mm`, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

function Label({
  template,
  position,
  entry,
  svg,
  showSku,
}: {
  template: LabelTemplate;
  position: number;
  entry: Entry;
  svg: string | undefined;
  showSku: boolean;
}) {
  const col = position % template.columns;
  const row = Math.floor(position / template.columns);
  const { width, height } = template.label;
  const pad = Math.min(2.5, height * 0.08);
  const qr = Math.min(height - pad * 2, width * 0.42);
  const titleSize = Math.max(7, Math.min(14, height * 0.28)); // points

  return (
    <div
      className="absolute flex items-center overflow-hidden text-black"
      style={{
        left: `${template.margin.left + col * template.pitch.x}mm`,
        top: `${template.margin.top + row * template.pitch.y}mm`,
        width: `${width}mm`,
        height: `${height}mm`,
        padding: `${pad}mm`,
        gap: `${pad}mm`,
      }}
    >
      <div
        className="shrink-0 [&>svg]:h-full [&>svg]:w-full"
        style={{ width: `${qr}mm`, height: `${qr}mm` }}
        // The SVG comes from the qrcode library, not from user input.
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
      <div className="min-w-0 leading-tight">
        <p className="line-clamp-2 font-semibold" style={{ fontSize: `${titleSize}pt` }}>
          {entry.title}
        </p>
        {entry.subtitle && (
          <p className="font-medium" style={{ fontSize: `${titleSize * 0.85}pt` }}>
            {entry.subtitle}
          </p>
        )}
        {showSku && entry.sku && (
          <p className="font-mono" style={{ fontSize: `${Math.max(6, titleSize * 0.7)}pt` }}>
            {entry.sku}
          </p>
        )}
      </div>
    </div>
  );
}
