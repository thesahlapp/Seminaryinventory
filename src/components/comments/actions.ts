"use server";

import { refresh } from "next/cache";
import { authorize, getCurrentProfile, isAdmin } from "@/lib/auth";
import { emailLayout, escapeHtml, sendEmail, siteUrl } from "@/lib/email";
import { friendlyError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };

const MENTION = /@\[([^\]]*)\]\(([0-9a-f-]{36})\)/gi;

function plain(body: string) {
  return body.replace(MENTION, "@$1");
}

export async function postComment(itemId: string, body: string): Promise<Result> {
  const auth = await authorize("edit");
  if ("error" in auth) return { error: auth.error };
  const text = body.trim();
  if (!text) return { error: "Write something first." };
  if (text.length > 4000) return { error: "Comments can be up to 4,000 characters." };

  const { data: comment, error } = await auth.supabase
    .from("item_comments")
    .insert({ item_id: itemId, body: text, author_id: auth.profile.id })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error) };

  await emailMentions(comment.id, itemId, text, auth.profile.full_name ?? auth.profile.email ?? "A teammate");
  refresh();
  return {};
}

export async function editComment(commentId: string, body: string): Promise<Result> {
  const profile = await getCurrentProfile();
  const text = body.trim();
  if (!text) return { error: "A comment can't be empty. Delete it instead." };
  const supabase = await createClient();

  const { data: before } = await supabase.from("item_comments").select("body, item_id").eq("id", commentId).maybeSingle();
  const { error, count } = await supabase
    .from("item_comments")
    .update({ body: text, edited_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", commentId)
    .eq("author_id", profile.id);
  if (error) return { error: friendlyError(error) };
  if (!count) return { error: "You can only edit your own comments." };

  // Email people who were newly mentioned in the edit.
  if (before) {
    const newly = [...text.matchAll(MENTION)].filter(([, , id]) => !before.body.includes(id));
    if (newly.length) await emailMentions(commentId, before.item_id, text, profile.full_name ?? profile.email ?? "A teammate", newly.map((m) => m[2]));
  }
  refresh();
  return {};
}

export async function deleteComment(commentId: string): Promise<Result> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  let query = supabase.from("item_comments").delete({ count: "exact" }).eq("id", commentId);
  if (!isAdmin(profile.role)) query = query.eq("author_id", profile.id);
  const { error, count } = await query;
  if (error) return { error: friendlyError(error) };
  if (!count) return { error: "You can only delete your own comments." };
  refresh();
  return {};
}

async function emailMentions(commentId: string, itemId: string, body: string, actorName: string, onlyIds?: string[]) {
  const ids = [...new Set([...body.matchAll(MENTION)].map((m) => m[2]))].filter((id) => !onlyIds || onlyIds.includes(id));
  if (!ids.length) return;
  const supabase = await createClient();
  const [{ data: people }, { data: item }] = await Promise.all([
    supabase.from("profiles").select("id, email, email_mentions").in("id", ids),
    supabase.from("items").select("name").eq("id", itemId).maybeSingle(),
  ]);
  const me = (await getCurrentProfile()).id;
  const to = (people ?? []).filter((p) => p.id !== me && p.email_mentions && p.email).map((p) => p.email!);
  if (!to.length) return;

  const link = `${siteUrl()}/items/${itemId}#comment-${commentId}`;
  const itemName = item?.name ?? "an item";
  await Promise.all(
    to.map((address) =>
      sendEmail({
        to: address,
        subject: `${actorName} mentioned you on ${itemName}`,
        text: `${actorName} mentioned you on ${itemName}:\n\n${plain(body)}\n\nOpen: ${link}`,
        html: emailLayout(
          `${actorName} mentioned you`,
          `<p style="margin:0 0 8px">On <strong>${escapeHtml(itemName)}</strong>:</p>
           <blockquote style="margin:0 0 16px;padding:10px 14px;background:#f5f0e1;border-left:3px solid #284734;border-radius:4px">${escapeHtml(plain(body)).replace(/\n/g, "<br>")}</blockquote>
           <a href="${link}" style="display:inline-block;background:#284734;color:#f5f0e1;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Open the item</a>`,
        ),
      }),
    ),
  );
}
