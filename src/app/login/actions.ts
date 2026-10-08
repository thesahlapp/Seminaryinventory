"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/";
  // Only allow same-site relative paths.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const params = new URLSearchParams({ error: "Incorrect email or password.", next });
    redirect(`/login?${params}`);
  }

  redirect(next);
}

export async function sendPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect(`/login?${new URLSearchParams({ error: "Enter your email first." })}`);

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/account/password`,
  });

  // Same message whether or not the address exists, so accounts can't be probed.
  redirect(
    `/login?${new URLSearchParams({ message: "If that email has an account, a reset link is on its way." })}`,
  );
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
