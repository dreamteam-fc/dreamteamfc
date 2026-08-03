import { unstable_rethrow } from "next/navigation";

/**
 * Extract a user-facing message from a server-action failure.
 * Always call this before turning an unknown catch value into an error redirect:
 * Next.js uses thrown redirects/notFound as control flow, and catching them
 * without rethrowing swallows the navigation (often looking like "nothing happened").
 */
export function getActionErrorMessage(
  error: unknown,
  fallback: string
): string {
  unstable_rethrow(error);

  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  return fallback;
}
