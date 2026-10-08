import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { COLUMNS, fieldColumn, qtyColumn } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard, type Target } from "./import-wizard";

export const metadata: Metadata = { title: "Import CSV" };

export default async function ImportPage() {
  const profile = await getCurrentProfile();
  if (!isAdmin(profile.role)) return <PageHeader title="Import CSV" description="Only admins can import." />;

  const supabase = await createClient();
  const [{ data: locations }, { data: categories }, { data: fields }] = await Promise.all([
    supabase.from("locations").select("id, name").is("archived_at", null).order("sort_order").order("name"),
    supabase.from("categories").select("id, name"),
    supabase.from("category_fields").select("id, label, category_id").order("sort_order"),
  ]);
  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]));

  const targets: Target[] = [
    { key: "name", label: COLUMNS.name, aliases: ["name", "item", "item name", "product", "title"] },
    { key: "sku", label: COLUMNS.sku, aliases: ["sku", "code", "item code", "product code"] },
    { key: "itemId", label: COLUMNS.itemId, aliases: ["item id", "id"] },
    { key: "category", label: COLUMNS.category, aliases: ["category", "type"] },
    { key: "size", label: COLUMNS.size, aliases: ["size"] },
    { key: "description", label: COLUMNS.description, aliases: ["description", "details"] },
    { key: "notes", label: COLUMNS.notes, aliases: ["notes", "note", "comments"] },
    { key: "minQuantity", label: COLUMNS.minQuantity, aliases: ["low stock minimum", "minimum", "min", "reorder point", "min quantity"] },
    { key: "sizeMinQuantity", label: COLUMNS.sizeMinQuantity, aliases: ["size minimum", "size min"] },
    { key: "checkoutable", label: COLUMNS.checkoutable, aliases: ["checkoutable", "can be checked out", "lendable"] },
    { key: "unitCost", label: COLUMNS.unitCost, aliases: ["unit cost", "cost", "price paid"] },
    { key: "retailPrice", label: COLUMNS.retailPrice, aliases: ["retail price", "retail", "price"] },
    ...(locations ?? []).map((l) => ({
      key: `qty:${l.id}`,
      label: qtyColumn(l.name),
      aliases: [qtyColumn(l.name).toLowerCase(), l.name.toLowerCase(), `${l.name.toLowerCase()} qty`, `qty ${l.name.toLowerCase()}`],
    })),
    ...(fields ?? []).map((f) => ({
      key: `field:${f.id}`,
      label: fieldColumn(f.label, categoryName.get(f.category_id) ?? "?"),
      aliases: [fieldColumn(f.label, categoryName.get(f.category_id) ?? "?").toLowerCase(), f.label.toLowerCase()],
    })),
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Import CSV"
        description="Add or update many items at once from a spreadsheet. Quantity changes are recorded in the history."
      />
      <ImportWizard targets={targets} />
    </div>
  );
}
