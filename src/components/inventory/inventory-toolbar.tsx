"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CategoryField } from "@/lib/custom-fields";
import {
  defaultDir,
  type FieldFilter,
  type InventoryParams,
  inventorySearch,
  SORTS,
  type Sort,
} from "@/lib/inventory-params";

type Option = { id: string; name: string };

/** Search, filters, sort and view switch for the inventory. Changes apply immediately. */
export function InventoryToolbar({
  state,
  categories,
  locations,
  categoryFields,
  fixedLocationId,
}: {
  state: InventoryParams;
  categories: Option[];
  locations: Option[];
  /** Custom fields of the selected category (when exactly one is selected). */
  categoryFields: CategoryField[];
  fixedLocationId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(state.q);

  const go = (changes: Partial<InventoryParams>) => {
    const next = { ...state, q, ...changes, page: 1 };
    // Field filters only make sense for the category they belong to.
    if (changes.categories) next.fieldFilters = [];
    if (changes.categories && next.sort.startsWith("field:")) next.sort = "name";
    const search = inventorySearch(next, { fixedLocation: Boolean(fixedLocationId) });
    startTransition(() => router.replace(`${pathname}${search.size ? `?${search}` : ""}`, { scroll: false }));
  };

  // Search as you type (after a short pause).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => go({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const exportSearch = inventorySearch({ ...state, q }, { includePage: false });
  if (fixedLocationId) exportSearch.set("loc", fixedLocationId);

  return (
    <div className="mb-4 space-y-2">
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={categoryFields.length ? "Search name, SKU or details" : "Search by name or SKU"}
          aria-label="Search"
          className="block h-11 w-full rounded-lg border border-cream-400 bg-cream-50 pl-10 pr-3 text-base text-ink placeholder:text-brand-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:text-sm"
        />
        <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-300">
          ⌕
        </span>
        {pending && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-400">Loading…</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          label="Category"
          options={[...categories, { id: "none", name: "Uncategorized" }]}
          selected={state.categories}
          onChange={(categories) => go({ categories })}
        />
        {!fixedLocationId && (
          <MultiSelect label="Location" options={locations} selected={state.locations} onChange={(locs) => go({ locations: locs })} />
        )}
        {categoryFields.length > 0 && (
          <FieldFilters fields={categoryFields} filters={state.fieldFilters} onChange={(fieldFilters) => go({ fieldFilters })} />
        )}
        <Toggle pressed={state.lowStock} onClick={() => go({ lowStock: !state.lowStock })} tone="danger">
          Low stock
        </Toggle>
        <Toggle pressed={state.checkoutable} onClick={() => go({ checkoutable: !state.checkoutable })}>
          Checkoutable
        </Toggle>
        <Toggle pressed={state.archived} onClick={() => go({ archived: !state.archived })}>
          Archived
        </Toggle>

        <label className="inline-flex h-9 items-center gap-1 rounded-lg border border-cream-400 bg-cream-50 pl-3 text-sm text-brand-700">
          <span className="text-brand-400">Sort</span>
          <select
            value={state.sort}
            onChange={(e) => {
              const sort = e.target.value as Sort;
              go({ sort, dir: defaultDir(sort) });
            }}
            className="h-full max-w-40 rounded-r-lg bg-transparent pr-2 font-medium outline-none"
          >
            {Object.entries(SORTS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            {categoryFields.map((f) => (
              <option key={f.id} value={`field:${f.id}`}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => go({ dir: state.dir === "asc" ? "desc" : "asc" })}
          className="inline-flex h-9 items-center rounded-lg border border-cream-400 bg-cream-50 px-3 text-sm text-brand-700 hover:bg-cream-100"
          aria-label={state.dir === "asc" ? "Sorted ascending. Switch to descending" : "Sorted descending. Switch to ascending"}
        >
          {state.dir === "asc" ? "↑ Asc" : "↓ Desc"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={`/api/export/inventory?${exportSearch}`}
            className="inline-flex h-9 items-center rounded-lg border border-cream-400 bg-cream-50 px-3 text-sm text-brand-700 hover:bg-cream-100"
            title="Download the items shown (all pages) as a spreadsheet"
          >
            Export CSV
          </a>
          <div className="inline-flex h-9 overflow-hidden rounded-lg border border-cream-400" role="group" aria-label="View">
            {(["grid", "table"] as const).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={state.view === view}
                onClick={() => go({ view })}
                className={`px-3 text-sm ${state.view === view ? "bg-brand text-cream" : "bg-cream-50 text-brand-700 hover:bg-cream-100"}`}
              >
                {view === "grid" ? "▦ Grid" : "☰ Table"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  pressed,
  onClick,
  tone,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  tone?: "danger";
  children: React.ReactNode;
}) {
  const on = tone === "danger" ? "border-red-300 bg-red-50 text-red-800" : "border-brand-500 bg-brand-50 text-brand-800";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-9 items-center rounded-lg border px-3 text-sm ${
        pressed ? on : "border-cream-400 bg-cream-50 text-brand-700 hover:bg-cream-100"
      }`}
    >
      {children}
    </button>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return { open, setOpen, ref };
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const [draft, setDraft] = useState(selected);

  // Apply when the menu closes, so ticking several boxes is one search.
  const closeAndApply = (next = draft) => {
    setOpen(false);
    if (next.join() !== selected.join()) onChange(next);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && closeAndApply();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAndApply();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  });

  const summary =
    selected.length === 0
      ? "All"
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.name ?? "1 selected")
        : `${selected.length} selected`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (open) closeAndApply();
          else {
            setDraft(selected);
            setOpen(true);
          }
        }}
        className={`inline-flex h-9 max-w-56 items-center gap-1 rounded-lg border px-3 text-sm ${
          selected.length ? "border-brand-500 bg-brand-50 text-brand-800" : "border-cream-400 bg-cream-50 text-brand-700 hover:bg-cream-100"
        }`}
      >
        <span className="text-brand-400">{label}</span>
        <span className="truncate font-medium">{summary}</span>
        <span aria-hidden className="text-brand-400">
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-cream-300 bg-cream-50 p-2 shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            {options.length === 0 && <p className="px-2 py-1.5 text-sm text-brand-400">Nothing to filter yet.</p>}
            {options.map((option) => (
              <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-brand-800 hover:bg-cream-100">
                <input
                  type="checkbox"
                  className="size-4 accent-[#2f6b47]"
                  checked={draft.includes(option.id)}
                  onChange={(e) => setDraft(e.target.checked ? [...draft, option.id] : draft.filter((id) => id !== option.id))}
                />
                {option.name}
              </label>
            ))}
          </div>
          <div className="mt-1 flex justify-between border-t border-cream-300 pt-2">
            <button type="button" className="rounded-md px-2 py-1 text-sm text-brand-500 hover:bg-cream-100" onClick={() => closeAndApply([])}>
              Clear
            </button>
            <button type="button" className="rounded-md bg-brand px-3 py-1 text-sm font-semibold text-cream" onClick={() => closeAndApply()}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Filters on the selected category's custom fields. */
function FieldFilters({
  fields,
  filters,
  onChange,
}: {
  fields: CategoryField[];
  filters: FieldFilter[];
  onChange: (filters: FieldFilter[]) => void;
}) {
  const { open, setOpen, ref } = usePopover();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, ref, setOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm ${
          filters.length ? "border-brand-500 bg-brand-50 text-brand-800" : "border-cream-400 bg-cream-50 text-brand-700 hover:bg-cream-100"
        }`}
      >
        Details{filters.length ? ` (${filters.length})` : ""} ▾
      </button>
      {open && (
        <form
          className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-cream-300 bg-cream-50 p-3 shadow-lg"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const next: FieldFilter[] = [];
            for (const field of fields) {
              for (const op of ["eq", "contains", "gte", "lte"] as const) {
                const value = String(data.get(`${field.id}~${op}`) ?? "").trim();
                if (value) next.push({ id: field.id, op, value });
              }
            }
            setOpen(false);
            onChange(next);
          }}
        >
          {fields.map((field) => {
            const current = (op: FieldFilter["op"]) => filters.find((f) => f.id === field.id && f.op === op)?.value ?? "";
            const inputClass = "w-full rounded-md border border-cream-400 bg-cream-50 px-2 py-1.5 text-sm text-ink";
            return (
              <fieldset key={field.id} className="space-y-1">
                <legend className="text-xs font-semibold text-brand-600">{field.label}</legend>
                {field.field_type === "select" || field.field_type === "boolean" ? (
                  <select name={`${field.id}~eq`} defaultValue={current("eq")} className={inputClass}>
                    <option value="">Any</option>
                    {(field.field_type === "boolean" ? ["yes", "no"] : field.options).map((o) => (
                      <option key={o} value={o}>
                        {field.field_type === "boolean" ? (o === "yes" ? "Yes" : "No") : o}
                      </option>
                    ))}
                  </select>
                ) : field.field_type === "text" ? (
                  <input name={`${field.id}~contains`} defaultValue={current("contains")} placeholder="Contains…" className={inputClass} />
                ) : (
                  <div className="flex gap-2">
                    <input
                      name={`${field.id}~gte`}
                      type={field.field_type === "date" ? "date" : "number"}
                      defaultValue={current("gte")}
                      placeholder="From"
                      aria-label={`${field.label} from`}
                      className={inputClass}
                    />
                    <input
                      name={`${field.id}~lte`}
                      type={field.field_type === "date" ? "date" : "number"}
                      defaultValue={current("lte")}
                      placeholder="To"
                      aria-label={`${field.label} to`}
                      className={inputClass}
                    />
                  </div>
                )}
              </fieldset>
            );
          })}
          <div className="flex justify-between border-t border-cream-300 pt-2">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm text-brand-500 hover:bg-cream-100"
              onClick={() => {
                setOpen(false);
                onChange([]);
              }}
            >
              Clear
            </button>
            <button type="submit" className="rounded-md bg-brand px-3 py-1 text-sm font-semibold text-cream">
              Apply
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
