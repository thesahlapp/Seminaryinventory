import type { Metadata } from "next";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Scan" };

export default async function ScanPage({ searchParams }: PageProps<"/scan">) {
  const params = await searchParams;
  return <Scanner unknownCode={params.error === "unknown"} />;
}
