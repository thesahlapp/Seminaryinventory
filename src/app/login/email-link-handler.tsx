"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Alert } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase's default invite and reset emails sign people in with tokens after
 * the "#" in the link, which only the browser can see. When those arrive here,
 * sign in with them and go straight to choosing a password.
 * (The app's own email templates use /auth/confirm instead; see the README.)
 */
const readHash = () => window.location.hash;
const noSubscribe = () => () => {};

export function EmailLinkHandler({ children }: { children: ReactNode }) {
  const hash = useSyncExternalStore(noSubscribe, readHash, () => "");
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");
  const linkError = params.get("error_description");
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !refreshToken) return;
    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setFailed("That link is invalid or has expired. Ask for a new one.");
          return;
        }
        // Full page load so the server sees the new session.
        window.location.replace(type === "invite" || type === "recovery" ? "/account/password" : "/");
      });
  }, [accessToken, refreshToken, type]);

  if (accessToken && !failed) {
    return <p className="py-6 text-center text-sm text-brand-600">Signing you in…</p>;
  }
  return (
    <>
      {(failed || linkError) && (
        <div className="mb-4">
          <Alert>{failed ?? `${linkError}. Ask for a new link.`}</Alert>
        </div>
      )}
      {children}
    </>
  );
}
