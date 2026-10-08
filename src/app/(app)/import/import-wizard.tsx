"use client";

import Papa from "papaparse";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert, Badge, Button, Card, CardHeader, Select } from "@/components/ui";
import { applyImport, type ImportSummary, type MappedRow, previewImport, type RowResult } from "./actions";

export type Target = { key: string; label: string; aliases: string[] };

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function ImportWizard({ targets }: { targets: Target[] }) {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ summary: ImportSummary; results: RowResult[] } | null>(null);
  const [done, setDone] = useState<{ created: number; updated: number; quantityChanges: number; failed: string[] } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();

  function load(file: File) {
    setError(null);
    setFileName(file.name);
    Papa.parse<string[]>(file, {
      skipEmptyLines: "greedy",
      complete: ({ data: parsed, errors }) => {
        if (errors.length && !parsed.length) return setError(`Couldn't read that file: ${errors[0].message}`);
        const [head, ...rest] = parsed;
        if (!head?.length || !rest.length) return setError("The file needs a header row and at least one data row.");
        const cleanHead = head.map((h) => String(h ?? "").replace(/^﻿/, "").trim());
        setHeaders(cleanHead);
        setData(rest.map((r) => r.map((c) => String(c ?? "").replace(/^'(?=[=+\-@])/, ""))));
        // Guess the mapping from the column names.
        const guess: Record<number, string> = {};
        const used = new Set<string>();
        cleanHead.forEach((h, i) => {
          const n = normalize(h);
          const target = targets.find((t) => !used.has(t.key) && (normalize(t.label) === n || t.aliases.includes(n)));
          if (target) {
            guess[i] = target.key;
            used.add(target.key);
          }
        });
        setMapping(guess);
        setStep("map");
      },
      error: (e) => setError(`Couldn't read that file: ${e.message}`),
    });
  }

  function mappedRows(): MappedRow[] {
    return data.map((cells, i) => ({
      row: i + 2, // spreadsheet row number (after the header)
      values: Object.fromEntries(
        Object.entries(mapping)
          .filter(([, key]) => key)
          .map(([col, key]) => [key, cells[Number(col)] ?? ""]),
      ),
    }));
  }

  const duplicateTargets = Object.values(mapping).filter((k, i, all) => k && all.indexOf(k) !== i);

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm">
        {(["upload", "map", "preview", "done"] as const).map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 ${step === s ? "bg-brand text-cream" : "bg-cream-200 text-brand-500"}`}>
            {i + 1}. {s === "upload" ? "Upload" : s === "map" ? "Match columns" : s === "preview" ? "Preview" : "Done"}
          </li>
        ))}
      </ol>

      {error && <Alert>{error}</Alert>}

      {step === "upload" && (
        <Card className="space-y-4 p-5">
          <p className="text-sm text-brand-700">
            Start from the{" "}
            <a href="/api/export/template" className="font-medium underline">
              CSV template
            </a>{" "}
            (it has a column for each of your locations and custom fields), or from an{" "}
            <Link href="/items" className="font-medium underline">
              inventory export
            </Link>{" "}
            to update existing items.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-brand-600">
            <li>One row per item, or per item and size for clothing (repeat the name/SKU on each size row).</li>
            <li>Items are matched by Item ID, then SKU, then name + category. Anything not matched is created.</li>
            <li>Quantity columns set the count at that location. Blank cells are left unchanged.</li>
            <li>New categories and sizes in the file are created for you.</li>
          </ul>
          <label className="block">
            <span className="sr-only">Choose a CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => e.target.files?.[0] && load(e.target.files[0])}
              className="block w-full text-sm text-brand-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cream"
            />
          </label>
        </Card>
      )}

      {step === "map" && (
        <Card>
          <CardHeader title={`Match columns · ${fileName} · ${data.length.toLocaleString()} rows`} />
          <div className="space-y-4 p-4">
            <p className="text-sm text-brand-500">Choose what each column in your file means. Columns set to “Ignore” aren&apos;t imported.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-300 text-left text-xs uppercase tracking-wide text-brand-500">
                    <th className="px-2 py-2">Your column</th>
                    <th className="px-2 py-2">Example</th>
                    <th className="px-2 py-2">Import as</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((header, i) => (
                    <tr key={i} className="border-b border-cream-200">
                      <td className="px-2 py-2 font-medium text-brand-800">{header || <em className="text-brand-400">(blank)</em>}</td>
                      <td className="max-w-48 truncate px-2 py-2 text-brand-500">{data.find((r) => r[i])?.[i] ?? ""}</td>
                      <td className="px-2 py-2">
                        <Select
                          value={mapping[i] ?? ""}
                          onChange={(e) => setMapping({ ...mapping, [i]: e.target.value })}
                          aria-label={`Import ${header} as`}
                          className={duplicateTargets.includes(mapping[i]) ? "border-red-400" : ""}
                        >
                          <option value="">Ignore</option>
                          {targets.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {duplicateTargets.length > 0 && <Alert>Two columns are matched to the same thing. Each can be used once.</Alert>}
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={pending || duplicateTargets.length > 0}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await previewImport(mappedRows());
                    if (result.error) return setError(result.error);
                    setPreview({ summary: result.summary!, results: result.results! });
                    setStep("preview");
                  })
                }
              >
                {pending ? "Checking…" : "Preview"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("upload")}>
                Choose another file
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === "preview" && preview && (
        <Card>
          <CardHeader title="Preview" />
          <div className="space-y-4 p-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="New items" value={preview.summary.itemsToCreate} />
              <Stat label="Updated items" value={preview.summary.itemsToUpdate} />
              <Stat label="Quantities set" value={preview.summary.quantityChanges} />
              <Stat label="Rows with errors" value={preview.summary.errorRows} danger={preview.summary.errorRows > 0} />
            </dl>
            {(preview.summary.categoriesToCreate.length > 0 || preview.summary.sizesToCreate.length > 0) && (
              <p className="text-sm text-brand-600">
                {preview.summary.categoriesToCreate.length > 0 && <>New categories: {preview.summary.categoriesToCreate.join(", ")}. </>}
                {preview.summary.sizesToCreate.length > 0 && <>New sizes: {preview.summary.sizesToCreate.join(", ")}.</>}
              </p>
            )}
            {preview.summary.errorRows > 0 && (
              <Alert>Rows with errors are skipped (with every other row for the same item). Fix them in your file and import again, or go ahead with the rest.</Alert>
            )}
            <div className="overflow-x-auto rounded-lg border border-cream-300">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-300 text-left text-xs uppercase tracking-wide text-brand-500">
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAll ? preview.results : [...preview.results.filter((r) => r.status === "error"), ...preview.results.filter((r) => r.status !== "error")].slice(0, 100)).map((r) => (
                    <tr key={r.row} className={`border-b border-cream-200 ${r.status === "error" ? "bg-red-50/70" : ""}`}>
                      <td className="px-3 py-2 tabular-nums text-brand-500">{r.row}</td>
                      <td className="px-3 py-2">
                        {r.item}
                        {r.size && <span className="text-brand-500"> · {r.size}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={r.status === "error" ? "danger" : r.status === "create" ? "brand" : "neutral"}>
                          {r.status === "error" ? "Error" : r.status === "create" ? "Create" : "Update"}
                        </Badge>
                        {r.messages.map((m) => (
                          <p key={m} className="mt-1 text-xs text-red-800">
                            {m}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!showAll && preview.results.length > 100 && (
              <button type="button" className="text-sm text-brand-600 underline" onClick={() => setShowAll(true)}>
                Show all {preview.results.length.toLocaleString()} rows
              </button>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending || preview.summary.itemsToCreate + preview.summary.itemsToUpdate === 0}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await applyImport(mappedRows());
                    if (result.error) return setError(result.error);
                    setDone(result.done!);
                    setStep("done");
                  })
                }
              >
                {pending
                  ? "Importing…"
                  : `Import ${preview.summary.itemsToCreate + preview.summary.itemsToUpdate} item${preview.summary.itemsToCreate + preview.summary.itemsToUpdate === 1 ? "" : "s"}`}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("map")}>
                Back
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === "done" && done && (
        <Card className="space-y-3 p-5">
          <p className="font-display text-lg font-semibold text-brand-700">Import finished</p>
          <p className="text-sm text-brand-700">
            {done.created} created · {done.updated} updated · {done.quantityChanges} quantities changed (logged in the history as “CSV import”).
          </p>
          {done.failed.length > 0 && (
            <Alert>
              Some rows couldn&apos;t be saved:
              <ul className="mt-1 list-disc pl-5">
                {done.failed.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Alert>
          )}
          <div className="flex gap-2">
            <Link href="/items" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-cream">
              View inventory
            </Link>
            <Button type="button" variant="ghost" onClick={() => setStep("upload")}>
              Import another file
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-cream-300 bg-cream-100 px-3 py-2">
      <dt className="text-xs text-brand-500">{label}</dt>
      <dd className={`font-display text-xl font-semibold tabular-nums ${danger ? "text-red-700" : "text-brand-700"}`}>{value.toLocaleString()}</dd>
    </div>
  );
}
