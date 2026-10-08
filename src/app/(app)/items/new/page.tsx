import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ItemForm } from "../item-form";

export const metadata: Metadata = { title: "Add item" };

export default async function NewItemPage() {
  const profile = await getCurrentProfile();
  if (!canEdit(profile.role)) {
    return <PageHeader title="Add item" description="You have view-only access. Ask an admin for edit access." />;
  }

  const supabase = await createClient();
  const [categories, sizes] = await Promise.all([
    supabase.from("categories").select("id, name, default_has_sizes").is("archived_at", null).order("sort_order").order("name"),
    supabase.from("sizes").select("id, label, is_standard").is("archived_at", null).order("sort_order").order("label"),
  ]);
  if (categories.error) throw categories.error;
  if (sizes.error) throw sizes.error;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add item" description="Add photos now or later. You’ll set quantities on the next page." />
      <ItemForm categories={categories.data} sizes={sizes.data} />
    </div>
  );
}
