import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Comments } from "@/components/comments/comments";
import { AlertIcon } from "@/components/icons";
import { QuickPhotoAdd } from "@/components/photos/quick-photo-add";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { QrCard } from "@/components/qr/qr-card";
import { QuantityChange } from "@/components/quantity-change";
import { Badge, Card, CardHeader, EmptyState, Input, LinkButton, PageHeader, Table } from "@/components/ui";
import { canEdit as canEditRole, getCurrentProfile, isAdmin } from "@/lib/auth";
import { type CategoryField, formatFieldValue } from "@/lib/custom-fields";
import { formatDate, formatDateTime, REASON_LABELS, todayInDallas } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { getPhotoUrls } from "@/lib/photos";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { addItemSizes, deleteItem, removeItemSize, restoreItemSize, saveSizeMinimums, setItemArchived } from "../actions";
import { QuickAdjust } from "./quick-adjust";
import { StockPanel } from "./stock-panel";

export const metadata: Metadata = { title: "Item" };

const NO_IDS = ["00000000-0000-0000-0000-000000000000"];

export default async function ItemPage({ params, searchParams }: PageProps<"/items/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const scanned = query.scan !== undefined;
  const scannedVariant = typeof query.v === "string" ? query.v : undefined;

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const canEdit = canEditRole(profile.role);
  const admin = isAdmin(profile.role);

  const { data: item, error } = await supabase
    .from("items")
    .select(
      "id, name, sku, description, notes, has_sizes, archived_at, created_at, updated_at, checkoutable, min_quantity, custom_fields, category_id, categories(id, name), item_photos(id, storage_path, thumbnail_path, sort_order, caption), item_variants(id, sku, archived_at, min_quantity, sizes(id, label, sort_order), stock_levels(location_id, quantity))",
    )
    .eq("id", id)
    .order("sort_order", { referencedTable: "item_photos" })
    .maybeSingle();
  if (error) throw error;
  if (!item) notFound();

  const variantIds = item.item_variants.map((v) => v.id);
  const ids = variantIds.length ? variantIds : NO_IDS;
  const [locations, sizes, history, photoUrls, fields, checkedOut, openLines, kits, lowRows, costs] = await Promise.all([
    supabase.from("locations").select("id, name, archived_at").order("sort_order").order("name"),
    supabase.from("sizes").select("id, label").is("archived_at", null).order("sort_order").order("label"),
    supabase
      .from("stock_movements")
      .select("id, changed_at, old_quantity, new_quantity, reason, reason_note, changed_by_email, profiles(full_name), locations(name), item_variants(sizes(label))")
      .in("variant_id", ids)
      .order("changed_at", { ascending: false })
      .limit(25),
    getPhotoUrls(supabase, item.item_photos.map((p) => p.storage_path)),
    item.category_id ? supabase.from("category_fields").select("*").eq("category_id", item.category_id).order("sort_order") : null,
    supabase.from("checked_out_quantities").select("variant_id, quantity").in("variant_id", ids),
    supabase
      .from("checkout_lines")
      .select("quantity, returned_good, returned_damaged, missing, checkouts!inner(id, number, borrower_name, due_date, closed_at)")
      .in("variant_id", ids)
      .is("checkouts.closed_at", null),
    supabase.from("kit_items").select("quantity, kits(id, name, archived_at)").in("variant_id", ids),
    supabase.from("low_stock").select("variant_id, size_label, on_hand, min_quantity").eq("item_id", item.id),
    admin ? supabase.from("item_costs").select("unit_cost, retail_price").eq("item_id", item.id).maybeSingle() : null,
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
  const onHand = Object.values(levels).reduce((a, b) => a + b, 0);
  const outQty = (checkedOut.data ?? []).reduce((a, r) => a + Number(r.quantity ?? 0), 0);

  // Show archived locations only if they still hold some of this item.
  const shownLocations = locations.data
    .filter((l) => !l.archived_at || item.item_variants.some((v) => (levels[`${v.id}:${l.id}`] ?? 0) > 0))
    .map(({ id, name }) => ({ id, name }));

  const usedSizeIds = new Set(item.item_variants.map((v) => v.sizes?.id));
  const addableSizes = sizes.data.filter((s) => !usedSizeIds.has(s.id));

  const customFields = ((fields?.data ?? []) as CategoryField[]).map((field) => ({
    field,
    value: formatFieldValue(field, (item.custom_fields as Record<string, Json>)[field.id]),
  }));

  const today = todayInDallas();
  const borrowers = new Map<string, { id: string; number: number; name: string; due: string; units: number }>();
  for (const line of openLines.data ?? []) {
    const c = line.checkouts;
    const units = line.quantity - line.returned_good - line.returned_damaged - line.missing;
    if (units <= 0) continue;
    const entry = borrowers.get(c.id) ?? { id: c.id, number: c.number, name: c.borrower_name, due: c.due_date, units: 0 };
    entry.units += units;
    borrowers.set(c.id, entry);
  }

  const memberOf = (kits.data ?? []).filter((k) => k.kits && !k.kits.archived_at);
  const low = lowRows.data ?? [];
  const cost = costs?.data;
  const unitCost = cost?.unit_cost != null ? Number(cost.unit_cost) : null;
  const galleryPhotos = item.item_photos.map((p) => ({ id: p.id, url: photoUrls[p.storage_path] ?? null, caption: p.caption }));

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
            {low.length > 0 && <Badge tone="danger">Low stock</Badge>}
            {item.checkoutable && <Badge tone="brand">Can be checked out</Badge>}
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
              {item.checkoutable && !item.archived_at && (
                <LinkButton href={`/checkouts/new?item=${item.id}`}>Check out</LinkButton>
              )}
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
              <ActionForm action={deleteItem} confirm={`Delete “${item.name}” permanently? This can't be undone.`} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={item.id} />
                <SubmitButton variant="danger" pendingText="…">
                  Delete
                </SubmitButton>
              </ActionForm>
            </>
          )
        }
      />

      {/* Right after scanning a label: big +/− buttons first. */}
      {scanned && canEdit && !item.archived_at && activeVariants.length > 0 && (
        <QuickAdjust
          itemName={item.name}
          variants={activeVariants.map((v) => ({ id: v.id, label: v.sizes?.label ?? null }))}
          locations={shownLocations}
          levels={levels}
          initialVariantId={scannedVariant}
        />
      )}

      {/* Availability */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="On hand" value={onHand.toLocaleString()} tone={low.length ? "danger" : undefined} />
        <Stat label="Checked out" value={outQty.toLocaleString()} />
        <Stat
          label="Low stock alert"
          value={item.min_quantity != null ? `≤ ${item.min_quantity}` : activeVariants.some((v) => v.min_quantity != null) ? "Per size" : "Off"}
        />
        {admin && <Stat label="Value (at cost)" value={unitCost != null ? formatMoney(unitCost * (onHand + outQty)) : "No cost set"} />}
      </dl>

      {low.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            {low
              .map((r) => `${r.size_label ? `Size ${r.size_label}` : "Total"}: ${r.on_hand} on hand (minimum ${r.min_quantity})`)
              .join(" · ")}
            {admin && (
              <>
                {" "}
                ·{" "}
                <Link href={`/purchase-orders/new?item=${item.id}`} className="font-medium underline">
                  Create PO
                </Link>
              </>
            )}
          </span>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* On phones the stock column comes first; photos and details follow. */}
        <div className="order-last space-y-6 lg:order-none">
          <Card>
            <CardHeader
              title="Photos"
              actions={
                canEdit && (
                  <Link href={`/items/${item.id}/edit#photos`} className="text-sm text-brand-500 hover:underline">
                    Reorder &amp; captions
                  </Link>
                )
              }
            />
            <div className="space-y-3 p-4">
              {galleryPhotos.length ? (
                <PhotoGallery photos={galleryPhotos} alt={item.name} />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-lg border-2 border-dashed border-cream-400 text-sm text-brand-400">
                  No photos yet
                </div>
              )}
              {canEdit && <QuickPhotoAdd itemId={item.id} nextOrder={item.item_photos.length} />}
            </div>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <dl className="space-y-3 px-5 py-4 text-sm">
              {customFields.map(({ field, value }) => (
                <Detail key={field.id} label={field.label}>
                  {value}
                </Detail>
              ))}
              <Detail label="Description">{item.description}</Detail>
              <Detail label="Notes">{item.notes}</Detail>
              {admin && (
                <>
                  <Detail label="Unit cost">{cost?.unit_cost != null ? formatMoney(cost.unit_cost) : null}</Detail>
                  <Detail label="Retail price">{cost?.retail_price != null ? formatMoney(cost.retail_price) : null}</Detail>
                </>
              )}
              <Detail label="Added">{formatDateTime(item.created_at)}</Detail>
              <Detail label="Last edited">{formatDateTime(item.updated_at)}</Detail>
            </dl>
          </Card>

          {memberOf.length > 0 && (
            <Card>
              <CardHeader title="Part of kits" />
              <ul className="divide-y divide-cream-200">
                {memberOf.map((k) => (
                  <li key={k.kits!.id}>
                    <Link href={`/kits/${k.kits!.id}`} className="flex justify-between px-5 py-2.5 text-sm hover:bg-cream-100">
                      <span className="font-medium text-brand-800">{k.kits!.name}</span>
                      <span className="text-brand-500">× {k.quantity}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <QrCard
            kind="item"
            id={item.id}
            title={item.name}
            sku={item.sku}
            variants={item.has_sizes ? activeVariants.map((v) => ({ id: v.id, label: v.sizes?.label ?? "" })) : []}
          />
        </div>

        <div className="space-y-6">
          <StockPanel
            canEdit={canEdit && !item.archived_at}
            locations={shownLocations}
            levels={levels}
            variants={activeVariants.map((v) => ({ id: v.id, label: v.sizes?.label ?? null }))}
          />

          {borrowers.size > 0 && (
            <Card>
              <CardHeader title={`Checked out (${outQty})`} />
              <ul className="divide-y divide-cream-200">
                {[...borrowers.values()].map((b) => (
                  <li key={b.id}>
                    <Link href={`/checkouts/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-cream-100">
                      <span>
                        <span className="font-medium text-brand-800">{b.name}</span>
                        <span className="text-brand-500"> · {b.units} unit{b.units === 1 ? "" : "s"} · #{b.number}</span>
                      </span>
                      <span className={b.due < today ? "font-medium text-red-700" : "text-brand-500"}>
                        {b.due < today ? "Overdue · " : "Due "}
                        {formatDate(`${b.due}T12:00:00`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {item.has_sizes && canEdit && (
            <Card>
              <CardHeader title="Sizes" />
              <div className="space-y-4 px-5 py-4">
                {activeVariants.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {activeVariants.map((v) => (
                      <li key={v.id}>
                        <ActionForm action={removeItemSize} confirm={`Remove size ${v.sizes?.label} from this item?`} className="flex flex-col gap-2">
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
                        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-cream-400 bg-cream-50 px-2.5 py-1 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
                      >
                        <input type="checkbox" name="size_ids" value={s.id} className="accent-[#2f6b47]" />
                        {s.label}
                      </label>
                    ))}
                    <SubmitButton size="sm" variant="secondary">
                      Add sizes
                    </SubmitButton>
                  </ActionForm>
                )}

                {activeVariants.length > 0 && (
                  <details className="rounded-lg border border-cream-300">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-brand-600">
                      Low stock alerts per size
                    </summary>
                    <ActionForm action={saveSizeMinimums} className="flex flex-wrap items-end gap-3 border-t border-cream-300 p-3">
                      {activeVariants.map((v) => (
                        <label key={v.id} className="flex w-20 flex-col gap-1 text-xs font-medium text-brand-500">
                          {v.sizes?.label}
                          <Input
                            name={`min:${v.id}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            defaultValue={v.min_quantity ?? ""}
                            placeholder="—"
                          />
                        </label>
                      ))}
                      <SubmitButton size="sm" variant="secondary">
                        Save minimums
                      </SubmitButton>
                    </ActionForm>
                  </details>
                )}

                {archivedVariants.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-brand-400">
                    Hidden sizes:
                    {archivedVariants.map((v) => (
                      <ActionForm key={v.id} action={restoreItemSize} className="flex flex-col gap-2">
                        <input type="hidden" name="variant_id" value={v.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-dashed border-cream-400 px-2.5 py-0.5 hover:border-brand-300 hover:text-brand-600"
                          title="Restore"
                        >
                          {v.sizes?.label} ↺
                        </button>
                      </ActionForm>
                    ))}
                  </div>
                )}
                <p className="text-xs text-brand-400">Custom sizes (like 3XL or Youth M) are added by an admin under Settings → Sizes.</p>
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

          <Comments itemId={item.id} canPost={canEdit} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-xl border border-cream-300 bg-cream-50 px-4 py-3 shadow-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-brand-500">{label}</dt>
      <dd className={`mt-0.5 font-display text-xl font-semibold tabular-nums ${tone === "danger" ? "text-red-700" : "text-brand-700"}`}>
        {value}
      </dd>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-brand-400">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-brand-800">{children || <span className="text-brand-400">—</span>}</dd>
    </div>
  );
}
