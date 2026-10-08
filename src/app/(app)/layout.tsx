import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeSync } from "@/components/theme";
import { getCurrentProfile } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";
import { navLinksFor } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<div className="h-14 bg-brand pt-[env(safe-area-inset-top)] box-content print:hidden" />}>
        <Navigation />
      </Suspense>
      <OfflineBanner />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 lg:pb-10 print:p-0">{children}</main>
    </>
  );
}

async function Navigation() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  return (
    <>
      <ThemeSync theme={profile.theme as "system" | "light" | "dark"} />
      <AppNav
        links={navLinksFor(profile.role)}
        userName={profile.full_name ?? profile.email ?? "Account"}
        roleLabel={ROLE_LABELS[profile.role]}
        unreadCount={count ?? 0}
      />
    </>
  );
}
