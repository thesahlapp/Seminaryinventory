import { Card, CardHeader, LinkButton } from "@/components/ui";
import { qrPath, skuQrPath } from "@/lib/qr";
import { QrCode } from "./qr-code";

/** QR code and "Print labels" link for an item, location or kit. */
export function QrCard({
  kind,
  id,
  title,
  variants = [],
  sku,
}: {
  kind: "item" | "location" | "kit";
  id: string;
  title: string;
  /** For sized items: a label per size can be printed too. */
  variants?: { id: string; label: string }[];
  /** Items with a SKU get a QR code made from the SKU. */
  sku?: string | null;
}) {
  const param = kind === "item" ? "item" : kind === "location" ? "location" : "kit";
  return (
    <Card>
      <CardHeader title="QR label" />
      <div className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-white p-2">
          <QrCode path={sku ? skuQrPath(sku) : qrPath(kind, id)} size={104} />
        </div>
        <div className="min-w-0 space-y-2 text-sm text-brand-600">
          <p>Scan to open {title}{kind === "item" ? " with quick +/− buttons" : ""}.</p>
          {sku && (
            <p className="text-xs text-brand-500">
              Made from SKU <span className="break-all font-mono font-semibold text-brand-700">{sku}</span>
            </p>
          )}
          <LinkButton href={`/labels?${param}=${id}`} size="sm" variant="secondary">
            Print label{variants.length ? "s" : ""}
          </LinkButton>
          {variants.length > 0 && <p className="text-xs text-brand-400">You can print one label per size.</p>}
        </div>
      </div>
    </Card>
  );
}
