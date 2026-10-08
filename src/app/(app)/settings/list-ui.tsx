import type { ReactNode } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { deleteListEntry, saveListEntry, setListEntryArchived } from "./actions";

type ListTable = "categories" | "locations" | "sizes";

/** One editable row: the fields, a Save button, then Archive/Restore and Delete. */
export function ListRow({
  table,
  id,
  archived,
  usage,
  children,
}: {
  table: ListTable;
  id: string;
  archived: boolean;
  usage?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start">
      <ActionForm action={saveListEntry} className="flex flex-1 flex-wrap items-end gap-3">
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="id" value={id} />
        {children}
        <SubmitButton variant="secondary">Save</SubmitButton>
      </ActionForm>
      <div className="flex flex-wrap items-center gap-2 lg:w-80 lg:justify-end lg:pt-6">
        {usage && <span className="mr-1 text-xs text-brand-400">{usage}</span>}
        <ActionForm action={setListEntryArchived} className="flex flex-col gap-2">
          <input type="hidden" name="table" value={table} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="archive" value={archived ? "false" : "true"} />
          <SubmitButton variant="ghost" size="sm" pendingText="…">
            {archived ? "Restore" : "Archive"}
          </SubmitButton>
        </ActionForm>
        <ActionForm
          action={deleteListEntry}
          className="flex flex-col gap-2"
          confirm="Delete this permanently? This can't be undone."
        >
          <input type="hidden" name="table" value={table} />
          <input type="hidden" name="id" value={id} />
          <SubmitButton variant="danger" size="sm" pendingText="…">
            Delete
          </SubmitButton>
        </ActionForm>
      </div>
    </li>
  );
}

export function AddEntryCard({ table, title, children }: { table: ListTable; title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      <ActionForm action={saveListEntry} resetOnSuccess className="flex flex-wrap items-end gap-3 px-5 py-4">
        <input type="hidden" name="table" value={table} />
        {children}
        <SubmitButton>Add</SubmitButton>
      </ActionForm>
    </Card>
  );
}

export function EntryList({
  title,
  empty,
  children,
}: {
  title: ReactNode;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <Card>
      <CardHeader title={title} />
      {children.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <ul className="divide-y divide-cream-200">{children}</ul>
      )}
    </Card>
  );
}

/** Small labelled input used inside list rows. */
export function InlineField({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-medium text-brand-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}
