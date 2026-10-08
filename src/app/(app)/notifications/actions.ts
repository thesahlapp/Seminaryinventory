"use server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type NotificationEntry = {
  id: string;
  createdAt: string;
  read: boolean;
  actorName: string;
  itemId: string | null;
  itemName: string | null;
  commentId: string | null;
  excerpt: string;
};

/** The signed-in person's 30 most recent notifications. */
export async function listNotifications(): Promise<NotificationEntry[]> {
  await getCurrentProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, created_at, read_at, item_id, comment_id, actor:profiles!notifications_actor_id_fkey(full_name, email), items(name), item_comments(body)")
    .order("created_at", { ascending: false })
    .limit(30);

  return (data ?? []).map((n) => ({
    id: n.id,
    createdAt: n.created_at,
    read: Boolean(n.read_at),
    actorName: n.actor?.full_name ?? n.actor?.email ?? "Someone",
    itemId: n.item_id,
    itemName: n.items?.name ?? null,
    commentId: n.comment_id,
    excerpt: (n.item_comments?.body ?? "").replace(/@\[([^\]]*)\]\([0-9a-f-]{36}\)/gi, "@$1").slice(0, 140),
  }));
}

export async function markAllNotificationsRead() {
  await getCurrentProfile();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
}
