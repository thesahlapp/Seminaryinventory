import type { Metadata } from "next";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Scan" };

export default async function ScanPage({ searchParams }: PageProps<"/scan">) {
  const params = await searchParams;
  const sku = typeof params.sku === "string" ? params.sku : null;
  const message =
    params.error === "sku" && sku
      ? `No item has the SKU “${sku}”.`
      : params.error === "unknown" || params.error === "sku"
        ? "That code isn't a Qalam label."
        : null;
  return <Scanner message={message} />;
}
