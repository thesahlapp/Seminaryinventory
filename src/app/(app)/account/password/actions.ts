"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  const fail = (error: string) =>
    redirect(`/account/password?${new URLSearchParams({ error })}`);

  if (password.length < 8) fail("Password must be at least 8 characters.");
  if (password !== confirm) fail("Passwords do not match.");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail(error.message);

  if (fullName) {
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", userId);
  }

  redirect("/");
}
