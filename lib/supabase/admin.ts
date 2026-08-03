import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl
} from "./config.ts";

/**
 * Supabase client with the service role key.
 * Server-only — never import from client components.
 * Bypasses Storage RLS; callers must enforce app-level authorization first.
 */
export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
