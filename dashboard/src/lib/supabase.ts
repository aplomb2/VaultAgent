import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Browser client (anon key, respects RLS)
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

// Server-side client (service_role key, bypasses RLS)
export function createServiceClient() {
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
