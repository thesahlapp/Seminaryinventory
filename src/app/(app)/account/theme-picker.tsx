"use client";

import { useState } from "react";
import { applyTheme, type ThemePreference } from "@/components/theme";
import { saveTheme } from "./actions";

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "system", label: "System", hint: "Match this device" },
  { value: "light", label: "Light", hint: "Cream background" },
  { value: "dark", label: "Dark", hint: "Easier at night" },
];

export function ThemePicker({ initial }: { initial: ThemePreference }) {
  const [theme, setTheme] = useState(initial);

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          onClick={() => {
            setTheme(option.value);
            applyTheme(option.value);
            void saveTheme(option.value);
          }}
          className={`rounded-lg border px-3 py-3 text-left ${
            theme === option.value ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-cream-400 bg-cream-50 hover:bg-cream-100"
          }`}
        >
          <span className="block text-sm font-semibold text-brand-800">{option.label}</span>
          <span className="block text-xs text-brand-500">{option.hint}</span>
        </button>
      ))}
    </div>
  );
}
