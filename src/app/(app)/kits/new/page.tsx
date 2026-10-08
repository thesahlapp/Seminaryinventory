import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";
import { KitForm } from "../kit-form";

export const metadata: Metadata = { title: "New kit" };

export default async function NewKitPage() {
  const profile = await getCurrentProfile();
  if (!canEdit(profile.role)) return <PageHeader title="New kit" description="You have view-only access." />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New kit" />
      <KitForm />
    </div>
  );
}
