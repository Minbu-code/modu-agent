import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

// Keep the app renderable when a Vercel preview has not received its env vars yet.
// Auth actions are blocked in the UI until the variables are configured.
const clientUrl = supabaseUrl ?? "https://missing-supabase-config.supabase.co";
const clientKey = supabasePublishableKey ?? "missing-supabase-publishable-key";

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
