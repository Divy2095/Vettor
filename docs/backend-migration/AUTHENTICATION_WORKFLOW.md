# Authentication Workflow & Lifecycle: Vettor Platform

**Date:** October 2026  
**Auditor:** Antigravity AI Assistant  
**Repository:** `Vettor` (Resume-based AI Interview Question Finder)  
**Scope:** Client auth state (`client/src/lib/auth.js`, `AuthPage.jsx`, `AdminRoute.jsx`), Express auth layer (`server/src/controllers/authController.js`, `middleware/authenticate.js`, `middleware/authorize.js`, `utils/jwt.js`, `utils/password.js`, `utils/crypto.js`), and MongoDB `User` model.

---

## 1. Authentication Architecture Overview

Vettor currently operates a custom token-based authentication system using:
- **Short-lived Access Tokens (JWT):** Signed with `JWT_ACCESS_SECRET`, default expiry `15m`, transmitted in HTTP `Authorization: Bearer <token>` headers.
- **Long-lived Refresh Tokens (JWT + Database Hash):** Signed with `JWT_REFRESH_SECRET`, expiries of `1d`, `7d`, or `30d`, stored in an `httpOnly` cookie (`refreshToken`), and tracked in MongoDB as a SHA-256 hash (`refreshTokenHash`) on the `User` document.
- **Passwords:** Hashed with `bcryptjs` using 12 salt rounds.
- **Frontend Storage:** Tokens and user metadata are stored in browser `localStorage` (`accessToken`, `authUser`, `sessionDays`).
- **Authorization:** Role-based access control (`ROLES.USER = "user"`, `ROLES.ADMIN = "admin"`) enforced via Express middleware and React route guards.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND (React)                                     │
│  localStorage: accessToken, authUser, sessionDays     httpOnly Cookie: refreshToken    │
└───────────────────────────────┬──────────────────────────────────┬─────────────────────┘
                                │                                  │
                  1. Authorization: Bearer <JWT>       2. Cookie: refreshToken
                                │                                  │
                                ▼                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Express.js)                                      │
│                                                                                        │
│  [authenticate.js]                [authorize.js]            [authController.js]        │
│  Verifies Access JWT              Checks req.user.role      Handles login, refresh,    │
│  Sets req.user = decoded          Guards admin routes       logout, reset-password     │
└───────────────────────────────────────────────┬────────────────────────────────────────┘
                                                │
                                    Queries & Updates
                                                │
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               DATABASE (MongoDB - users)                               │
│  Fields: email, passwordHash, role, refreshTokenHash, passwordResetTokenHash, ...      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. End-to-End Authentication Lifecycles

### 2.1 User Registration Flow
1. **Frontend Request:**
   - User navigates to `/login` on React client (`client/src/pages/AuthPage.jsx`).
   - Switches to "Sign Up" tab and fills in `fullName`, `email`, and `password`.
   - Submits `POST /api/auth/register` with JSON body:
     ```json
     {
       "fullName": "Jane Doe",
       "email": "jane@example.com",
       "password": "SecureP@ssw0rd!"
     }
     ```
2. **Backend Validation:**
   - Validated against `registerSchema` in `server/src/validators/authSchemas.js`:
     - `fullName`: string, min 2, max 80.
     - `email`: valid email format.
     - `password`: min 8, max 128 characters, requiring at least one lowercase, one uppercase, one digit, and one special character.
3. **Database Operations:**
   - `server/src/controllers/authController.js`:
     ```javascript
     const existingUser = await User.findOne({ email: email.toLowerCase() });
     if (existingUser) {
       throw new ApiError(409, "Email already in use");
     }
     ```
   - Password hashing via `server/src/utils/password.js`:
     ```javascript
     const passwordHash = await bcrypt.hash(password, 12);
     ```
   - Creation:
     ```javascript
     const user = await User.create({
       fullName,
       email,
       passwordHash,
       isEmailVerified: true, // Note: hardcoded true
     });
     ```
4. **Backend Response:**
   - Status 201 Created:
     ```json
     {
       "message": "Registration successful. You can sign in now.",
       "user": {
         "id": "67234...",
         "fullName": "Jane Doe",
         "email": "jane@example.com",
         "role": "user",
         "isEmailVerified": true,
         "createdAt": "2026-10-31T..."
       }
     }
     ```
   - Note: Registration does **not** automatically issue tokens or log the user in. The user is redirected to the login form.

---

### 2.2 User Login Flow
1. **Frontend Request:**
   - User inputs `email`, `password`, and selects "Keep me signed in for" (`sessionDays`: 1, 7, or 30 days, defaulting to 7).
   - Submits `POST /api/auth/login` with `credentials: "include"`.
