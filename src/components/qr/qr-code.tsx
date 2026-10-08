"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** A QR code for a path on this site (always dark on white so it scans in dark mode too). */
export function QrCode({ path, size = 128, className = "" }: { path: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(`${window.location.origin}${path}`, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    }).then((s) => !cancelled && setSvg(s));
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div
      className={`bg-white ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="QR code"
      // The SVG comes from the qrcode library, not from user input.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
