import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardHeader, Input, Select } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { formatDate, ROLE_LABELS } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { changeUserRole, inviteUser, removeUser } from "../actions";
import { InlineField } from "../list-ui";

export const metadata: Metadata = { title: "Users" };

const ROLE_HELP = [
  ["Admin", "Everything, including settings and users."],
  ["Staff", "Add and edit items, photos and stock."],
  ["Viewer", "Can look, but not change anything."],
];

export default async function UsersPage() {
  const supabase = await createClient();
  const me = await getCurrentProfile();
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .order("created_at");
  if (error) throw error;

  const canInvite = Boolean(process.env.SUPABASE_SECRET_KEY);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Invite someone" />
        {canInvite ? (
          <ActionForm action={inviteUser} resetOnSuccess className="flex flex-wrap items-end gap-3 px-5 py-4">
            <InlineField label="Email" className="min-w-56 flex-[2]">
              <Input name="email" type="email" required placeholder="name@example.com" />
            </InlineField>
            <InlineField label="Name" className="min-w-40 flex-1">
              <Input name="full_name" placeholder="Optional" />
            </InlineField>
            <InlineField label="Role" className="w-32">
              <Select name="role" defaultValue="staff">
                <option value="staff">Staff</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </Select>
            </InlineField>
            <SubmitButton pendingText="Sending…">Send invite</SubmitButton>
          </ActionForm>
        ) : (
          <div className="space-y-2 px-5 py-4 text-sm text-brand-600">
            <p>
              To invite people from here, add your Supabase <strong>secret key</strong> to the app&apos;s settings as{" "}
              <code className="rounded bg-cream-200 px-1">SUPABASE_SECRET_KEY</code> (Supabase → Project Settings → API
              Keys → Secret key), then restart the app.
            </p>
            <p>
              Until then, invite people in Supabase under <strong>Authentication → Users → Add user → Send
              invitation</strong>. They&apos;ll appear below as Staff, and you can change their role here.
            </p>
          </div>
        )}
        <dl className="grid gap-x-6 gap-y-1 border-t border-cream-300 px-5 py-3 text-xs text-brand-500 sm:grid-cols-3">
          {ROLE_HELP.map(([role, help]) => (
            <div key={role}>
              <dt className="inline font-semibold text-brand-700">{role}: </dt>
              <dd className="inline">{help}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader title={`People (${users.length})`} />
        <ul className="divide-y divide-cream-200">
          {users.map((user) => {
            const isMe = user.id === me.id;
            return (
              <li key={user.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-48 flex-1">
                  <p className="font-medium text-brand-800">
                    {user.full_name ?? user.email}
                    {isMe && (
                      <span className="ml-2">
                        <Badge tone="brand">You</Badge>
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-brand-400">
                    {user.full_name && `${user.email} · `}joined {formatDate(user.created_at)}
                  </p>
                </div>
                <ActionForm action={changeUserRole} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={user.id} />
                  <Select name="role" defaultValue={user.role} aria-label="Role" className="w-32">
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <SubmitButton variant="secondary" size="sm">
                    Update
                  </SubmitButton>
                </ActionForm>
                {!isMe && (
                  <ActionForm
                    action={removeUser}
                    confirm={`Remove ${user.email}? They will no longer be able to sign in. Their past changes stay in the history.`}
                    className="flex flex-col gap-2"
                  >
                    <input type="hidden" name="id" value={user.id} />
                    <SubmitButton variant="danger" size="sm" pendingText="…">
                      Remove
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
