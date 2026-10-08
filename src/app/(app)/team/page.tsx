import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardHeader, Input, PageHeader, Select } from "@/components/ui";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { formatDate, ROLE_LABELS } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { changeUserRole, inviteUser, removeUser, resendInvite } from "./actions";

export const metadata: Metadata = { title: "Team" };

const ROLE_HELP = [
  ["Admin", "Everything: team, categories, locations and sizes."],
  ["Editor", "Add and edit items, photos and quantities."],
  ["Viewer", "Read only."],
];

export default async function TeamPage() {
  const me = await getCurrentProfile();
  if (!isAdmin(me.role)) {
    return <PageHeader title="Team" description="Only admins can manage the team." />;
  }

  const supabase = await createClient();
  const { data: people, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .order("created_at");
  if (error) throw error;

  // With the secret key we can also show who hasn't accepted their invite yet.
  const admin = createAdminClient();
  const awaitingInvite = new Set<string>();
  if (admin) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of data?.users ?? []) {
      if (user.invited_at && !user.last_sign_in_at) awaitingInvite.add(user.id);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="Invite people and choose what they can do." />

      <Card>
        <CardHeader title="Invite someone" />
        {admin ? (
          <ActionForm action={inviteUser} resetOnSuccess className="flex flex-wrap items-end gap-3 px-5 py-4">
            <label className="flex min-w-56 flex-[2] flex-col gap-1 text-xs font-medium text-brand-500">
              Email
              <Input name="email" type="email" required placeholder="name@example.com" autoComplete="off" />
            </label>
            <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-brand-500">
              Name
              <Input name="full_name" placeholder="Optional" autoComplete="off" />
            </label>
            <label className="flex w-32 flex-col gap-1 text-xs font-medium text-brand-500">
              Role
              <Select name="role" defaultValue="editor">
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </Select>
            </label>
            <SubmitButton pendingText="Sending…">Send invite</SubmitButton>
          </ActionForm>
        ) : (
          <div className="space-y-2 px-5 py-4 text-sm text-brand-600">
            <p>
              <strong>One-time setup needed:</strong> to invite and remove people from here, add your Supabase{" "}
              <strong>secret key</strong> to Vercel.
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Supabase → <strong>Project Settings → API Keys</strong> → copy the <strong>Secret key</strong>{" "}
                (starts with <code className="rounded bg-cream-200 px-1">sb_secret_</code>).
              </li>
              <li>
                Vercel → your project → <strong>Environment Variables</strong> → add{" "}
                <code className="rounded bg-cream-200 px-1">SUPABASE_SECRET_KEY</code> as a <strong>Secret</strong>.
              </li>
              <li>
                Vercel → <strong>Deployments</strong> → ⋯ on the latest one → <strong>Redeploy</strong>.
              </li>
            </ol>
            <p className="text-xs text-brand-400">
              Meanwhile you can invite people in Supabase (Authentication → Users → Add user → Send invitation). They
              appear below as Editors.
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
        <CardHeader title={`People (${people.length})`} />
        <ul className="divide-y divide-cream-200">
          {people.map((person) => {
            const isMe = person.id === me.id;
            const pending = awaitingInvite.has(person.id);
            return (
              <li key={person.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-48 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-brand-800">
                    {person.full_name ?? person.email}
                    {isMe && <Badge tone="brand">You</Badge>}
                    {pending && <Badge tone="warning">Invite not accepted yet</Badge>}
                  </p>
                  <p className="text-xs text-brand-400">
                    {person.full_name && `${person.email} · `}added {formatDate(person.created_at)}
                  </p>
                </div>
                <ActionForm action={changeUserRole} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={person.id} />
                  <Select name="role" defaultValue={person.role} aria-label="Role" className="w-32">
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
                {pending && person.email && (
                  <ActionForm action={resendInvite} className="flex flex-col gap-2">
                    <input type="hidden" name="email" value={person.email} />
                    <SubmitButton variant="ghost" size="sm" pendingText="…">
                      Resend invite
                    </SubmitButton>
                  </ActionForm>
                )}
                {!isMe && (
                  <ActionForm
                    action={removeUser}
                    confirm={`Remove ${person.email}? They won't be able to sign in. Their past changes stay in the history.`}
                    className="flex flex-col gap-2"
                  >
                    <input type="hidden" name="id" value={person.id} />
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
