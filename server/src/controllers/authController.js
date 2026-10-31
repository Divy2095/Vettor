import mongoose from "mongoose";
import { env } from "../config/env.js";
import { supabase, supabaseAdmin } from "../config/supabase.js";
import { User } from "../models/User.js";
import { sendPasswordResetEmail } from "../services/emailService.js";
import { ApiError } from "../utils/apiError.js";
import { generateToken, hashToken } from "../utils/crypto.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

const REFRESH_COOKIE_NAME = "refreshToken";
const SESSION_EXPIRY_DAYS = new Set([1, 7, 30]);

const isSupabaseConfigured = () => {
  return (
    Boolean(env.SUPABASE_URL) &&
    Boolean(env.SUPABASE_ANON_KEY) &&
    env.SUPABASE_ANON_KEY !== "dummy-anon-key-placeholder"
  );
};

const isMongoConnected = () => {
  return mongoose.connection.readyState === 1;
};

const getRefreshCookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
  maxAge: maxAgeMs,
});

const buildSessionExpiry = (sessionDays) => ({
  expiresIn: `${sessionDays}d`,
  maxAgeMs: sessionDays * 24 * 60 * 60 * 1000,
});

const fetchProfile = async (userId) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name, created_at")
      .eq("id", userId)
      .maybeSingle();

    return profile;
  } catch (error) {
    console.warn("[authController] fetchProfile error:", error.message);
    return null;
  }
};

const buildSafeUser = (user, profile = null) => ({
  id: user.id || user._id,
  fullName: profile?.full_name || user.user_metadata?.full_name || user.fullName || "Vettor Candidate",
  email: user.email,
  role: profile?.role || user.app_metadata?.role || user.role || "user",
  isEmailVerified: Boolean(user.email_confirmed_at || user.isEmailVerified),
  createdAt: profile?.created_at || user.created_at || user.createdAt,
});

// Legacy token issuer for transition fallback
const issueLegacyTokensForUser = async (user, sessionDays) => {
  const safeSessionDays = SESSION_EXPIRY_DAYS.has(sessionDays) ? sessionDays : 7;
  const { expiresIn, maxAgeMs } = buildSessionExpiry(safeSessionDays);

  const accessToken = signAccessToken({
    sub: String(user._id),
    email: user.email,
    role: user.role,
  });

  const refreshToken = signRefreshToken(
    {
      sub: String(user._id),
      sessionDays: safeSessionDays,
      role: user.role,
    },
    expiresIn,
  );

  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpiresAt = new Date(Date.now() + maxAgeMs);
  await user.save();

  return { accessToken, refreshToken, maxAgeMs, sessionDays: safeSessionDays };
};

/**
 * Register User
 * POST /api/auth/register
 */
export const register = async (req, res) => {
  const { fullName, email, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (error) {
      if (error.message?.toLowerCase().includes("already registered")) {
        throw new ApiError(409, "Email already in use");
      }
      throw new ApiError(400, error.message);
    }

    // Detect duplicate registration when identities array is empty
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new ApiError(409, "Email already in use");
    }

    const profile = await fetchProfile(data.user.id);

    return res.status(201).json({
      message: "Registration successful. You can sign in now.",
      user: buildSafeUser(data.user, profile),
    });
  }

  // Fallback to legacy Mongoose only if MongoDB is actively connected
  if (isMongoConnected()) {
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new ApiError(409, "Email already in use");
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      fullName,
      email: normalizedEmail,
      passwordHash,
      isEmailVerified: true,
    });

    return res.status(201).json({
      message: "Registration successful. You can sign in now.",
      user: buildSafeUser(user),
    });
  }

  throw new ApiError(500, "Authentication service is not configured on the server");
};

/**
 * Login User
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  const { email, password, sessionDays: requestedSessionDays } = req.body;
  const normalizedEmail = email.trim().toLowerCase();
  const safeDays = SESSION_EXPIRY_DAYS.has(Number(requestedSessionDays)) ? Number(requestedSessionDays) : 7;
  const { maxAgeMs } = buildSessionExpiry(safeDays);

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.session || !data.user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const profile = await fetchProfile(data.user.id);

    // Set refresh token cookie for web session continuity
    res.cookie(REFRESH_COOKIE_NAME, data.session.refresh_token, getRefreshCookieOptions(maxAgeMs));

    return res.status(200).json({
      message: "Login successful",
      accessToken: data.session.access_token,
      user: buildSafeUser(data.user, profile),
      sessionDays: safeDays,
    });
  }

  // Fallback to legacy Mongoose only if MongoDB is actively connected
  if (isMongoConnected()) {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid email or password");
    }

    user.lastLoginAt = new Date();
    const { accessToken, refreshToken, sessionDays } = await issueLegacyTokensForUser(
      user,
      Number(requestedSessionDays),
    );

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions(maxAgeMs));

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      user: buildSafeUser(user),
      sessionDays,
    });
  }

  throw new ApiError(500, "Authentication service is not configured on the server");
};

/**
 * Refresh Session
 * POST /api/auth/refresh
 */
