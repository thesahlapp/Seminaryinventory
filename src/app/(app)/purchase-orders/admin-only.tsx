import { PageHeader } from "@/components/ui";

export function AdminOnly({ title }: { title: string }) {
  return <PageHeader title={title} description="Purchase orders include costs, so only admins can see them." />;
}
