import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";
import { NavLinks } from "@/components/nav-links";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="bg-brand text-cream">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo-mark-cream.png" alt="" width={36} height={36} priority />
            <span className="font-display text-sm font-semibold uppercase tracking-[0.2em]">
              Qalam Seminary
              <span className="ml-2 font-medium normal-case tracking-normal text-brand-200">
                Inventory
              </span>
            </span>
          </Link>
          <Suspense>
            <HeaderNav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}

async function HeaderNav() {
  const profile = await getCurrentProfile();
  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/items", label: "Items" },
    { href: "/history", label: "History" },
    ...(isAdmin(profile.role) ? [{ href: "/settings", label: "Settings" }] : []),
  ];

  return (
    <>
      <div className="order-last w-full sm:order-none sm:w-auto">
        <NavLinks links={links} />
      </div>
      <div className="ml-auto flex items-center gap-3 text-sm">
        <Link
          href="/account/password"
          className="hidden text-brand-100 hover:text-cream sm:inline"
          title="My account"
        >
          {profile.full_name ?? profile.email}
          <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs">
            {ROLE_LABELS[profile.role]}
          </span>
        </Link>
        <form action={signOut}>
          <button className="rounded-md border border-brand-400 px-3 py-1 hover:bg-brand-600">
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
