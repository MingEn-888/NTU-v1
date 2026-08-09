import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./env.js";

if (!ENV.SUPABASE_URL) {
  console.warn("[Backend Supabase Warning]: SUPABASE_URL is not set in environment variables.");
}

/**
 * Supabase Admin Client (Service Role)
 * CAUTION: Bypasses Row Level Security (RLS). Use strictly for server-side trusted operations,
 * such as background task execution, webhooks, or system audit logging.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  ENV.SUPABASE_URL || "https://placeholder-project.supabase.co",
  ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY || "placeholder-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Creates a user-scoped Supabase client that forwards the user's Auth Bearer Token (JWT).
 * This ensures all queries respect Row Level Security (RLS) policies defined in PostgreSQL.
 * 
 * @param token - Bearer JWT from Authorization header
 */
export function createSupabaseUserClient(token?: string): SupabaseClient {
  return createClient(
    ENV.SUPABASE_URL || "https://placeholder-project.supabase.co",
    ENV.SUPABASE_ANON_KEY || "placeholder-key",
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
