import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert, Button, Input, Label } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { updatePassword } from "./actions";

export const metadata: Metadata = { title: "Set your password" };

export default function SetPasswordPage({ searchParams }: PageProps<"/account/password">) {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-2xl font-semibold text-brand">Set your password</h1>
      <p className="mt-2 text-sm text-brand-500">
        Choose a password you&apos;ll use to sign in from now on.
      </p>

      <Suspense>
        <PasswordForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PasswordForm({
  searchParams,
}: Pick<PageProps<"/account/password">, "searchParams">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const profile = await getCurrentProfile();

  return (
    <form
      action={updatePassword}
      className="mt-6 space-y-4 rounded-xl border border-cream-300 bg-cream-50 p-6 shadow-sm"
    >
      {error && <Alert>{error}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="full_name">Your name</Label>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          defaultValue={profile.full_name ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <Button type="submit" className="w-full">
        Save password
      </Button>
    </form>
  );
}
