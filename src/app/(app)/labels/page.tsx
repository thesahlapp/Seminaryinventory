import type { Metadata } from "next";
import { getLabelSource } from "./actions";
import { LabelMaker } from "./label-maker";

export const metadata: Metadata = { title: "Print labels" };

export default async function LabelsPage({ searchParams }: PageProps<"/labels">) {
  const params = await searchParams;
  const initial = (
    await Promise.all(
      (["item", "location", "kit"] as const).flatMap((kind) => {
        const value = params[kind];
        const ids = (Array.isArray(value) ? value : value ? [value] : []).flatMap((v) => v.split(","));
        return ids.map((id) => getLabelSource(kind, id));
      }),
    )
  ).filter((s) => s !== null);

  return <LabelMaker initial={initial} />;
}
