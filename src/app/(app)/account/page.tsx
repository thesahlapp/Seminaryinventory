import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";
import { changePassword, saveProfile } from "./actions";
import { ThemePicker } from "./theme-picker";

export const metadata: Metadata = { title: "My settings" };

export default async function AccountPage() {
  const profile = await getCurrentProfile();
  const admin = isAdmin(profile.role);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="My settings" description={`${profile.email} · ${ROLE_LABELS[profile.role]}`} />

      <Card>
        <CardHeader title="Appearance" />
        <div className="p-5">
          <ThemePicker initial={profile.theme as "system" | "light" | "dark"} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Profile and emails" />
        <ActionForm action={saveProfile} className="space-y-5 p-5">
          <Field label="Your name" htmlFor="full_name">
            <Input id="full_name" name="full_name" defaultValue={profile.full_name ?? ""} autoComplete="name" />
          </Field>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-brand-800">Email me about</legend>
            {admin && (
              <Toggle name="email_low_stock" defaultChecked={profile.email_low_stock}>
                <strong>Low stock</strong> — a daily summary of items at or below their minimum
              </Toggle>
            )}
            <Toggle name="email_overdue" defaultChecked={profile.email_overdue}>
              <strong>Overdue check-outs</strong> — {admin ? "anything overdue, " : ""}and gear checked out to me
            </Toggle>
            <Toggle name="email_mentions" defaultChecked={profile.email_mentions}>
              <strong>Mentions</strong> — when someone @mentions me in a comment
            </Toggle>
          </fieldset>
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader title="Change password" />
        <ActionForm action={changePassword} resetOnSuccess className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="New password" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton variant="secondary">Change password</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}

function Toggle({ name, defaultChecked, children }: { name: string; defaultChecked: boolean; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-brand-700">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 shrink-0 accent-[#2f6b47]" />
      <span>{children}</span>
    </label>
  );
}
