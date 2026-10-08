import { isAdmin } from "@/lib/auth";
import { COLUMNS, csvResponse, fieldColumn, qtyColumn, toCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

/** A CSV template with your locations and custom fields as columns, plus example rows. */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("Please sign in.", { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", claims.claims.sub).single();
  const admin = me ? isAdmin(me.role) : false;

  const [{ data: locations }, { data: categories }, { data: fields }] = await Promise.all([
    supabase.from("locations").select("name").is("archived_at", null).order("sort_order").order("name"),
    supabase.from("categories").select("id, name"),
    supabase.from("category_fields").select("label, category_id").order("sort_order"),
  ]);
  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const locs = (locations ?? []).map((l) => l.name);
  const fieldCols = (fields ?? []).map((f) => fieldColumn(f.label, categoryName.get(f.category_id) ?? "?"));

  const header = [
    COLUMNS.name,
    COLUMNS.sku,
    COLUMNS.category,
    COLUMNS.size,
    COLUMNS.description,
    COLUMNS.notes,
    COLUMNS.minQuantity,
    COLUMNS.sizeMinQuantity,
    COLUMNS.checkoutable,
    ...(admin ? [COLUMNS.unitCost, COLUMNS.retailPrice] : []),
    ...locs.map(qtyColumn),
    ...fieldCols,
  ];
  const blankTail = (n: number) => Array.from({ length: n }, () => "");
  const qty = (n: number) => locs.map((_, i) => (i === 0 ? n : 0));
  const rows = [
    ["Seminary Mug", "MUG-001", "Gifts", "", "Ceramic mug with logo", "", 10, "", "no", ...(admin ? ["4.50", "12.00"] : []), ...qty(24), ...blankTail(fieldCols.length)],
    ["Black Hoodie", "HOOD-BLK", "Apparel", "M", "Fleece hoodie", "", "", 5, "no", ...(admin ? ["18.00", "35.00"] : []), ...qty(12), ...blankTail(fieldCols.length)],
    ["Black Hoodie", "HOOD-BLK", "Apparel", "L", "Fleece hoodie", "", "", 5, "no", ...(admin ? ["18.00", "35.00"] : []), ...qty(8), ...blankTail(fieldCols.length)],
  ];
  return csvResponse("qalam-inventory-template.csv", toCsv(header, rows));
}
