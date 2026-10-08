/** CSV helpers shared by export, the template and import. */

export const COLUMNS = {
  itemId: "Item ID",
  name: "Name",
  sku: "SKU",
  category: "Category",
  size: "Size",
  description: "Description",
  notes: "Notes",
  minQuantity: "Low stock minimum",
  sizeMinQuantity: "Size minimum",
  checkoutable: "Checkoutable",
  unitCost: "Unit cost",
  retailPrice: "Retail price",
  checkedOut: "Checked out",
} as const;

export const qtyColumn = (locationName: string) => `Qty: ${locationName}`;
export const fieldColumn = (label: string, categoryName: string) => `${label} [${categoryName}]`;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "number" ? String(value) : String(value);
  // Stop spreadsheet apps from running text that looks like a formula.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]) {
  // Byte-order mark so Excel opens accented characters correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
