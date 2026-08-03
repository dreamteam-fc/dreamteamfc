const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_ANON_KEY_ENV = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const SUPABASE_SERVICE_ROLE_KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY";

export function getSupabaseUrl() {
  const value = process.env[SUPABASE_URL_ENV];

  if (!value) {
    throw new Error(`${SUPABASE_URL_ENV} is not configured.`);
  }

  return value;
}

export function getSupabasePublishableKey() {
  const publishableKey = process.env[SUPABASE_PUBLISHABLE_KEY_ENV];
  const anonKey = process.env[SUPABASE_ANON_KEY_ENV];
  const value = publishableKey ?? anonKey;

  if (!value) {
    throw new Error(
      `${SUPABASE_PUBLISHABLE_KEY_ENV} or ${SUPABASE_ANON_KEY_ENV} must be configured.`
    );
  }

  return value;
}

/** Server-only. Used for Storage uploads after app-level auth checks. */
export function getSupabaseServiceRoleKey() {
  const value = process.env[SUPABASE_SERVICE_ROLE_KEY_ENV];

  if (!value) {
    throw new Error(`${SUPABASE_SERVICE_ROLE_KEY_ENV} is not configured.`);
  }

  return value;
}
