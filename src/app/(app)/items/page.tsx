import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, Input, LinkButton, PageHeader, Select, Table } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { sanitizeSearch } from "@/lib/format";
import { getPhotoUrls } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Items" };

const PAGE_SIZE = 50;

export default async function ItemsPage({ searchParams }: PageProps<"/items">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? sanitizeSearch(params.q) : "";
  const categoryId = typeof params.category === "string" ? params.category : "";
  const showArchived = params.show === "archived";
  const page = Math.max(1, Number(params.page) || 1);

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  let query = supabase
    .from("items")
    .select(
      "id, name, sku, has_sizes, archived_at, categories(name), item_photos(storage_path, sort_order), item_variants(id, archived_at, sizes(label, sort_order), stock_levels(quantity))",
      { count: "exact" },
    )
    .order("name")
    .order("sort_order", { referencedTable: "item_photos" })
    .limit(1, { referencedTable: "item_photos" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (q) query = query.or(`name.ilike.*${q}*,sku.ilike.*${q}*`);
  if (categoryId === "none") query = query.is("category_id", null);
  else if (categoryId) query = query.eq("category_id", categoryId);

  const [items, categories] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").is("archived_at", null).order("sort_order").order("name"),
  ]);
  if (items.error) throw items.error;
  if (categories.error) throw categories.error;

  const photoUrls = await getPhotoUrls(
    supabase,
    items.data.flatMap((item) => item.item_photos.map((p) => p.storage_path)),
  );

  const total = items.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (categoryId) next.set("category", categoryId);
    if (showArchived) next.set("show", "archived");
    if (n > 1) next.set("page", String(n));
    return `/items${next.size ? `?${next}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Items"
        description={`${total.toLocaleString()} ${showArchived ? "archived " : ""}item${total === 1 ? "" : "s"}`}
        actions={canEdit(profile.role) && <LinkButton href="/items/new">Add item</LinkButton>}
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by name or SKU"
          aria-label="Search"
          className="min-w-56 flex-1"
        />
        <Select name="category" defaultValue={categoryId} aria-label="Category" className="w-auto">
          <option value="">All categories</option>
          {categories.data.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Uncategorized</option>
        </Select>
        <Select name="show" defaultValue={showArchived ? "archived" : ""} aria-label="Status" className="w-auto">
          <option value="">Active items</option>
          <option value="archived">Archived items</option>
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {(q || categoryId || showArchived) && (
          <Link href="/items" className="text-sm text-brand-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <Card>
        {items.data.length === 0 ? (
          <EmptyState>
            {q || categoryId || showArchived
              ? "No items match those filters."
              : "No items yet. Click “Add item” to create your first one."}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="w-14">
                  <span className="sr-only">Photo</span>
                </th>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Sizes</th>
                <th className="text-right">In stock</th>
              </tr>
            </thead>
            <tbody>
              {items.data.map((item) => {
                const variants = item.item_variants.filter((v) => !v.archived_at);
                const quantity = item.item_variants
                  .flatMap((v) => v.stock_levels)
                  .reduce((sum, level) => sum + level.quantity, 0);
                const sizes = variants
                  .flatMap((v) => (v.sizes ? [v.sizes] : []))
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((s) => s.label);
                const photo = item.item_photos[0];
                return (
                  <tr key={item.id} className="hover:bg-cream-100">
                    <td>
                      <Thumbnail url={photo ? photoUrls[photo.storage_path] : undefined} />
                    </td>
                    <td>
                      <Link href={`/items/${item.id}`} className="font-medium text-brand-800 hover:underline">
                        {item.name}
                      </Link>
                    </td>
                    <td className="font-mono text-xs text-brand-500">{item.sku ?? "—"}</td>
                    <td>{item.categories?.name ?? <span className="text-brand-300">—</span>}</td>
                    <td className="text-xs text-brand-500">
                      {item.has_sizes ? sizes.join(", ") || <Badge tone="warning">No sizes yet</Badge> : "—"}
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {quantity === 0 ? <Badge tone="warning">Out of stock</Badge> : quantity.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {pageCount > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <LinkButton href={pageHref(page - 1)} variant="secondary" size="sm">
              ← Previous
            </LinkButton>
          ) : (
            <span />
          )}
          <span className="text-brand-500">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <LinkButton href={pageHref(page + 1)} variant="secondary" size="sm">
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

function Thumbnail({ url }: { url?: string }) {
  if (!url) {
    return <div className="size-10 rounded-md border border-dashed border-cream-400 bg-cream-100" />;
  }
  // Signed URLs change on every request, so the Next.js image optimizer adds nothing here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="size-10 rounded-md object-cover" loading="lazy" />;
}
