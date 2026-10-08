import { NextResponse, type NextRequest } from "next/server";
import { skuFromQrPath } from "@/lib/qr";
import { findBySku } from "@/lib/sku";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where a scanned QR code leads. Items open with quick +/− buttons. */
export async function GET(request: NextRequest, { params }: RouteContext<"/q/[kind]/[id]">) {
  const { kind, id } = await params;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  // Codes made from a SKU: /q/s/<SKU>
  if (kind === "s") {
    // Read the SKU from the raw path: the route param is already decoded, which
    // would break SKUs containing "%" or "/".
    const sku = skuFromQrPath(request.nextUrl.pathname);
    if (!sku) return to("/scan?error=unknown");
    const found = await findBySku(await createClient(), sku);
    if (!found) return to(`/scan?error=sku&sku=${encodeURIComponent(sku.slice(0, 64))}`);
    return to(`/items/${found.itemId}?scan=1${found.variantId ? `&v=${found.variantId}` : ""}`);
  }

  if (!UUID.test(id)) return to("/scan?error=unknown");

  switch (kind) {
    case "i":
      return to(`/items/${id}?scan=1`);
    case "l":
      return to(`/locations/${id}`);
    case "k":
      return to(`/kits/${id}`);
    case "v": {
      const supabase = await createClient();
      const { data } = await supabase.from("item_variants").select("item_id").eq("id", id).maybeSingle();
      return data ? to(`/items/${data.item_id}?scan=1&v=${id}`) : to("/scan?error=unknown");
    }
    default:
      return to("/scan?error=unknown");
  }
}
