import { ApiError } from "../utils/apiError.js";
import { supabase, supabaseAdmin } from "../config/supabase.js";
import { env } from "../config/env.js";

const isSupabaseConfigured = () => {
  return (
    Boolean(env.SUPABASE_URL) &&
    Boolean(env.SUPABASE_ANON_KEY) &&
    env.SUPABASE_ANON_KEY !== "dummy-anon-key-placeholder"
  );
};

/**
 * Authentication Middleware for Supabase Auth.
 *
 * Verifies JWT tokens via `supabase.auth.getUser(token)`.
 * Queries `public.profiles` to ensure `profiles.role` is the single source of truth.
 * Normalizes `req.user` with `id`, `_id`, and `sub` all pointing to the Supabase UUID,
 * preserving compatibility across all existing and migrated controllers.
 * Strictly enforces Supabase Auth token validation; no legacy JWT bypass allowed.
 */
export const authenticate = async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new ApiError(401, "Authentication required"));
  }

  if (!isSupabaseConfigured()) {
    return next(new ApiError(500, "Authentication service is not configured on the server"));
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return next(new ApiError(401, error?.message || "Invalid or expired token"));
    }

    // Role Source of Truth: strictly query public.profiles. Never trust client-supplied claims!
    let role = "user";
    let fullName = user.user_metadata?.full_name || "Vettor Candidate";

    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        role = profile.role || "user";
        fullName = profile.full_name || fullName;
      }
    } catch (profileError) {
      console.warn("[authenticate] Could not fetch profile from database:", profileError.message);
    }

    req.user = {
      id: user.id,
      _id: user.id, // Backward compatibility for controllers reading req.user._id
      sub: user.id, // Backward compatibility for controllers reading req.user.sub
      email: user.email,
      role,
      fullName,
      token, // Enables user-scoped Supabase client instantiation
      rawUser: user,
    };

    return next();
  } catch (error) {
    return next(new ApiError(401, `Authentication failed: ${error.message}`));
  }
};
