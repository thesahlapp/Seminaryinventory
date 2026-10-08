import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Alert, Button, Input, Label } from "@/components/ui";
import { sendPasswordReset, signIn } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Image
          src="/logo.png"
          alt="Qalam Seminary, Dallas, Texas"
          width={980}
          height={840}
          priority
          className="mx-auto h-auto w-56"
        />
        <h1 className="mt-6 text-center font-display text-xl font-semibold tracking-wide text-brand-700">
          Inventory
        </h1>

        <div className="mt-6 rounded-xl border border-cream-300 bg-cream-50 p-6 shadow-sm">
          <Suspense>
            <LoginForm searchParams={searchParams} />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-brand-400">
          Access is by invitation only. Ask an administrator for an invite.
        </p>
      </div>
    </main>
  );
}

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const message = typeof params.message === "string" ? params.message : undefined;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <form action={signIn} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" className="w-full">
        Sign in
      </Button>
      <button
        formAction={sendPasswordReset}
        formNoValidate
        className="w-full text-center text-sm text-brand-500 underline-offset-4 hover:underline"
      >
        Forgot password? Email me a reset link
      </button>
    </form>
  );
}