export const refresh = async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(0));
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const profile = await fetchProfile(data.user.id);
    const { maxAgeMs } = buildSessionExpiry(7);

    res.cookie(REFRESH_COOKIE_NAME, data.session.refresh_token, getRefreshCookieOptions(maxAgeMs));

    return res.status(200).json({
      message: "Token refreshed",
      accessToken: data.session.access_token,
      user: buildSafeUser(data.user, profile),
      sessionDays: 7,
    });
  }

  if (isMongoConnected()) {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (_error) {
      res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(0));
      throw new ApiError(401, "Invalid refresh token");
    }

    const user = await User.findById(decoded.sub);
    const isStoredTokenValid =
      !!user &&
      !!user.refreshTokenHash &&
      !!user.refreshTokenExpiresAt &&
      user.refreshTokenExpiresAt > new Date() &&
      user.refreshTokenHash === hashToken(refreshToken);

    if (!isStoredTokenValid) {
      if (user) {
        user.refreshTokenHash = null;
        user.refreshTokenExpiresAt = null;
        await user.save();
      }
      res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(0));
      throw new ApiError(401, "Refresh token expired");
    }

    const { accessToken, refreshToken: rotatedRefreshToken, maxAgeMs, sessionDays } =
      await issueLegacyTokensForUser(user, Number(decoded.sessionDays));

    res.cookie(REFRESH_COOKIE_NAME, rotatedRefreshToken, getRefreshCookieOptions(maxAgeMs));

    return res.status(200).json({
      message: "Token refreshed",
      accessToken,
      user: buildSafeUser(user),
      sessionDays,
    });
  }

  throw new ApiError(500, "Authentication service is not configured on the server");
};

/**
 * Logout User
 * POST /api/auth/logout
 */
export const logout = async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (isSupabaseConfigured() && refreshToken) {
    try {
      await supabase.auth.signOut();
    } catch (_error) {
      // Best effort sign out
    }
  } else if (isMongoConnected() && refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await User.findById(decoded.sub);
      if (user) {
        user.refreshTokenHash = null;
        user.refreshTokenExpiresAt = null;
        await user.save();
      }
    } catch (_error) {
      // Best effort logout
    }
  }

  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(0));
  return res.status(200).json({ message: "Logged out" });
};

/**
 * Forgot Password
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${env.FRONTEND_URL}/reset-password`,
      });
    } catch (error) {
      console.warn("[forgotPassword] Supabase reset error:", error.message);
    }

    return res.status(200).json({
      message: "If the account exists, password reset instructions were sent",
    });
  }

  if (isMongoConnected()) {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(200).json({
        message: "If the account exists, password reset instructions were sent",
      });
    }

    const token = generateToken();
    user.passwordResetTokenHash = hashToken(token);
    user.passwordResetTokenExpiresAt = new Date(
      Date.now() + env.RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000,
    );
    await user.save();

    try {
      await sendPasswordResetEmail({ to: user.email, token });
    } catch (error) {
      console.error("Password reset email send failed:", error.message);
    }

    return res.status(200).json({
      message: "If the account exists, password reset instructions were sent",
    });
  }

  throw new ApiError(500, "Authentication service is not configured on the server");
};

/**
 * Reset Password
 * POST /api/auth/reset-password
 */
export const resetPassword = async (req, res) => {
  const { email, token, password } = req.body;
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (isSupabaseConfigured()) {
    let verifiedUserId = null;

    // 1. Try OTP verification if email is provided
    if (normalizedEmail) {
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token,
          type: "recovery",
        });
        if (!error && data?.user) {
          verifiedUserId = data.user.id;
        }
      } catch (_e) {}
    }

    // 2. Try token_hash verification
    if (!verifiedUserId) {
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: "recovery",
        });
        if (!error && data?.user) {
          verifiedUserId = data.user.id;
        }
      } catch (_e) {}
    }

    // 3. Try access_token verification (if token is an access_token from recovery redirect)
    if (!verifiedUserId) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          verifiedUserId = user.id;
        }
      } catch (_e) {}
    }

    if (!verifiedUserId) {
      throw new ApiError(400, "Invalid or expired reset token");
    }

    // Update password using admin client for the verified user
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      verifiedUserId,
      { password },
    );

    if (updateError) {
      throw new ApiError(400, updateError.message || "Failed to update password");
    }

    return res.status(200).json({ message: "Password reset successful" });
  }

  // Fallback to legacy Mongoose only if MongoDB is actively connected
  if (isMongoConnected()) {
    if (!normalizedEmail) {
      throw new ApiError(400, "Email is required for legacy password reset");
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new ApiError(400, "Invalid password reset request");
    }

    const isResetTokenValid =
      user.passwordResetTokenHash === tokenHash &&
      user.passwordResetTokenExpiresAt &&
      user.passwordResetTokenExpiresAt > new Date();

    if (!isResetTokenValid) {
      throw new ApiError(400, "Invalid or expired reset token");
    }

    user.passwordHash = await hashPassword(password);
    user.passwordResetTokenHash = null;
    user.passwordResetTokenExpiresAt = null;
    await user.save();

    return res.status(200).json({ message: "Password reset successful" });
  }

  throw new ApiError(500, "Authentication service is not configured on the server");
};

/**
 * Current User Profile
 * GET /api/auth/me
 */
export const me = async (req, res) => {
  if (isSupabaseConfigured()) {
    const profile = await fetchProfile(req.user.id);
    return res.status(200).json({
      user: buildSafeUser(req.user, profile),
    });
  }

  if (isMongoConnected()) {
    const user = await User.findById(req.user.sub);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    return res.status(200).json({ user: buildSafeUser(user) });
  }

  throw new ApiError(500, "Authentication service is not configured on the server");
};

/**
 * Admin Ping
 * GET /api/auth/admin-ping
 */
export const adminPing = async (_req, res) => {
  return res.status(200).json({ message: "Admin access confirmed" });
};
