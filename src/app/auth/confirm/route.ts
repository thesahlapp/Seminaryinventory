import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing page for links in Supabase emails (invite, password reset).
 * The email templates point here with ?token_hash=...&type=...&next=...
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      // New invitees and password resets both need to choose a password.
      redirectTo.pathname =
        type === "invite" || type === "recovery" ? "/account/password" : next;
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "That link is invalid or has expired. Ask for a new one.");
  return NextResponse.redirect(redirectTo);
}
