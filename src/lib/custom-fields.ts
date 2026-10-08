import type { Database, Json } from "@/lib/supabase/database.types";

export type FieldType = Database["public"]["Enums"]["field_type"];

export type CategoryField = {
  id: string;
  category_id: string;
  label: string;
  field_type: FieldType;
  options: string[];
  sort_order: number;
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  boolean: "Yes / No",
};

/** Reads one custom field from a form (`cf:<id>`). Empty means "not set". */
export function parseFieldInput(field: CategoryField, raw: FormDataEntryValue | null): { value?: Json; error?: string } {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") return {};

  switch (field.field_type) {
    case "number": {
      const n = Number(text.replace(/,/g, ""));
      return Number.isFinite(n) ? { value: n } : { error: `"${field.label}" must be a number.` };
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text))
        ? { value: text }
        : { error: `"${field.label}" must be a date (YYYY-MM-DD).` };
    case "boolean": {
      const t = text.toLowerCase();
      if (["yes", "true", "1", "y"].includes(t)) return { value: true };
      if (["no", "false", "0", "n"].includes(t)) return { value: false };
      return { error: `"${field.label}" must be yes or no.` };
    }
    case "select": {
      const match = field.options.find((o) => o.toLowerCase() === text.toLowerCase());
      return match ? { value: match } : { error: `"${field.label}" must be one of: ${field.options.join(", ")}.` };
    }
    default:
      return text.length <= 500 ? { value: text } : { error: `"${field.label}" is too long (500 characters max).` };
  }
}

/** Collects all custom fields for a category from a form into { id: value }. */
export function readCustomFields(fields: CategoryField[], formData: FormData) {
  const values: Record<string, Json> = {};
  for (const field of fields) {
    const { value, error } = parseFieldInput(field, formData.get(`cf:${field.id}`));
    if (error) return { error };
    if (value !== undefined) values[field.id] = value;
  }
  return { values };
}

export function formatFieldValue(field: Pick<CategoryField, "field_type">, value: Json | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  if (field.field_type === "boolean") return value ? "Yes" : "No";
  if (field.field_type === "date" && typeof value === "string") {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  }
  if (field.field_type === "number" && typeof value === "number") return value.toLocaleString();
  return String(value);
}

/** The value as it should appear in an <input> (and in CSV). */
export function fieldInputValue(field: Pick<CategoryField, "field_type">, value: Json | undefined): string {
  if (value === undefined || value === null) return "";
  if (field.field_type === "boolean") return value ? "yes" : "no";
  return String(value);
}
