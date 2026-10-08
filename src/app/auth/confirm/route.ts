import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing page for links in Supabase emails (invite, password reset).
 * The app's email templates point here with ?token_hash=...&type=...&next=...
 * Supabase's default templates send ?code=... instead (or tokens after the "#",
 * which the login page handles).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";

  const code = searchParams.get("code");
  if (code) {
    // Only works in the browser that asked for the link (it holds the other half of the code).
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirectTo.pathname = next;
      return NextResponse.redirect(redirectTo);
    }
  }

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
  // Links with tokens after the "#" end up here too; the login page signs those in.
  if (!code && !tokenHash) return NextResponse.redirect(redirectTo);
  redirectTo.searchParams.set(
    "error",
    code
      ? "That link didn't work. Open it on the same phone or computer (and browser) where you asked for it, or ask for a new one."
      : "That link is invalid or has expired. Ask for a new one.",
  );
  return NextResponse.redirect(redirectTo);
}
