import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

const supabaseUrl = env.SUPABASE_URL || "https://ukulbyezmcvxcevfpflo.supabase.co";
const anonKey = env.SUPABASE_ANON_KEY || "dummy-anon-key-placeholder";
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "dummy-service-role-placeholder";

/**
 * Public/Anon Supabase Client.
 * Used for authentication operations (signUp, signInWithPassword, getUser)
 * and RLS-protected queries.
 */
export const supabase = createClient(supabaseUrl, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/**
 * Service-Role Supabase Client.
 * Superuser client that bypasses RLS policies.
 * Strictly used for trusted backend operations (e.g. system profile role lookups, moderation).
 * NEVER expose this or its credentials to the client/frontend.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/**
 * Factory creating a user-scoped Supabase client.
 * Forwards the user's JWT so all PostgreSQL queries are executed
 * under that user's identity and subject to Row Level Security (RLS).
 *
 * @param {string} accessToken - The user's Supabase JWT access token
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export const createUserClient = (accessToken) => {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
};
