/**
 * QR codes point at short links on this site:
 *   /q/i/<item id>      item
 *   /q/v/<variant id>   an item in one size
 *   /q/l/<location id>  location
 *   /q/k/<kit id>       kit
 * Phone camera apps open them directly; the in-app scanner navigates to them.
 * If the site moves to a new domain, scanning still works in the app because
 * only the path is used there.
 */
export type QrKind = "item" | "variant" | "location" | "kit";

const PREFIX: Record<QrKind, string> = { item: "i", variant: "v", location: "l", kit: "k" };

export function qrPath(kind: QrKind, id: string) {
  return `/q/${PREFIX[kind]}/${id}`;
}

const QR_PATH = /^\/q\/([ivlk])\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

/** Returns our QR path if the scanned text is one of our codes (any domain). */
export function parseQrText(text: string): string | null {
  let path = text.trim();
  try {
    path = new URL(path).pathname;
  } catch {
    // Not a full URL; maybe just the path.
  }
  return QR_PATH.test(path) ? path : null;
}
