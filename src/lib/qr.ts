/**
 * QR codes point at short links on this site:
 *   /q/i/<item id>      item
 *   /q/v/<variant id>   an item in one size
 *   /q/l/<location id>  location
 *   /q/k/<kit id>       kit
 *   /q/s/<SKU>          item (or size) with that SKU
 * Phone camera apps open them directly; the in-app scanner navigates to them.
 * If the site moves to a new domain, scanning still works in the app because
 * only the path is used there.
 */
export type QrKind = "item" | "variant" | "location" | "kit";

const PREFIX: Record<QrKind, string> = { item: "i", variant: "v", location: "l", kit: "k" };

export function qrPath(kind: QrKind, id: string) {
  return `/q/${PREFIX[kind]}/${id}`;
}

/** QR code made from an item's SKU. A link (so phone cameras open the item) with the SKU in it. */
export function skuQrPath(sku: string) {
  return `/q/s/${encodeURIComponent(sku.trim())}`;
}

const QR_PATH = /^\/q\/([ivlk])\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;
const SKU_PATH = /^\/q\/s\/([^/?#]{1,200})\/?$/;
/** A bare SKU, e.g. from a supplier's label: letters, numbers and . _ - only. */
const PLAIN_SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** The SKU in a /q/s/ path, or null. */
export function skuFromQrPath(path: string): string | null {
  const match = path.match(SKU_PATH);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * Returns our QR path if the scanned text is one of our codes (any domain).
 * A QR code that holds only a SKU is treated as a SKU code too.
 */
export function parseQrText(text: string): string | null {
  const raw = text.trim();
  let path = raw;
  try {
    path = new URL(raw).pathname;
  } catch {
    // Not a full URL; maybe just the path, or a bare SKU.
    if (PLAIN_SKU.test(raw)) return skuQrPath(raw);
  }
  if (QR_PATH.test(path)) return path;
  const sku = skuFromQrPath(path);
  return sku ? skuQrPath(sku) : null;
}
