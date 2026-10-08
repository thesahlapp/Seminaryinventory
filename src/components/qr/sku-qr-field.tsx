"use client";

import QRCode from "qrcode";
import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { skuQrPath } from "@/lib/qr";
import { QrCode } from "./qr-code";

/**
 * The SKU input on the item form, with a live QR code made from the SKU,
 * a "Generate" button and a PNG download.
 */
export function SkuQrField({
  defaultValue,
  changed,
  suggest,
}: {
  defaultValue: string;
  /** On the edit form: warn that printed SKU labels stop matching. */
  changed?: boolean;
  /** Returns an unused SKU based on the name and category. */
  suggest: () => Promise<{ sku?: string; error?: string }>;
}) {
  const [sku, setSku] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const value = sku.trim();

  async function download() {
    const url = await QRCode.toDataURL(`${window.location.origin}${skuQrPath(value)}`, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${value.replace(/[^A-Za-z0-9._-]+/g, "_")}-qr.png`;
    a.click();
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id="sku"
          name="sku"
          value={sku}
          onChange={(e) => {
            setSku(e.target.value);
            setError(null);
          }}
          placeholder="e.g. HOOD-BLK"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await suggest();
              if (result.sku) setSku(result.sku);
              setError(result.error ?? null);
            })
          }
        >
          {pending ? "…" : "Generate"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-cream-300 bg-cream-100 p-3">
          <div className="shrink-0 rounded-md bg-white p-1.5">
            <QrCode path={skuQrPath(value)} size={84} />
          </div>
          <div className="min-w-0 space-y-1.5 text-xs text-brand-600">
            <p>
              QR code for <span className="break-all font-mono font-semibold text-brand-800">{value}</span>. Scanning it opens this item.
            </p>
            {changed && value !== defaultValue.trim() && defaultValue.trim() && (
              <p className="text-amber-800">Printed labels for the old SKU will stop working. Reprint them after saving.</p>
            )}
            <button type="button" onClick={download} className="font-medium text-brand-700 underline">
              Download QR (PNG)
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-brand-400">Optional. Must be unique. Type one or tap Generate to get a QR code from it.</p>
      )}
    </div>
  );
}
