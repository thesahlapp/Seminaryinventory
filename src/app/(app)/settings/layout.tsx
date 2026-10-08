import { NavTabs } from "@/components/nav-tabs";
import { PageHeader } from "@/components/ui";
import { getCurrentProfile, isAdmin } from "@/lib/auth";

const TABS = [
  { href: "/settings/categories", label: "Categories" },
  { href: "/settings/locations", label: "Locations" },
  { href: "/settings/sizes", label: "Sizes" },
  { href: "/settings/users", label: "Users" },
];

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const profile = await getCurrentProfile();

  if (!isAdmin(profile.role)) {
    return (
      <>
        <PageHeader title="Settings" />
        <p className="text-sm text-brand-500">Only admins can change settings.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Settings" description="Manage the lists used across the inventory, and who has access." />
      <NavTabs tabs={TABS} />
      <div className="mt-6">{children}</div>
    </>
  );
}
