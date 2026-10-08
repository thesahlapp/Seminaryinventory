import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const canEdit = (role: AppRole) => role === "admin" || role === "staff";
export const isAdmin = (role: AppRole) => role === "admin";

/** The signed-in user's profile (once per request). Redirects to /login when signed out. */
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", userId)
    .single();
  if (!profile) redirect("/login");

  return profile;
});

/**
 * For Server Actions: returns a Supabase client when the user has the required
 * role, or an error message. The database enforces the same rules (RLS); this
 * just gives a clearer message.
 */
export async function authorize(level: "edit" | "admin") {
  const profile = await getCurrentProfile();
  const allowed = level === "admin" ? isAdmin(profile.role) : canEdit(profile.role);
  if (!allowed) {
    return {
      error:
        level === "admin"
          ? "Only admins can do that."
          : "You have view-only access. Ask an admin for edit access.",
    } as const;
  }
  return { supabase: await createClient(), profile } as const;
}