2. **Backend Processing & Verification:**
   - Validates payload against `loginSchema` (`email`, `password`, optional `sessionDays`).
   - Looks up user: `const user = await User.findOne({ email: email.toLowerCase() });`.
   - Checks password: `await bcrypt.compare(password, user.passwordHash)`. Throws 401 on mismatch.
   - Updates login timestamp: `user.lastLoginAt = new Date();`.
3. **Token Issuance (`issueTokensForUser`):**
   - **Access Token:**
     ```javascript
     signAccessToken({
       sub: String(user._id),
       email: user.email,
       role: user.role,
     });
     ```
     Signed with `env.JWT_ACCESS_SECRET`, expiry `15m`, issuer `"resume-ai-auth-server"`.
   - **Refresh Token:**
     ```javascript
     signRefreshToken(
       { sub: String(user._id), sessionDays: safeSessionDays, role: user.role },
       expiresIn // e.g., '7d'
     );
     ```
     Signed with `env.JWT_REFRESH_SECRET`.
   - **Database Persistence:**
     ```javascript
     user.refreshTokenHash = hashToken(refreshToken); // SHA-256 hex digest
     user.refreshTokenExpiresAt = new Date(Date.now() + maxAgeMs);
     await user.save();
     ```
4. **Backend Response & Cookie:**
   - Sets `httpOnly` cookie:
     ```javascript
     res.cookie("refreshToken", refreshToken, {
       httpOnly: true,
       secure: env.NODE_ENV === "production",
       sameSite: "lax",
       path: "/api/auth",
       maxAge: maxAgeMs,
     });
     ```
   - Sends HTTP 200:
     ```json
     {
       "message": "Login successful",
       "accessToken": "eyJhbGciOi...",
       "user": { "id": "...", "fullName": "Jane Doe", "email": "...", "role": "user" },
       "sessionDays": 7
     }
     ```
5. **Frontend State Setup:**
   - `setAuthSession({ accessToken, user, sessionDays })` persists items to `localStorage`.
   - Redirects user to `/dashboard`.

---

### 2.3 Token Refresh & Silent Session Renewal Flow
1. **Trigger Condition:**
   - `client/src/lib/auth.js` contains `isTokenExpired(token)` which decodes the JWT payload exp claim.
   - If expired or when any API request receives an HTTP 401, `authFetch` automatically calls `refreshAccessToken()`.
2. **Request:**
   - `POST /api/auth/refresh` with `credentials: "include"` (browser includes `refreshToken` cookie).
3. **Backend Validation & Rotation:**
   - Extracts `req.cookies.refreshToken`.
   - Decodes and verifies token signature using `verifyRefreshToken(refreshToken)`.
   - Looks up user: `const user = await User.findById(decoded.sub);`.
   - **Replay / Tamper Check:**
     ```javascript
     const isStoredTokenValid =
       !!user &&
       !!user.refreshTokenHash &&
       !!user.refreshTokenExpiresAt &&
       user.refreshTokenExpiresAt > new Date() &&
       user.refreshTokenHash === hashToken(refreshToken);
     ```
   - If invalid: wipes `refreshTokenHash` on user record, clears cookie, throws 401.
   - If valid: **Rotates the refresh token** (issues a brand new access token and a brand new refresh token, saves new SHA-256 hash in MongoDB, updates the cookie).
4. **Frontend Response:**
   - Returns new `accessToken`, updates `localStorage`, and retries the original failed API request.

---

### 2.4 User Logout Flow
1. **Frontend Request:**
   - User clicks "Sign Out" on Dashboard or Admin Panel -> calls `logoutSession()` (`client/src/lib/auth.js:136`).
   - Sends `POST /api/auth/logout` with `credentials: "include"`.
2. **Backend Processing:**
   - Reads `req.cookies.refreshToken`.
   - Decodes `decoded.sub` and sets:
     ```javascript
     user.refreshTokenHash = null;
     user.refreshTokenExpiresAt = null;
     await user.save();
     ```
   - Clears cookie: `res.clearCookie("refreshToken", { path: "/api/auth" });`.
3. **Frontend Cleanup:**
   - `clearAuthSession()` removes:
     - `localStorage.getItem("accessToken")`
     - `localStorage.getItem("authUser")`
     - `localStorage.getItem("sessionDays")`
     - `sessionStorage.getItem("activeSessionId")` and all `session_*_qindex` keys.
   - Redirects to `/login`.

---

### 2.5 Password Reset Flow
1. **Forgot Password Request:**
   - User inputs email on `/login` and clicks "Forgot Password?" -> calls `POST /api/auth/forgot-password`.
   - Backend queries `User.findOne({ email: email.toLowerCase() })`.
   - If found:
     ```javascript
     const token = crypto.randomBytes(32).toString("hex");
     user.passwordResetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
     user.passwordResetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
     await user.save();
     ```
   - Sends reset email via Nodemailer (`sendPasswordResetEmail`). If SMTP is unconfigured, logs to terminal: `[DEV EMAIL] Use this link to reset your password: http://localhost:5173/reset-password?token=...&email=...`.
