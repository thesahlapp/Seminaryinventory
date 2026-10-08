"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { type NavKey, type NavLink, isActive } from "@/lib/navigation";
import {
  BoxIcon,
  ChartIcon,
  ClockIcon,
  CloseIcon,
  CountIcon,
  GearIcon,
  HomeIcon,
  ImportIcon,
  KitIcon,
  MenuIcon,
  OutIcon,
  PinIcon,
  ScanIcon,
  TagIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
} from "./icons";
import { NotificationBell } from "./notification-bell";

const ICONS: Record<NavKey, (p: { className?: string }) => ReactNode> = {
  dashboard: HomeIcon,
  inventory: BoxIcon,
  locations: PinIcon,
  checkouts: OutIcon,
  kits: KitIcon,
  history: ClockIcon,
  labels: TagIcon,
  audits: CountIcon,
  orders: TruckIcon,
  reports: ChartIcon,
  import: ImportIcon,
  team: UsersIcon,
  settings: GearIcon,
};

/** Header (all screens) plus the bottom tab bar on phones. */
export function AppNav({
  links,
  userName,
  roleLabel,
  unreadCount,
}: {
  links: NavLink[];
  userName: string;
  roleLabel: string;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const main = links.filter((l) => l.group === "main");
  const more = links.filter((l) => l.group === "more");

  // Close the phone menu after navigating.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-brand text-cream shadow-sm print:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 pt-[env(safe-area-inset-top)] box-content">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image src="/logo-mark-cream.png" alt="" width={32} height={32} priority />
            <span className="font-display text-sm font-semibold uppercase tracking-[0.18em]">
              Qalam<span className="hidden sm:inline"> Seminary</span>
            </span>
          </Link>

          {/* Computers: main links + More */}
          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {main.map((link) => (
              <HeaderLink key={link.key} link={link} active={isActive(pathname, link.href)} />
            ))}
            {more.length > 0 && <MoreMenu links={more} pathname={pathname} />}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/scan"
              className="hidden items-center gap-1.5 rounded-md bg-cream/10 px-3 py-1.5 text-sm font-medium hover:bg-cream/20 sm:inline-flex"
            >
              <ScanIcon className="size-4" /> Scan
            </Link>
            <NotificationBell initialCount={unreadCount} />
            <UserMenu userName={userName} roleLabel={roleLabel} />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-md p-2 hover:bg-cream/10 lg:hidden"
              aria-label="Open menu"
            >
              <MenuIcon className="size-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Phones and tablets: slide-in menu with every page */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-cream-50 pb-[env(safe-area-inset-bottom)] shadow-xl">
            <div className="flex items-center justify-between border-b border-cream-300 px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
              <div>
                <p className="font-medium text-brand-800">{userName}</p>
                <p className="text-xs text-brand-500">{roleLabel}</p>
              </div>
              <button type="button" onClick={() => setMenuOpen(false)} className="rounded-md p-2 text-brand-600" aria-label="Close menu">
                <CloseIcon className="size-5" />
              </button>
            </div>
            <nav className="flex-1 py-2">
              {[...main, ...more].map((link) => {
                const Icon = ICONS[link.key];
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.key}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-4 py-3 text-sm ${
                      active ? "bg-brand-50 font-semibold text-brand-800" : "text-brand-700 hover:bg-cream-100"
                    }`}
                  >
                    <Icon className="size-5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-cream-300 py-2">
              <Link href="/account" className="flex items-center gap-3 px-4 py-3 text-sm text-brand-700 hover:bg-cream-100">
                <UserIcon className="size-5" /> My settings
              </Link>
              <form action={signOut}>
                <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-brand-700 hover:bg-cream-100">
                  <CloseIcon className="size-5" /> Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Phones: bottom tabs with Scan in the middle */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-300 bg-cream-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
        aria-label="Main"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          <Tab href="/" label="Home" icon={HomeIcon} active={isActive(pathname, "/")} />
          <Tab href="/items" label="Inventory" icon={BoxIcon} active={isActive(pathname, "/items")} />
          <Link href="/scan" className="flex flex-col items-center justify-center" aria-label="Scan a QR code">
            <span className="-mt-5 flex size-14 items-center justify-center rounded-full bg-brand text-cream shadow-lg ring-4 ring-page">
              <ScanIcon className="size-7" />
            </span>
            <span className="mt-0.5 text-[11px] font-medium text-brand-700">Scan</span>
          </Link>
          <Tab href="/checkouts" label="Checked out" icon={OutIcon} active={isActive(pathname, "/checkouts")} />
          <Tab href="/locations" label="Locations" icon={PinIcon} active={isActive(pathname, "/locations")} />
        </div>
      </nav>
    </>
  );
}

function HeaderLink({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
        active ? "bg-cream text-[#284734]" : "text-cream/80 hover:bg-cream/10 hover:text-cream"
      }`}
    >
      {link.label}
    </Link>
  );
}

function Tab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: (p: { className?: string }) => ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
        active ? "text-brand-800" : "text-brand-400"
      }`}
    >
      <Icon className="size-6" />
      {label}
    </Link>
  );
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function MoreMenu({ links, pathname }: { links: NavLink[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const active = links.some((l) => isActive(pathname, l.href));
  const [openPath, setOpenPath] = useState(pathname);
  if (openPath !== pathname) {
    setOpenPath(pathname);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`rounded-md px-2.5 py-1.5 text-sm font-medium ${
          active ? "bg-cream text-[#284734]" : "text-cream/80 hover:bg-cream/10 hover:text-cream"
        }`}
      >
        More ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-cream-300 bg-cream-50 py-1 text-brand-800 shadow-lg">
          {links.map((link) => {
            const Icon = ICONS[link.key];
            return (
              <Link
                key={link.key}
                href={link.href}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-cream-100 ${
                  isActive(pathname, link.href) ? "font-semibold" : ""
                }`}
              >
                <Icon className="size-4 text-brand-500" />
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserMenu({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState(pathname);
  if (openPath !== pathname) {
    setOpenPath(pathname);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-cream/90 hover:bg-cream/10"
      >
        <UserIcon className="size-5" />
        <span className="max-w-32 truncate">{userName}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-cream-300 bg-cream-50 py-1 text-brand-800 shadow-lg">
          <p className="border-b border-cream-300 px-3 py-2 text-xs text-brand-500">Signed in as {roleLabel}</p>
          <Link href="/account" className="block px-3 py-2 text-sm hover:bg-cream-100">
            My settings
          </Link>
          <form action={signOut}>
            <button className="block w-full px-3 py-2 text-left text-sm hover:bg-cream-100">Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
