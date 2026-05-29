import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_API_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const legacyLocalOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const portlessLocalOrigin = "https://tracking-so.localhost";

if (
  typeof window !== "undefined" &&
  import.meta.env.DEV &&
  legacyLocalOrigins.has(window.location.origin) &&
  window.location.hash.includes("access_token=")
) {
  window.location.replace(
    `${portlessLocalOrigin}${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
