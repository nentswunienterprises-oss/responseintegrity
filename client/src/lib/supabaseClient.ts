import { createClient } from "@supabase/supabase-js";

// In Vite, environment variables must start with VITE_ to be exposed to the browser
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Supabase credentials missing in Vite env");
  throw new Error("Missing Supabase environment variables in Vite build");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    storage: window?.localStorage ?? undefined,
    autoRefreshToken: true,
    flowType: 'pkce',
  }
});

// Keep any existing Supabase session intact across reloads so auth state
// does not get invalidated by the browser on startup.
if (typeof window !== 'undefined') {
  try {
    const key = `sb-${supabaseUrl?.split('/').pop()}-auth-token`;
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      window.localStorage.removeItem(key);
    }
  } catch (e) {
    console.error("Error checking Supabase auth storage:", e);
  }
}
