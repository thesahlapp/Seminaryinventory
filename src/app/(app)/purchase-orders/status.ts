import type { Database } from "@/lib/supabase/database.types";

export type PoStatus = Database["public"]["Enums"]["po_status"];

export const PO_STATUS: Record<PoStatus, { label: string; tone: "muted" | "brand" | "warning" | "neutral" | "danger" }> = {
  draft: { label: "Draft", tone: "muted" },
  ordered: { label: "Ordered", tone: "neutral" },
  partially_received: { label: "Partly received", tone: "warning" },
  received: { label: "Received", tone: "brand" },
  cancelled: { label: "Cancelled", tone: "danger" },
};
