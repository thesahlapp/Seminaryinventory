"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Option = { id: string; name: string };
type Sort = "name" | "quantity" | "category" | "updated";

const SORT_LABELS: Record<Sort, string> = {
  name: "Name",
  quantity: "Quantity",
  category: "Category",
  updated: "Last updated",
};
const DEFAULT_DIR: Record<Sort, "asc" | "desc"> = { name: "asc", quantity: "desc", category: "asc", updated: "desc" };

export type ToolbarState = {
  q: string;
  categories: string[];
  locations: string[];
  archived: boolean;
  sort: Sort;
  dir: "asc" | "desc";
  view: "grid" | "table";
};

/** Search, filters, sort and view switch for the inventory. Changes apply immediately. */
export function InventoryToolbar({
  state,
  categories,
  locations,
  showLocationFilter = true,
}: {
  state: ToolbarState;
  categories: Option[];
  locations: Option[];
  showLocationFilter?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(state.q);

  const go = (changes: Partial<ToolbarState>) => {
    const next = { ...state, q, ...changes };
    const search = new URLSearchParams();
    if (next.q.trim()) search.set("q", next.q.trim());
    if (next.categories.length) search.set("cat", next.categories.join(","));
    if (showLocationFilter && next.locations.length) search.set("loc", next.locations.join(","));
    if (next.archived) search.set("show", "archived");
    if (next.sort !== "name") search.set("sort", next.sort);
    if (next.dir !== DEFAULT_DIR[next.sort]) search.set("dir", next.dir);
    if (next.view !== "grid") search.set("view", next.view);
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

  const categoryOptions = [...categories, { id: "none", name: "Uncategorized" }];

  return (
    <div className="mb-4 space-y-2">
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or SKU"
          aria-label="Search by name or SKU"
          className="block h-11 w-full rounded-lg border border-cream-400 bg-cream-50 pl-10 pr-3 text-base text-ink placeholder:text-brand-300 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 sm:text-sm"
        />
        <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-300">
          ⌕
        </span>
        {pending && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-400">Loading…</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          label="Category"
          options={categoryOptions}
          selected={state.categories}
          onChange={(categories) => go({ categories })}
        />
        {showLocationFilter && (
          <MultiSelect
            label="Location"
            options={locations}
            selected={state.locations}
            onChange={(locs) => go({ locations: locs })}
          />
        )}

        <label className="inline-flex h-9 items-center gap-1 rounded-lg border border-cream-400 bg-cream-50 pl-3 text-sm text-brand-700">
          <span className="text-brand-400">Sort</span>
          <select
            value={state.sort}
            onChange={(e) => {
              const sort = e.target.value as Sort;
              go({ sort, dir: DEFAULT_DIR[sort] });
            }}
            className="h-full rounded-r-lg bg-transparent pr-2 font-medium outline-none"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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

        <button
          type="button"
          aria-pressed={state.archived}
          onClick={() => go({ archived: !state.archived })}
          className={`inline-flex h-9 items-center rounded-lg border px-3 text-sm ${
            state.archived ? "border-brand bg-brand-50 text-brand" : "border-cream-400 bg-cream-50 text-brand-700 hover:bg-cream-100"
          }`}
        >
          Archived
        </button>

        <div className="ml-auto inline-flex h-9 overflow-hidden rounded-lg border border-cream-400" role="group" aria-label="View">
          {(["grid", "table"] as const).map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={state.view === view}
              onClick={() => go({ view })}
              className={`px-3 text-sm capitalize ${state.view === view ? "bg-brand text-cream" : "bg-cream-50 text-brand-700 hover:bg-cream-100"}`}
            >
              {view === "grid" ? "▦ Grid" : "☰ Table"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(selected);
  const ref = useRef<HTMLDivElement>(null);

  // Apply when the menu closes, so ticking several boxes is one search.
  const closeAndApply = (next = draft) => {
    setOpen(false);
    if (next.join() !== selected.join()) onChange(next);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeAndApply();
    };
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
          selected.length ? "border-brand bg-brand-50 text-brand" : "border-cream-400 bg-cream-50 text-brand-700 hover:bg-cream-100"
        }`}
      >
        <span className="text-brand-400">{label}</span>
        <span className="truncate font-medium">{summary}</span>
        <span aria-hidden className="text-brand-400">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-cream-300 bg-cream-50 p-2 shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            {options.length === 0 && <p className="px-2 py-1.5 text-sm text-brand-400">Nothing to filter yet.</p>}
            {options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-brand-800 hover:bg-cream-100"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={draft.includes(option.id)}
                  onChange={(e) =>
                    setDraft(e.target.checked ? [...draft, option.id] : draft.filter((id) => id !== option.id))
                  }
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
