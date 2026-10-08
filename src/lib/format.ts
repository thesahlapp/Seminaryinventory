import type { Database } from "@/lib/supabase/database.types";

export type StockReason = Database["public"]["Enums"]["stock_reason"];

export const REASON_LABELS: Record<StockReason, string> = {
  initial_count: "Initial count",
  received: "Received",
  issued: "Issued / given out",
  returned: "Returned",
  count_correction: "Count correction",
  damaged: "Damaged",
  lost: "Lost",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  other: "Other",
};

export const ROLE_LABELS = {
  admin: "Admin",
  staff: "Staff",
  viewer: "Viewer",
} as const;

const TIME_ZONE = "America/Chicago";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: TIME_ZONE }).format(
    new Date(value),
  );
}

/** Reads a trimmed string from a form; empty strings become null. */
export function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Strips characters that have meaning in PostgREST filter syntax. */
export function sanitizeSearch(value: string) {
  return value.replace(/[,()*%\\:"]/g, " ").trim();
}
