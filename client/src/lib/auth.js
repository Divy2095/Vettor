const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export const clearAuthSession = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("authUser");
    localStorage.removeItem("sessionDays");

    // Clear session-related data from sessionStorage
    sessionStorage.removeItem("activeSessionId");
    // Also clear any session question indexes
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("session_") && key.endsWith("_qindex")) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
};

export const setAuthSession = ({ accessToken, user, sessionDays }) => {
    if (accessToken) localStorage.setItem("accessToken", accessToken);
    if (user) localStorage.setItem("authUser", JSON.stringify(user));
    if (sessionDays) localStorage.setItem("sessionDays", String(sessionDays));
};

const decodeJwtPayload = (token) => {
    const parts = token?.split(".");
    if (!parts || parts.length !== 3) return null;

    try {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
        const payload = JSON.parse(window.atob(padded));
        return payload;
    } catch (_error) {
        return null;
    }
};

export const isTokenExpired = (token) => {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return true;

    const nowInSeconds = Math.floor(Date.now() / 1000);
    return payload.exp <= nowInSeconds;
};

export const hasValidSession = () => {
    const token = localStorage.getItem("accessToken");
    const user = localStorage.getItem("authUser");

    if (!token || !user) return false;
    if (isTokenExpired(token)) {
        clearAuthSession();
        return false;
    }

    return true;
};

export const refreshAccessToken = async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.accessToken) {
        clearAuthSession();
        return null;
    }

    setAuthSession({
        accessToken: data.accessToken,
        user: data.user,
        sessionDays: data.sessionDays,
    });

    return data.accessToken;
};

export const getUsableAccessToken = async () => {
    const token = localStorage.getItem("accessToken");
    if (token && !isTokenExpired(token)) {
        return token;
    }

    return refreshAccessToken();
};

export const ensureSession = async () => {
    if (hasValidSession()) return true;

    const rawUser = localStorage.getItem("authUser");
    if (!rawUser) {
        clearAuthSession();
        return false;
    }

    const token = await refreshAccessToken();
    return !!token;
};

export const authFetch = async (path, options = {}) => {
    let token = await getUsableAccessToken();
    if (!token) {
        throw new Error("AUTH_REQUIRED");
    }

    const execute = (jwtToken) =>
        fetch(`${API_BASE_URL}${path}`, {
            ...options,
            credentials: "include",
            headers: {
                ...(options.headers || {}),
                Authorization: `Bearer ${jwtToken}`,
            },
        });

    let response = await execute(token);
    if (response.status !== 401) {
        return response;
    }

    token = await refreshAccessToken();
    if (!token) {
        throw new Error("AUTH_REQUIRED");
    }

    response = await execute(token);
    return response;
};

export const logoutSession = async () => {
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: "POST",
            credentials: "include",
        });
    } catch (_error) {
        // Best effort logout.
    } finally {
        clearAuthSession();
    }
};
