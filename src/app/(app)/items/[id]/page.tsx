import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PhotoManager } from "@/components/photos/photo-manager";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Table } from "@/components/ui";
import { canEdit as canEditRole, getCurrentProfile } from "@/lib/auth";
import { formatDateTime, REASON_LABELS } from "@/lib/format";
import { getPhotoUrls } from "@/lib/photos";
import { QuantityChange } from "@/components/quantity-change";
import { createClient } from "@/lib/supabase/server";
import { addItemSizes, deleteItem, removeItemSize, restoreItemSize, setItemArchived } from "../actions";
import { StockPanel } from "./stock-panel";

export const metadata: Metadata = { title: "Item" };

export default async function ItemPage({ params }: PageProps<"/items/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const canEdit = canEditRole(profile.role);

  const { data: item, error } = await supabase
    .from("items")
    .select(
      "id, name, sku, description, notes, has_sizes, archived_at, created_at, updated_at, categories(id, name), item_photos(id, storage_path, thumbnail_path, sort_order), item_variants(id, sku, archived_at, sizes(id, label, sort_order), stock_levels(location_id, quantity))",
    )
    .eq("id", id)
    .order("sort_order", { referencedTable: "item_photos" })
    .maybeSingle();
  if (error) throw error;
  if (!item) notFound();

  const variantIds = item.item_variants.map((v) => v.id);
  const [locations, sizes, history, photoUrls] = await Promise.all([
    supabase.from("locations").select("id, name, archived_at").order("sort_order").order("name"),
    supabase.from("sizes").select("id, label").is("archived_at", null).order("sort_order").order("label"),
    supabase
      .from("stock_movements")
      .select("id, changed_at, old_quantity, new_quantity, reason, reason_note, changed_by_email, profiles(full_name), locations(name), item_variants(sizes(label))")
      .in("variant_id", variantIds.length ? variantIds : ["00000000-0000-0000-0000-000000000000"])
      .order("changed_at", { ascending: false })
      .limit(25),
    getPhotoUrls(supabase, item.item_photos.map((p) => p.storage_path)),
  ]);
  if (locations.error) throw locations.error;
  if (sizes.error) throw sizes.error;
  if (history.error) throw history.error;

  const bySizeOrder = (a: (typeof item.item_variants)[number], b: (typeof item.item_variants)[number]) =>
    (a.sizes?.sort_order ?? 0) - (b.sizes?.sort_order ?? 0);
  const activeVariants = item.item_variants.filter((v) => !v.archived_at).sort(bySizeOrder);
  const archivedVariants = item.item_variants.filter((v) => v.archived_at).sort(bySizeOrder);

  const levels: Record<string, number> = {};
  for (const variant of item.item_variants) {
    for (const level of variant.stock_levels) levels[`${variant.id}:${level.location_id}`] = level.quantity;
  }

  // Show archived locations only if they still hold some of this item.
  const shownLocations = locations.data.filter(
    (l) => !l.archived_at || item.item_variants.some((v) => (levels[`${v.id}:${l.id}`] ?? 0) > 0),
  );

  const usedSizeIds = new Set(item.item_variants.map((v) => v.sizes?.id));
  const addableSizes = sizes.data.filter((s) => !usedSizeIds.has(s.id));

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link href="/items" className="text-brand-500 hover:underline">
          ← Inventory
        </Link>
      </div>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {item.name}
            {item.archived_at && <Badge tone="muted">Archived</Badge>}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-3">
            {item.sku && <span className="font-mono">{item.sku}</span>}
            <span>{item.categories?.name ?? "Uncategorized"}</span>
          </span>
        }
        actions={
          canEdit && (
            <>
              <LinkButton href={`/items/${item.id}/edit`} variant="secondary">
                Edit
              </LinkButton>
              <LinkButton href={`/locations/move?item=${item.id}`} variant="secondary">
                Move stock
              </LinkButton>
              <ActionForm action={setItemArchived} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="archive" value={item.archived_at ? "false" : "true"} />
                <SubmitButton variant="secondary" pendingText="…">
                  {item.archived_at ? "Restore" : "Archive"}
                </SubmitButton>
              </ActionForm>
              <ActionForm
                action={deleteItem}
                confirm={`Delete “${item.name}” permanently? This can't be undone.`}
                className="flex flex-col gap-2"
              >
                <input type="hidden" name="id" value={item.id} />
                <SubmitButton variant="danger" pendingText="…">
                  Delete
                </SubmitButton>
              </ActionForm>
            </>
          )
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* On phones the stock column comes first; photos and details follow. */}
        <div className="order-last space-y-6 lg:order-none">
          <PhotoManager
            itemId={item.id}
            itemName={item.name}
            canEdit={canEdit}
            photos={item.item_photos.map((p) => ({ ...p, url: photoUrls[p.storage_path] ?? null }))}
          />
          <Card>
            <CardHeader title="Details" />
            <dl className="space-y-3 px-5 py-4 text-sm">
              <Detail label="Description">{item.description}</Detail>
              <Detail label="Notes">{item.notes}</Detail>
              <Detail label="Added">{formatDateTime(item.created_at)}</Detail>
              <Detail label="Last edited">{formatDateTime(item.updated_at)}</Detail>
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <StockPanel
            canEdit={canEdit && !item.archived_at}
            locations={shownLocations.map(({ id, name }) => ({ id, name }))}
            levels={levels}
            variants={activeVariants.map((v) => ({ id: v.id, label: v.sizes?.label ?? null }))}
          />

          {item.has_sizes && canEdit && (
            <Card>
              <CardHeader title="Sizes" />
              <div className="space-y-4 px-5 py-4">
                {activeVariants.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {activeVariants.map((v) => (
                      <li key={v.id}>
                        <ActionForm
                          action={removeItemSize}
                          confirm={`Remove size ${v.sizes?.label} from this item?`}
                          className="flex flex-col gap-2"
                        >
                          <input type="hidden" name="variant_id" value={v.id} />
                          <span className="inline-flex items-center gap-1 rounded-full border border-cream-400 bg-cream-100 py-0.5 pl-3 pr-1 text-sm">
                            {v.sizes?.label}
                            <button
                              type="submit"
                              className="rounded-full px-1.5 text-brand-400 hover:bg-red-50 hover:text-red-700"
                              aria-label={`Remove size ${v.sizes?.label}`}
                            >
                              ×
                            </button>
                          </span>
                        </ActionForm>
                      </li>
                    ))}
                  </ul>
                )}

                {addableSizes.length > 0 && (
                  <ActionForm action={addItemSizes} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="item_id" value={item.id} />
                    <span className="text-sm text-brand-500">Add:</span>
                    {addableSizes.map((s) => (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-cream-400 bg-cream-50 px-2.5 py-1 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-50"
                      >
                        <input type="checkbox" name="size_ids" value={s.id} className="accent-brand" />
                        {s.label}
                      </label>
                    ))}
                    <SubmitButton size="sm" variant="secondary">
                      Add sizes
                    </SubmitButton>
                  </ActionForm>
                )}

                {archivedVariants.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-brand-400">
                    Hidden sizes:
                    {archivedVariants.map((v) => (
                      <ActionForm key={v.id} action={restoreItemSize} className="flex flex-col gap-2">
                        <input type="hidden" name="variant_id" value={v.id} />
                        <button type="submit" className="rounded-full border border-dashed border-cream-400 px-2.5 py-0.5 hover:border-brand-300 hover:text-brand-600" title="Restore">
                          {v.sizes?.label} ↺
                        </button>
                      </ActionForm>
                    ))}
                  </div>
                )}
                <p className="text-xs text-brand-400">
                  Custom sizes (like 3XL or Youth M) are added by an admin under Settings → Sizes.
                </p>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="History"
              actions={
                history.data.length > 0 && (
                  <Link href={`/history?item=${item.id}`} className="text-sm text-brand-500 hover:underline">
                    View all
                  </Link>
                )
              }
            />
            {history.data.length === 0 ? (
              <EmptyState>No stock changes recorded yet.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>When</th>
                    {item.has_sizes && <th>Size</th>}
                    <th>Location</th>
                    <th className="text-right">Old → New</th>
                    <th>Reason</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap text-brand-500">{formatDateTime(m.changed_at)}</td>
                      {item.has_sizes && <td>{m.item_variants.sizes?.label}</td>}
                      <td>{m.locations.name}</td>
                      <td className="text-right">
                        <QuantityChange from={m.old_quantity} to={m.new_quantity} />
                      </td>
                      <td>
                        {REASON_LABELS[m.reason]}
                        {m.reason_note && <span className="block text-xs text-brand-400">{m.reason_note}</span>}
                      </td>
                      <td className="text-brand-500">{m.profiles?.full_name ?? m.changed_by_email ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-brand-400">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-brand-800">{children || <span className="text-brand-300">—</span>}</dd>
    </div>
  );
}
