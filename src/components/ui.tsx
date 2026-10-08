import type { ComponentProps } from "react";

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-cream shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`block w-full rounded-md border border-cream-400 bg-cream-50 px-3 py-2 text-sm text-ink placeholder:text-brand-300 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${className}`}
      {...props}
    />
  );
}

export function Label({ className = "", ...props }: ComponentProps<"label">) {
  return (
    <label className={`block text-sm font-medium text-brand-800 ${className}`} {...props} />
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-brand-200 bg-brand-50 text-brand-800";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}
