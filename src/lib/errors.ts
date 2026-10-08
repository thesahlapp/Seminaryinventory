type DbError = { code?: string; message: string; details?: string | null };

/** Turns a Supabase/Postgres error into a message people can act on. */
export function friendlyError(error: DbError, context?: { inUse?: string; duplicate?: string }) {
  switch (error.code) {
    case "23505":
      return context?.duplicate ?? "That name or SKU is already in use.";
    case "23503":
      return (
        context?.inUse ??
        "This is still in use (it has items, stock or history), so it can't be deleted. Archive it instead."
      );
    case "42501":
      return "You don't have permission to do that.";
    case "23514":
    case "22023":
    case "P0001":
      return error.message;
    default:
      return `Something went wrong: ${error.message}`;
  }
}
