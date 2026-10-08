"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { getCurrentProfile } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { formText } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function saveProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: formText(formData, "full_name"),
      email_low_stock: formData.get("email_low_stock") === "on",
      email_overdue: formData.get("email_overdue") === "on",
      email_mentions: formData.get("email_mentions") === "on",
    })
    .eq("id", profile.id);
  if (error) return { error: friendlyError(error) };
  refresh();
  return { success: "Saved." };
}

export async function saveTheme(theme: "system" | "light" | "dark") {
  if (!["system", "light", "dark"].includes(theme)) return;
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  await supabase.from("profiles").update({ theme }).eq("id", profile.id);
}

export async function changePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  await getCurrentProfile();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { success: "Password changed." };
}
