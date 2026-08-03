import { unstable_rethrow } from "next/navigation";

/** Keep error redirects short — long Storage JSON in ?error= can break navigation. */
const MAX_ACTION_ERROR_MESSAGE_LENGTH = 220;

function sanitizeActionErrorMessage(message: string, fallback: string): string {
  const trimmed = message.replace(/\s+/gu, " ").trim();

  if (!trimmed) {
    return fallback;
  }

  const lower = trimmed.toLowerCase();

  if (lower.includes("sharedarraybuffer")) {
    return "Upload logo fallito: buffer non valido sul server. Riprova.";
  }

  if (
    lower.includes("body exceeded") ||
    lower.includes("request entity too large") ||
    lower.includes("413")
  ) {
    return "Il file e troppo grande per il server. Usa un'immagine sotto i 5 MB.";
  }

  if (lower.includes("supabase_service_role_key")) {
    return "Upload logo non configurato sul server (manca la chiave Storage).";
  }

  if (lower.includes("next_public_supabase_url")) {
    return "Configurazione Supabase incompleta sul server.";
  }

  if (trimmed.length <= MAX_ACTION_ERROR_MESSAGE_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_ACTION_ERROR_MESSAGE_LENGTH - 1)}…`;
}

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
    return sanitizeActionErrorMessage(error.message, fallback);
  }

  return fallback;
}
