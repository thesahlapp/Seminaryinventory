import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where a scanned QR code leads. Items open with quick +/− buttons. */
export async function GET(request: NextRequest, { params }: RouteContext<"/q/[kind]/[id]">) {
  const { kind, id } = await params;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
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
