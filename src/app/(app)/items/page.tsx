import type { Metadata } from "next";
import { InventoryBrowser } from "@/components/inventory/inventory-browser";
import { LinkButton, PageHeader } from "@/components/ui";
import { canEdit, getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/items">) {
  const profile = await getCurrentProfile();
  const editor = canEdit(profile.role);

  return (
    <div>
      <PageHeader
        title="Inventory"
        actions={
          editor && (
            <>
              <LinkButton href="/locations/move" variant="secondary">
                Move stock
              </LinkButton>
              <LinkButton href="/items/new">Add item</LinkButton>
            </>
          )
        }
      />
      <InventoryBrowser searchParams={await searchParams} basePath="/items" canEdit={editor} />
    </div>
  );
}
