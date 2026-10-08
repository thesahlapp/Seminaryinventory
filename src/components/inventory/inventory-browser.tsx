import Link from "next/link";
import { Badge, Card, EmptyState, LinkButton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { inventoryHref, loadInventory, PAGE_SIZE, parseInventoryParams, type InventoryRow } from "@/lib/inventory";
import { InventoryToolbar } from "./inventory-toolbar";
import { StockBreakdown } from "./stock-breakdown";

type SearchParams = Record<string, string | string[] | undefined>;

/** Search, filters and results. Used by the Inventory page and each Location page. */
export async function InventoryBrowser({
  searchParams,
  basePath,
  canEdit,
  fixedLocationId,
}: {
  searchParams: SearchParams;
  basePath: string;
  canEdit: boolean;
  /** On a location page: only that location's stock. */
  fixedLocationId?: string;
}) {
  const params = parseInventoryParams(searchParams, fixedLocationId);
  const inventory = await loadInventory(params);
  if (inventory.setupNeeded) {
    return (
      <Card className="p-5 text-sm text-brand-700">
        <p className="font-semibold">One database update is needed.</p>
        <p className="mt-1">
          In Supabase, open the <strong>SQL Editor</strong>, paste in the migration file{" "}
          <code className="rounded bg-cream-200 px-1">20261008000005_editor_role_and_inventory_views.sql</code> and click{" "}
          <strong>Run</strong>. Then reload this page.
        </p>
      </Card>
    );
  }
  const { rows, total, categories, locations, shownLocations } = inventory;

  const filtered = Boolean(params.q || params.categories.length || (!fixedLocationId && params.locations.length));
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (page: number) => inventoryHref(basePath, params, { page }, Boolean(fixedLocationId));

  return (
    <div>
      <InventoryToolbar
        // Remount when the URL changes so the search box matches it.
        key={`${params.q}`}
        state={params}
        categories={categories}
        locations={locations}
        showLocationFilter={!fixedLocationId}
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
              <ItemCard row={row} locations={shownLocations} canEdit={canEdit && !params.archived} />
            </li>
          ))}
        </ul>
      ) : (
        <ItemTable rows={rows} locations={shownLocations} canEdit={canEdit && !params.archived} />
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

type Location = { id: string; name: string };

function ItemCard({ row, locations, canEdit }: { row: InventoryRow; locations: Location[]; canEdit: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-cream-300 bg-cream-50 shadow-sm">
      <Link href={`/items/${row.id}`} className="block">
        <Photo url={row.photoUrl} className="aspect-square w-full rounded-t-xl" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <Link href={`/items/${row.id}`} className="line-clamp-2 font-medium leading-snug text-brand-800 hover:underline">
            {row.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-brand-400">
            {[row.categoryName ?? "Uncategorized", row.sku].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <StockStatus quantity={row.totalQuantity} />
          <StockBreakdown item={row} locations={locations} canEdit={canEdit} />
        </div>
      </div>
    </div>
  );
}

function ItemTable({ rows, locations, canEdit }: { rows: InventoryRow[]; locations: Location[]; canEdit: boolean }) {
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
              <th className="hidden px-3 py-2 lg:table-cell">Sizes</th>
              <th className="hidden px-3 py-2 sm:table-cell">Updated</th>
              <th className="px-3 py-2 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-cream-200 last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/items/${row.id}`}>
                    <Photo url={row.photoUrl} className="size-11 rounded-md" />
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/items/${row.id}`} className="font-medium text-brand-800 hover:underline">
                    {row.name}
                  </Link>
                  <p className="text-xs text-brand-400">
                    {row.sku && <span className="font-mono">{row.sku}</span>}
                    <span className="md:hidden">
                      {row.sku ? " · " : ""}
                      {row.categoryName ?? "Uncategorized"}
                    </span>
                  </p>
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  {row.categoryName ?? <span className="text-brand-300">Uncategorized</span>}
                </td>
                <td className="hidden px-3 py-2 text-xs text-brand-500 lg:table-cell">
                  {row.hasSizes ? row.variants.map((v) => v.label).join(", ") : "—"}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 text-brand-500 sm:table-cell">
                  {formatDate(row.lastUpdated)}
                </td>
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

function StockStatus({ quantity }: { quantity: number }) {
  if (quantity === 0) return <Badge tone="warning">Out</Badge>;
  return <span />;
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
