import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";
import { getCurrentProfile } from "@/lib/auth";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="bg-brand text-cream">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo-mark-cream.png" alt="" width={36} height={36} priority />
            <span className="font-display text-sm font-semibold uppercase tracking-[0.2em]">
              Qalam Seminary
              <span className="ml-2 font-medium normal-case tracking-normal text-brand-200">
                Inventory
              </span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Suspense>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}

async function UserMenu() {
  const profile = await getCurrentProfile();

  return (
    <>
      <span className="hidden text-brand-100 sm:inline">
        {profile.full_name ?? profile.email}
        <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs capitalize">
          {profile.role}
        </span>
      </span>
      <form action={signOut}>
        <button className="rounded-md border border-brand-400 px-3 py-1 hover:bg-brand-600">
          Sign out
        </button>
      </form>
    </>
  );
}
