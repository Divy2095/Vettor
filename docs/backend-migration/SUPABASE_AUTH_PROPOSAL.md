# Revised Supabase Auth Integration Proposal: Vettor Platform

**Date:** October 2026 (Revised Architecture Review)  
**Auditor:** Antigravity AI Assistant  
**Repository:** `Vettor` (Resume-based AI Interview Question Finder)  
**Scope:** Client authentication, Express middleware refactoring, asymmetric JWT & JWKS verification, and database security triggers.

---

## 1. Architectural Transformation & Verification Reality

In the initial audit, an offline HMAC (`HS256`) secret verification approach (`SUPABASE_JWT_SECRET`) was proposed. However, modern Supabase infrastructure presents critical cryptographic nuances that must be accounted for:

1. **Signing Algorithm Diversity:**  
   Supabase Auth projects can use **asymmetric keys (RS256 or ES256)** or **symmetric keys (HS256)**. Many newer Supabase projects manage keys via standard JSON Web Key Sets (JWKS) published at:  
   `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`  
   Relying solely on a static symmetric `SUPABASE_JWT_SECRET` will fail if the Supabase project signs tokens with asymmetric key pairs.
2. **Revocation & Ban Detection:**  
   Offline cryptographic verification verifies that a token was issued by Supabase and has not expired, but it **cannot detect whether a user has logged out, been banned, or had their session revoked** before the 1-hour access token window closes.
3. **Recommended Verification Strategy:**  
   - **Primary Standard (Universal Compatibility & Revocation Check):** Use Supabase Auth's native `supabase.auth.getUser(jwt)` verification. It is algorithm-agnostic, handles key rotation automatically, and verifies active session validity with zero local crypto key maintenance.
   - **High-Throughput Offline Mode (JWKS):** For endpoints requiring sub-millisecond overhead where round-trip network validation is unacceptable, utilize `jose` or `jwks-rsa` to fetch and cache public keys from the project's `.well-known/jwks.json` endpoint.

---

## 2. Clear Classification of Credentials

To avoid security confusion across client and server environments, credentials are categorized into three distinct tiers:

| Credential | Scope & Location | Exposure Risk | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Frontend (`client/.env`) | **Public** | The HTTP endpoint for your Supabase project. Bundled in client JavaScript. |
| `VITE_SUPABASE_ANON_KEY` | Frontend (`client/.env`) | **Public** | Client-side API key. Embedded in frontend bundles. **Protected by PostgreSQL Row Level Security (RLS)**. It can only execute actions permitted by active RLS policies. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend Server (`server/.env`) | **CRITICAL SECRET** | Superuser credential that **bypasses all PostgreSQL Row Level Security (RLS)**. Must NEVER be exposed to the client, checked into Git, or sent over public responses. Used by Express for background admin tasks and system operations. |
| `SUPABASE_JWT_SECRET` / JWKS URI | Backend Server (`server/.env`) | **SECRET / CONFIG** | Used for local signature verification of access tokens. For HS256, this is the JWT secret string. For RS256/ES256, verification uses the public JWKS URI (`https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`). |

---

## 3. Express Backend Middleware Implementation

### 3.1 Recommended Primary Approach: `supabase.auth.getUser(token)`

This approach is compatible with any signing key configuration and validates token revocation in real time:

```javascript
// server/src/config/supabase.js
import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// Client for validating user tokens and standard API calls
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Admin client for backend operations that bypass RLS (used sparingly)
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
```

```javascript
// server/src/middleware/authenticate.js
import { supabase } from "../config/supabase.js";
import { ApiError } from "../utils/apiError.js";

export const authenticate = async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new ApiError(401, "Authentication required"));
  }

  try {
    // Validates the JWT with Supabase Auth, checking signature, expiry, and revocation
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return next(new ApiError(401, error?.message || "Invalid or expired token"));
    }

    // Attach normalized user payload to request
    req.user = {
      id: user.id, // Supabase UUID
      email: user.email,
      role: user.app_metadata?.role || "user",
      userMetadata: user.user_metadata,
      rawUser: user,
    };

    return next();
  } catch (error) {
    return next(new ApiError(401, `Authentication failed: ${error.message}`));
  }
};
```

---

### 3.2 Offline Asymmetric JWKS Verification (High-Throughput Alternative)

If Express endpoint latency requires zero external network round-trips for token verification, use `jose` with remote JWKS caching:

```javascript
// server/src/middleware/authenticateJwks.js
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

// Cache public JWKS from Supabase project
const JWKS = createRemoteJWKSet(
  new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
  { cacheMaxAge: 10 * 60 * 1000 } // 10 minutes cache
);

export const authenticateJwks = async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new ApiError(401, "Authentication required"));
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
    });

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.app_metadata?.role || "user",
      decodedToken: payload,
    };

    return next();
  } catch (error) {
    return next(new ApiError(401, `Invalid token: ${error.message}`));
  }
};
```

---

## 4. Role Authorization & Anti-Self-Promotion Architecture

### 4.1 Threat Model: Preventing Privilege Escalation
How could an ordinary candidate elevate themselves to `admin`?
1. **Signup Payload Manipulation:** The client sends `{ options: { data: { role: 'admin' } } }` during registration.
2. **Direct Client Profile Update:** The client calls `supabase.from('profiles').update({ role: 'admin' })` via the public anon key.
3. **Token Tampering:** Altering the JWT locally.

### 4.2 Mitigation Strategy
1. **Metadata Isolation:**  
   `supabase.auth.signUp()` writes user-submitted data to `raw_user_meta_data`. Users have **no write access** to `raw_app_meta_data`.
2. **Safe `SECURITY DEFINER` Trigger with Fixed `search_path`:**  
   The profile provisioning trigger explicitly sets `search_path = public, pg_temp` to prevent schema poisoning, and **hardcodes `role = 'user'`**:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Vettor Candidate'),
        'user' -- Strictly force 'user'. Never trust client metadata.
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

3. **Database-Level Role Immutability:**  
   A `BEFORE UPDATE` trigger on `public.profiles` prevents non-admins from changing their own role:

```sql
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- If the role is being changed
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Only allow if the requesting identity is an admin or service_role
        IF auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            -- Sync the change to auth.users.raw_app_meta_data so it appears in future JWTs
            UPDATE auth.users
            SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', NEW.role)
            WHERE id = NEW.id;
        ELSE
            RAISE EXCEPTION 'Unauthorized: Only administrators can modify roles.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();
```

---

## 5. Frontend Client Lifecycle (`client/src/lib/auth.js`)

In the React frontend, custom token cookies and localStorage manipulation are replaced by the official `@supabase/supabase-js` client.

```javascript
// client/src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});
```

### 5.1 Signup Flow
```javascript
export const signUp = async ({ fullName, email, password }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  if (error) throw error;
  return data;
};
```

### 5.2 Sign In Flow
```javascript
export const signIn = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};
```

### 5.3 Silent Session & `authFetch`
```javascript
export const authFetch = async (endpoint, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("AUTH_REQUIRED");
  }

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.status === 401) {
    // Attempt token refresh via Supabase Auth
    const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
    if (!refreshedSession?.access_token) {
      throw new Error("AUTH_REQUIRED");
    }

    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${refreshedSession.access_token}`,
      },
    });
  }

  return response;
};
```
