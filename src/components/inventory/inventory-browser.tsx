import Link from "next/link";
import { Badge, Card, EmptyState, LinkButton } from "@/components/ui";
import { type CategoryField, formatFieldValue } from "@/lib/custom-fields";
import { formatDate } from "@/lib/format";
import { inventoryHref, loadInventory, PAGE_SIZE, parseInventoryParams, type InventoryRow } from "@/lib/inventory";
import { formatMoney } from "@/lib/money";
import { InventoryToolbar } from "./inventory-toolbar";
import { StockBreakdown } from "./stock-breakdown";

type SearchParams = Record<string, string | string[] | undefined>;
type Location = { id: string; name: string };

/** Search, filters and results. Used by the Inventory page and each Location page. */
export async function InventoryBrowser({
  searchParams,
  basePath,
  canEdit,
  showCosts = false,
  fixedLocationId,
}: {
  searchParams: SearchParams;
  basePath: string;
  canEdit: boolean;
  /** Admins: value column in the table. */
  showCosts?: boolean;
  /** On a location page: only that location's stock. */
  fixedLocationId?: string;
}) {
  const params = parseInventoryParams(searchParams, fixedLocationId);
  const inventory = await loadInventory(params, { withCosts: showCosts });
  if (inventory.setupNeeded) {
    return (
      <Card className="p-5 text-sm text-brand-700">
        <p className="font-semibold">A database update is needed.</p>
        <p className="mt-1">
          In Supabase, open the <strong>SQL Editor</strong> and run the newest migration files from{" "}
          <code className="rounded bg-cream-200 px-1">supabase/migrations</code> (see the README). Then reload this page.
        </p>
      </Card>
    );
  }
  const { rows, total, categories, locations, shownLocations, categoryFields } = inventory;

  const filtered = Boolean(
    params.q || params.categories.length || params.lowStock || params.checkoutable || params.fieldFilters.length || (!fixedLocationId && params.locations.length),
  );
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (page: number) => inventoryHref(basePath, params, { page }, Boolean(fixedLocationId));
  const editable = canEdit && !params.archived;

  return (
    <div>
      <InventoryToolbar
        // Remount when the URL changes so the search box matches it.
        key={params.q}
        state={params}
        categories={categories}
        locations={locations}
        categoryFields={categoryFields}
        fixedLocationId={fixedLocationId}
      />

      <p className="mb-3 text-sm text-brand-500">
        {total.toLocaleString()} {params.archived ? "archived " : ""}item{total === 1 ? "" : "s"}
        {filtered ? " match" : ""}
        {shownLocations.length > 0 && params.locations.length > 0 && !fixedLocationId && (
          <> · quantities at {shownLocations.map((l) => l.name).join(", ")}</>
        )}
      </p>

      {rows.length === 0 ? (
        <Card>
          <EmptyState>
            {filtered || params.archived
              ? "No items match. Try clearing the search or filters."
              : fixedLocationId
                ? "Nothing is stored here yet. Add stock from an item's page, or use Move stock."
                : "No items yet. Tap “Add item” to create your first one."}
          </EmptyState>
        </Card>
      ) : params.view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((row) => (
            <li key={row.id}>
              <ItemCard row={row} locations={shownLocations} canEdit={editable} />
            </li>
          ))}
        </ul>
      ) : (
        <ItemTable rows={rows} locations={shownLocations} canEdit={editable} fields={categoryFields.slice(0, 3)} showCosts={showCosts} />
      )}

      {pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm">
          {params.page > 1 ? (
            <LinkButton href={href(params.page - 1)} variant="secondary" size="sm">
              ← Previous
            </LinkButton>
          ) : (
            <span />
          )}
          <span className="text-brand-500">
            Page {params.page} of {pageCount}
          </span>
          {params.page < pageCount ? (
            <LinkButton href={href(params.page + 1)} variant="secondary" size="sm">
              Next →
            </LinkButton>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

function StatusBadges({ row }: { row: InventoryRow }) {
  return (
    <span className="flex flex-wrap gap-1">
      {row.totalQuantity === 0 && row.checkedOut === 0 ? (
        <Badge tone="danger">Out</Badge>
      ) : row.lowStock ? (
        <Badge tone="danger">Low</Badge>
      ) : null}
      {row.checkedOut > 0 && <Badge tone="warning">{row.checkedOut} out</Badge>}
    </span>
  );
}

function ItemCard({ row, locations, canEdit }: { row: InventoryRow; locations: Location[]; canEdit: boolean }) {
  return (
    <div className={`flex h-full flex-col rounded-xl border bg-cream-50 shadow-sm ${row.lowStock ? "border-red-300" : "border-cream-300"}`}>
      <Link href={`/items/${row.id}`} className="relative block">
        <Photo url={row.photoUrl} className="aspect-square w-full rounded-t-xl" />
        {row.lowStock && (
          <span className="absolute left-2 top-2 rounded-full bg-[#c4302b] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow">
            Low
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <Link href={`/items/${row.id}`} className="line-clamp-2 font-medium leading-snug text-brand-800 hover:underline">
            {row.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-brand-400">{[row.categoryName ?? "Uncategorized", row.sku].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <StatusBadges row={row} />
          <StockBreakdown item={row} locations={locations} canEdit={canEdit} />
        </div>
      </div>
    </div>
  );
}

function ItemTable({
  rows,
  locations,
  canEdit,
  fields,
  showCosts,
}: {
  rows: InventoryRow[];
  locations: Location[];
  canEdit: boolean;
  fields: CategoryField[];
  showCosts: boolean;
}) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-cream-300 text-xs font-semibold uppercase tracking-wide text-brand-500">
              <th className="w-14 px-3 py-2">
                <span className="sr-only">Photo</span>
              </th>
              <th className="px-3 py-2">Item</th>
              <th className="hidden px-3 py-2 md:table-cell">Category</th>
              {fields.map((f) => (
                <th key={f.id} className="hidden px-3 py-2 lg:table-cell">
                  {f.label}
                </th>
              ))}
              <th className="hidden px-3 py-2 sm:table-cell">Updated</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">Out</th>
              {showCosts && <th className="hidden px-3 py-2 text-right md:table-cell">Value</th>}
              <th className="px-3 py-2 text-right">On hand</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={`border-b border-cream-200 last:border-0 ${row.lowStock ? "bg-red-50/60" : ""}`}>
                <td className="px-3 py-2">
                  <Link href={`/items/${row.id}`}>
                    <Photo url={row.photoUrl} className="size-11 rounded-md" />
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/items/${row.id}`} className="font-medium text-brand-800 hover:underline">
                    {row.name}
                  </Link>
                  <p className="flex flex-wrap items-center gap-1 text-xs text-brand-400">
                    {row.sku && <span className="font-mono">{row.sku}</span>}
                    <span className="md:hidden">{row.categoryName ?? "Uncategorized"}</span>
                    <StatusBadges row={row} />
                  </p>
                </td>
                <td className="hidden px-3 py-2 md:table-cell">{row.categoryName ?? <span className="text-brand-300">Uncategorized</span>}</td>
                {fields.map((f) => (
                  <td key={f.id} className="hidden px-3 py-2 text-brand-600 lg:table-cell">
                    {formatFieldValue(f, row.customFields[f.id]) || <span className="text-brand-300">—</span>}
                  </td>
                ))}
                <td className="hidden whitespace-nowrap px-3 py-2 text-brand-500 sm:table-cell">{formatDate(row.lastUpdated)}</td>
                <td className="hidden px-3 py-2 text-right tabular-nums text-brand-500 sm:table-cell">{row.checkedOut || "—"}</td>
                {showCosts && (
                  <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">
                    {row.unitCost !== null ? formatMoney(row.unitCost * (row.totalQuantity + row.checkedOut)) : <span className="text-brand-300">—</span>}
                  </td>
                )}
                <td className="px-3 py-2 text-right">
                  <StockBreakdown item={row} locations={locations} canEdit={canEdit} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Photo({ url, className }: { url: string | null; className: string }) {
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-cream-200 text-brand-200 ${className}`} aria-hidden>
        <svg viewBox="0 0 24 24" className="size-1/3 max-h-10 max-w-10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="m21 17-5-5-8 7" />
        </svg>
      </div>
    );
  }
  // Signed URLs change on every request, so the Next.js image optimizer adds nothing here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" className={`bg-cream-200 object-cover ${className}`} />;
}
