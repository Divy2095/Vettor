import { ApiError } from "../utils/apiError.js";

export const authorize = (...allowedRoles) => (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Authentication required"));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, "Insufficient permissions"));
  }

  return next();
};
