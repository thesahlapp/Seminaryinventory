import type { AppRole } from "@/lib/auth";

export type NavKey =
  | "dashboard" | "inventory" | "locations" | "checkouts" | "kits" | "history"
  | "labels" | "audits" | "orders" | "reports" | "import" | "team" | "settings";

export type NavLink = { key: NavKey; href: string; label: string; group: "main" | "more" };

const ALL: (NavLink & { roles?: AppRole[] })[] = [
  { key: "dashboard", href: "/", label: "Dashboard", group: "main" },
  { key: "inventory", href: "/items", label: "Inventory", group: "main" },
  { key: "locations", href: "/locations", label: "Locations", group: "main" },
  { key: "checkouts", href: "/checkouts", label: "Checked out", group: "main" },
  { key: "kits", href: "/kits", label: "Kits", group: "main" },
  { key: "history", href: "/history", label: "History", group: "main" },
  { key: "labels", href: "/labels", label: "Print labels", group: "more" },
  { key: "audits", href: "/audits", label: "Stock counts", group: "more" },
  { key: "orders", href: "/purchase-orders", label: "Purchase orders", group: "more", roles: ["admin"] },
  { key: "reports", href: "/reports", label: "Reports", group: "more", roles: ["admin"] },
  { key: "import", href: "/import", label: "Import CSV", group: "more", roles: ["admin"] },
  { key: "team", href: "/team", label: "Team", group: "more", roles: ["admin"] },
  { key: "settings", href: "/settings", label: "Settings", group: "more", roles: ["admin"] },
];

export function navLinksFor(role: AppRole): NavLink[] {
  return ALL.filter((link) => !link.roles || link.roles.includes(role)).map(({ key, href, label, group }) => ({
    key,
    href,
    label,
    group,
  }));
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
