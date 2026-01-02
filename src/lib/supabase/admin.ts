import { createClient } from "@supabase/supabase-js";
import { getClientEnv, getServerEnv } from "@/lib/env";

/**
 * Server-only Supabase client (service role).
 * Never import into client components.
 */
export function supabaseAdmin() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getClientEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
