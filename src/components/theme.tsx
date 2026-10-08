"use client";

import { useEffect } from "react";

export type ThemePreference = "system" | "light" | "dark";

/** Applies a theme preference to the page and remembers it on this device. */
export function applyTheme(theme: ThemePreference) {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Private mode etc. — the class below still applies for this visit.
  }
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = theme;
}

/**
 * Keeps the page in sync with the signed-in user's saved theme (it may have
 * been changed on another device) and follows the device when set to System.
 */
export function ThemeSync({ theme }: { theme: ThemePreference }) {
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
  return null;
}
