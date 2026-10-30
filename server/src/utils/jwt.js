import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export const signAccessToken = (payload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
    issuer: "resume-ai-auth-server",
  });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);

export const signRefreshToken = (payload, expiresIn) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn,
    issuer: "resume-ai-auth-server",
  });

export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);
