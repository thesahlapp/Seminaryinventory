"use client";

import { useRef, useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { deleteComment, editComment, postComment } from "./actions";

type Person = { id: string; name: string };
type Comment = { id: string; body: string; createdAt: string; edited: boolean; authorId: string | null; authorName: string };

const TOKEN = /@\[([^\]]*)\]\(([0-9a-f-]{36})\)/gi;

/** Stored form "@[Name](id)" -> what people type and see in the box: "@Name". */
function toEditable(body: string) {
  return body.replace(TOKEN, "@$1");
}

/** Turns "@Name" back into "@[Name](id)" for everyone mentioned via the picker (or by exact name). */
function toStored(text: string, people: Person[]) {
  const byLength = [...people].sort((a, b) => b.name.length - a.name.length);
  let result = text;
  for (const person of byLength) {
    const escaped = person.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(^|[^\\w\\[])@${escaped}(?![\\w])`, "g"), `$1@[${person.name}](${person.id})`);
  }
  return result;
}

function renderBody(body: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of body.matchAll(TOKEN)) {
    parts.push(body.slice(last, match.index));
    parts.push(
      <span key={match.index} className="rounded bg-brand-100 px-1 font-medium text-brand-800">
        @{match[1]}
      </span>,
    );
    last = (match.index ?? 0) + match[0].length;
  }
  parts.push(body.slice(last));
  return parts;
}

export function CommentThread({
  itemId,
  meId,
  isAdmin,
  canPost,
  people,
  comments,
}: {
  itemId: string;
  meId: string;
  isAdmin: boolean;
  canPost: boolean;
  people: Person[];
  comments: Comment[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4 p-4">
      {error && <Alert>{error}</Alert>}
      {comments.length === 0 && <p className="text-sm text-brand-400">No comments yet.</p>}
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} id={`comment-${c.id}`} className="scroll-mt-24 rounded-lg bg-cream-100 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-brand-800">{c.authorName}</p>
              <p className="text-xs text-brand-400">
                {formatDateTime(c.createdAt)}
                {c.edited && " · edited"}
              </p>
            </div>
            {editing === c.id ? (
              <Composer
                people={people}
                initial={toEditable(c.body)}
                submitLabel="Save"
                pending={pending}
                onCancel={() => setEditing(null)}
                onSubmit={(text) =>
                  startTransition(async () => {
                    const result = await editComment(c.id, toStored(text, people));
                    setError(result.error ?? null);
                    if (!result.error) setEditing(null);
                  })
                }
              />
            ) : (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-brand-800">{renderBody(c.body)}</p>
            )}
            {editing !== c.id && (c.authorId === meId || isAdmin) && (
              <div className="mt-1.5 flex gap-3 text-xs">
                {c.authorId === meId && (
                  <button type="button" className="text-brand-500 hover:underline" onClick={() => setEditing(c.id)}>
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  className="text-red-700 hover:underline"
                  onClick={() => {
                    if (!window.confirm("Delete this comment?")) return;
                    startTransition(async () => {
                      const result = await deleteComment(c.id);
                      setError(result.error ?? null);
                    });
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {canPost && (
        <Composer
          people={people.filter((p) => p.id !== meId)}
          initial=""
          submitLabel="Comment"
          pending={pending}
          resetAfterSubmit
          onSubmit={(text) =>
            startTransition(async () => {
              const result = await postComment(itemId, toStored(text, people));
              setError(result.error ?? null);
            })
          }
        />
      )}
    </div>
  );
}

/** Textarea with an @mention picker. */
function Composer({
  people,
  initial,
  submitLabel,
  pending,
  resetAfterSubmit,
  onSubmit,
  onCancel,
}: {
  people: Person[];
  initial: string;
  submitLabel: string;
  pending: boolean;
  resetAfterSubmit?: boolean;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initial);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  const matches = mention
    ? people.filter((p) => p.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6)
    : [];

  function updateMention(value: string, caret: number) {
    const before = value.slice(0, caret);
    const at = before.match(/(^|\s)@([^\s@]{0,30})$/);
    setMention(at ? { start: caret - at[2].length - 1, query: at[2] } : null);
    setHighlight(0);
  }

  function pick(person: Person) {
    if (!mention) return;
    const caret = ref.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, mention.start)}@${person.name} ${text.slice(caret)}`;
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = mention.start + person.name.length + 2;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  return (
    <form
      className="relative mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSubmit(text);
        if (resetAfterSubmit) setText("");
      }}
    >
      <textarea
        ref={ref}
        value={text}
        rows={3}
        maxLength={4000}
        placeholder="Add a comment… type @ to mention someone"
        aria-label="Comment"
        onChange={(e) => {
          setText(e.target.value);
          updateMention(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (!matches.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(matches[highlight]);
          } else if (e.key === "Escape") {
            setMention(null);
          }
        }}
        className="block w-full rounded-md border border-cream-400 bg-cream-50 px-3 py-2 text-sm text-ink placeholder:text-brand-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
      {matches.length > 0 && (
        <ul role="listbox" className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-cream-300 bg-cream-50 shadow-lg">
          {matches.map((person, i) => (
            <li key={person.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(person);
                }}
                className={`block w-full px-3 py-2 text-left text-sm ${i === highlight ? "bg-brand-50 text-brand-800" : "text-brand-700"}`}
              >
                {person.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || !text.trim()}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
