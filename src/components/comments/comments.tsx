import { Card, CardHeader } from "@/components/ui";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CommentThread } from "./comment-thread";

/** Comment thread for an item, with @mentions. */
export async function Comments({ itemId, canPost }: { itemId: string; canPost: boolean }) {
  const me = await getCurrentProfile();
  const supabase = await createClient();
  const [{ data: comments }, { data: people }] = await Promise.all([
    supabase
      .from("item_comments")
      .select("id, body, created_at, edited_at, author_id, author:profiles!item_comments_author_id_fkey(full_name, email)")
      .eq("item_id", itemId)
      .order("created_at"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  return (
    <Card id="comments">
      <CardHeader title={`Comments${comments?.length ? ` (${comments.length})` : ""}`} />
      <CommentThread
        itemId={itemId}
        meId={me.id}
        isAdmin={isAdmin(me.role)}
        canPost={canPost}
        people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name ?? p.email ?? "Someone" }))}
        comments={(comments ?? []).map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.created_at,
          edited: Boolean(c.edited_at),
          authorId: c.author_id,
          authorName: c.author?.full_name ?? c.author?.email ?? "Former team member",
        }))}
      />
    </Card>
  );
}