2. **Password Reset Execution:**
   - Candidate opens link on React client (`client/src/pages/ResetPasswordPage.jsx`).
   - Inputs new password and submits `POST /api/auth/reset-password` with `{ email, token, password }`.
   - Backend validates token against SHA-256 hash and expiry:
     ```javascript
     user.passwordHash = await hashPassword(password);
     user.passwordResetTokenHash = null;
     user.passwordResetTokenExpiresAt = null;
     await user.save();
     ```
   - Returns 200 "Password reset successful".

---

### 2.6 Email Verification: Reality vs Schema
- The `User` schema defines:
  - `isEmailVerified: { type: Boolean, default: false }`
  - `emailVerificationTokenHash: { type: String, default: null }`
  - `emailVerificationTokenExpiresAt: { type: Date, default: null }`
- **Current Reality:**
  - In `authController.js:74`, registration sets `isEmailVerified: true` unconditionally.
  - There is **no verification email sent**, no verification route implemented, and no endpoint checks `isEmailVerified` before granting access.
  - It is an incomplete/stubbed feature.

---

### 2.7 Admin Authentication & Role-Based Authorization
1. **Roles Defined:** `server/src/constants/roles.js`
   ```javascript
   export const ROLES = {
     USER: "user",
     ADMIN: "admin",
   };
   ```
2. **Authentication Middleware:** `server/src/middleware/authenticate.js`
   - Parses `Authorization: Bearer <token>`.
   - Verifies JWT using `JWT_ACCESS_SECRET`.
   - Attaches decoded token to `req.user = decoded` (contains `{ sub, email, role, iat, exp, iss }`).
3. **Authorization Middleware:** `server/src/middleware/authorize.js`
   ```javascript
   export const authorize = (...allowedRoles) => (req, _res, next) => {
     if (!req.user) return next(new ApiError(401, "Authentication required"));
     if (!allowedRoles.includes(req.user.role)) return next(new ApiError(403, "Insufficient permissions"));
     return next();
   };
   ```
4. **Admin Route Protection:**
   - In `server/src/routes/adminRoutes.js`:
     ```javascript
     adminRouter.use(authenticate, authorize(ROLES.ADMIN));
     ```
   - In frontend: `client/src/components/AdminRoute.jsx` checks `user.role === "admin"`. If regular user attempts access, redirects to `/dashboard` with an "Access Denied" alert banner.

---

## 3. MongoDB Queries Involved in Authentication

All authentication operations target a single collection: **`users`**.

| Action | Mongoose Method | Filter / Data | Purpose |
|---|---|---|---|
| Register | `User.findOne` | `{ email }` | Check if email is already registered |
| Register | `User.create` | `{ fullName, email, passwordHash, isEmailVerified: true }` | Create new user record |
| Login | `User.findOne` | `{ email }` | Find user for password comparison |
| Login | `user.save` | `{ refreshTokenHash, refreshTokenExpiresAt, lastLoginAt }` | Store active session hash |
| Refresh | `User.findById` | `decoded.sub` | Locate user to compare refresh token hash |
| Refresh | `user.save` | `{ refreshTokenHash, refreshTokenExpiresAt }` | Rotate refresh token |
| Logout | `User.findById` | `decoded.sub` | Locate user to revoke refresh token |
| Logout | `user.save` | `{ refreshTokenHash: null, refreshTokenExpiresAt: null }` | Wipe active session hash |
| Forgot Password | `User.findOne` | `{ email }` | Verify account existence |
| Forgot Password | `user.save` | `{ passwordResetTokenHash, passwordResetTokenExpiresAt }` | Save reset token hash |
| Reset Password | `User.findOne` | `{ email }` | Find account to reset |
| Reset Password | `user.save` | `{ passwordHash, passwordResetTokenHash: null, ... }` | Store new password hash |
| User Profile | `User.findById` | `req.user.sub` | Fetch fresh user record for `/me` |

---

## 4. Key Takeaways for Supabase Auth Migration

1. **Eliminate Hand-Rolled Token Infrastructure:** Supabase Auth completely eliminates the need for `bcryptjs`, `jsonwebtoken`, custom cookie management, `refreshTokenHash` storage, and manual password reset token hashing.
2. **Separate Authentication Identity from Profile:** Supabase manages identity in `auth.users` (email, encrypted password, email confirmation, last sign-in). The application will maintain a lightweight `public.profiles` table linked via foreign key `id UUID REFERENCES auth.users(id)` to store `full_name` and `role`.
3. **Role RBAC:** User roles can be stored in `public.profiles.role` and synchronized to Supabase JWT custom claims via an `auth.users` trigger, allowing Express `authorize()` middleware to continue inspecting `req.user.role` with zero friction.
