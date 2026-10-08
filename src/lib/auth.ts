import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user's profile. Redirects to /login when signed out. */
export async function getCurrentProfile() {
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
}
