import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { sendPasswordResetEmail } from "../services/emailService.js";
import { ApiError } from "../utils/apiError.js";
import { generateToken, hashToken } from "../utils/crypto.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

const REFRESH_COOKIE_NAME = "refreshToken";
const SESSION_EXPIRY_DAYS = new Set([1, 7, 30]);

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

const issueTokensForUser = async (user, sessionDays) => {
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

const buildSafeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
  createdAt: user.createdAt,
});

export const register = async (req, res) => {
  const { fullName, email, password } = req.body;

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(409, "Email already in use");
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    fullName,
    email,
    passwordHash,
    isEmailVerified: true,
  });

  return res.status(201).json({ message: "Registration successful. You can sign in now.", user: buildSafeUser(user) });
};

export const login = async (req, res) => {
  const { email, password, sessionDays: requestedSessionDays } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  user.lastLoginAt = new Date();
  const { accessToken, refreshToken, maxAgeMs, sessionDays } = await issueTokensForUser(
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
};

export const refresh = async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

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
    await issueTokensForUser(user, Number(decoded.sessionDays));

  res.cookie(REFRESH_COOKIE_NAME, rotatedRefreshToken, getRefreshCookieOptions(maxAgeMs));

  return res.status(200).json({
    message: "Token refreshed",
    accessToken,
    user: buildSafeUser(user),
    sessionDays,
  });
};

export const logout = async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await User.findById(decoded.sub);
      if (user) {
        user.refreshTokenHash = null;
        user.refreshTokenExpiresAt = null;
        await user.save();
      }
    } catch (_error) {
      // Best effort logout: clear cookie even if token is invalid.
    }
  }

  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(0));
  return res.status(200).json({ message: "Logged out" });
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return res
      .status(200)
      .json({ message: "If the account exists, password reset instructions were sent" });
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

  return res
    .status(200)
    .json({ message: "If the account exists, password reset instructions were sent" });
};

export const resetPassword = async (req, res) => {
  const { email, token, password } = req.body;
  const tokenHash = hashToken(token);

  const user = await User.findOne({ email: email.toLowerCase() });
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
};

export const me = async (req, res) => {
  const user = await User.findById(req.user.sub);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json({ user: buildSafeUser(user) });
};

export const adminPing = async (_req, res) => {
  return res.status(200).json({ message: "Admin access confirmed" });
};
