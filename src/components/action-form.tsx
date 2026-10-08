"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { Alert, Button } from "./ui";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

/**
 * Calls a Server Action with the form's data and returns its state.
 *
 * The form is submitted by hand rather than through <form action>: React
 * otherwise resets the whole form after every action, which wipes what the
 * person typed when there is an error and snaps controlled dropdowns back to
 * their first option.
 */
export function useManualAction(action: Action) {
  const [state, dispatch, pending] = useActionState(action, initialActionState);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };

  return { state, pending, onSubmit };
}

/** A form wired to a Server Action that returns { error } or { success }. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  /** Clear the fields after a successful submit (e.g. "Add" forms). */
  resetOnSuccess?: boolean;
  /** When set, asks the user to confirm before submitting. */
  confirm?: string;
}) {
  const { state, pending, onSubmit } = useManualAction(action);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.success) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
    >
      <PendingContext value={pending}>{children}</PendingContext>
      <FormMessage state={state} />
    </form>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <div className="basis-full">
      {state.error && <Alert>{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingText,
  pending: pendingProp,
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string; pending?: boolean }) {
  const contextPending = useContext(PendingContext);
  const pending = pendingProp ?? contextPending;
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? (pendingText ?? "Saving…") : children}
    </Button>
  );
}
