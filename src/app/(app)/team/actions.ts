"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import type { ActionState } from "@/lib/action-state";
import { authorize, type AppRole } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { formText } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

const NO_SECRET_KEY =
  "Inviting and removing people needs the SUPABASE_SECRET_KEY setting. See the note at the top of this page.";

function readRole(formData: FormData): AppRole | null {
  const role = formData.get("role");
  return role === "admin" || role === "editor" || role === "viewer" ? role : null;
}

async function inviteRedirect() {
  const origin = (await headers()).get("origin") ?? "";
  return `${origin}/auth/confirm`;
}

export async function changeUserRole(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };

  const id = String(formData.get("id"));
  const role = readRole(formData);
  if (!role) return { error: "Choose a role." };

  // Row-level security and a database trigger also enforce that only admins
  // can change roles and that the last admin can't be demoted.
  const { error } = await auth.supabase.from("profiles").update({ role }).eq("id", id);
  if (error) return { error: friendlyError(error) };

  refresh();
  return { success: "Role updated." };
}

export async function inviteUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  if (!admin) return { error: NO_SECRET_KEY };

  const email = formText(formData, "email")?.toLowerCase();
  const fullName = formText(formData, "full_name");
  const role = readRole(formData) ?? "editor";
  if (!email || !email.includes("@")) return { error: "Enter a valid email address." };

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
    redirectTo: await inviteRedirect(),
  });
  if (error) {
    return {
      error: /already been registered|already exists/i.test(error.message)
        ? "That email already has an account."
        : `Could not send the invite: ${error.message}`,
    };
  }

  // New accounts start as editors; apply the chosen role.
  if (role !== "editor") {
    await admin.from("profiles").update({ role }).eq("id", data.user.id);
  }

  refresh();
  return { success: `Invitation sent to ${email}.` };
}

export async function resendInvite(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  if (!admin) return { error: NO_SECRET_KEY };

  const email = formText(formData, "email");
  if (!email) return { error: "Missing email." };

  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: await inviteRedirect() });
  if (error) return { error: `Could not resend the invite: ${error.message}` };

  return { success: "Invitation sent again." };
}

export async function removeUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("admin");
  if ("error" in auth) return { error: auth.error };

  const id = String(formData.get("id"));
  if (id === auth.profile.id) return { error: "You can't remove your own account." };

  const admin = createAdminClient();
  if (!admin) return { error: NO_SECRET_KEY };

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: `Could not remove this person: ${error.message}` };

  refresh();
  return { success: "Removed. Their past changes stay in the history." };
}
