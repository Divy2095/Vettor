import { ApiError } from "../utils/apiError.js";
import { verifyAccessToken } from "../utils/jwt.js";

export const authenticate = (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new ApiError(401, "Authentication required"));
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    return next();
  } catch (_error) {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};
