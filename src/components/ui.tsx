import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-cream shadow-sm hover:bg-brand-800",
  secondary: "border border-cream-400 bg-cream-50 text-brand-800 hover:bg-cream-100",
  danger: "border border-red-200 bg-cream-50 text-red-700 hover:bg-red-50",
  ghost: "text-brand-600 hover:bg-cream-100",
};

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" = "md") {
  const sizing = size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm";
  return `inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${sizing} ${VARIANTS[variant]}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

const fieldClass =
  "block rounded-md border border-cream-400 bg-cream-50 px-3 py-2 text-sm text-ink placeholder:text-brand-300 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60";

/** Fields are full width unless the caller sets a width or flex size. */
function fieldClasses(className: string) {
  const sized = /(^|\s)(w-|flex-)/.test(className);
  return `${fieldClass} ${sized ? "" : "w-full"} ${className}`;
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={fieldClasses(className)} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={fieldClasses(className)} rows={3} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={fieldClasses(className)} {...props} />;
}

export function Label({ className = "", ...props }: ComponentProps<"label">) {
  return <label className={`block text-sm font-medium text-brand-800 ${className}`} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-brand-400">{hint}</p>}
    </div>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  const styles =
    tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-brand-200 bg-brand-50 text-brand-800";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return (
    <section className={`rounded-xl border border-cream-300 bg-cream-50 shadow-sm ${className}`} {...props} />
  );
}

export function CardHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-300 px-5 py-3">
      <h2 className="font-display text-base font-semibold text-brand">{title}</h2>
      {actions}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-brand">{title}</h1>
        {description && <p className="mt-1 text-sm text-brand-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "brand" | "muted" | "warning";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-cream-300 text-brand-800",
    brand: "bg-brand-100 text-brand-800",
    muted: "bg-cream-200 text-brand-400 ring-1 ring-cream-400",
    warning: "bg-amber-100 text-amber-900",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-brand-400">{children}</p>;
}

/** Table wrapper that scrolls horizontally on small screens. */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm [&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:py-2 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-brand-500 [&_thead]:border-b [&_thead]:border-cream-300 [&_tbody_tr]:border-b [&_tbody_tr]:border-cream-200 [&_tbody_tr:last-child]:border-0">
        {children}
      </table>
    </div>
  );
}
