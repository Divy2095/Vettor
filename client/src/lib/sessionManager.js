import { useState, useCallback, useEffect } from "react";
import { authFetch } from "./auth.js";

const sortSessionsByRecentActivity = (sessions) =>
    [...sessions].sort(
        (firstSession, secondSession) =>
            new Date(secondSession.lastAccessedAt || secondSession.createdAt) -
            new Date(firstSession.lastAccessedAt || firstSession.createdAt),
    );

export const useSession = () => {
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [sessionsError, setSessionsError] = useState(null);

    // Load sessions on mount and restore active session from sessionStorage
    useEffect(() => {
        const loadSessions = async () => {
            setIsLoadingSessions(true);
            setSessionsError(null);

            try {
                const response = await authFetch("/questions/history");
                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.message || "Could not load sessions");
                }

                setSessions(sortSessionsByRecentActivity(data.sessions || []));

                // Restore active session from sessionStorage
                const savedSessionId =
                    sessionStorage.getItem("activeSessionId");
                if (
                    savedSessionId &&
                    data.sessions?.some((s) => s._id === savedSessionId)
                ) {
                    setActiveSessionId(savedSessionId);
                } else if (data.sessions?.length > 0) {
                    // Default to most recent session
                    setActiveSessionId(data.sessions[0]._id);
                    sessionStorage.setItem(
                        "activeSessionId",
                        data.sessions[0]._id,
                    );
                }
            } catch (error) {
                console.error("Failed to load sessions:", error);
                setSessionsError(error.message);
            } finally {
                setIsLoadingSessions(false);
            }
        };

        loadSessions();
    }, []);

    const switchSession = useCallback(async (sessionId) => {
        try {
            // Call the API to update lastAccessedAt
            const response = await authFetch(`/questions/${sessionId}/access`, {
                method: "POST",
            });

            if (!response.ok) {
                throw new Error("Failed to access session");
            }

            // Update UI
            setActiveSessionId(sessionId);
            sessionStorage.setItem("activeSessionId", sessionId);

            const responseData = await response.json().catch(() => ({}));

            if (responseData?.session) {
                setSessions((prev) =>
                    sortSessionsByRecentActivity(
                        prev.map((session) =>
                            session._id === sessionId
                                ? {
                                      ...session,
                                      lastAccessedAt:
                                          responseData.session.lastAccessedAt,
                                  }
                                : session,
                        ),
                    ),
                );
            }
        } catch (error) {
            console.error("Failed to switch session:", error);
            setSessionsError(error.message);
        }
    }, []);

    const addSession = useCallback((session) => {
        setSessions((prev) =>
            sortSessionsByRecentActivity([
                session,
                ...prev.filter((s) => s._id !== session._id),
            ]),
        );

        setActiveSessionId(session._id);
        sessionStorage.setItem("activeSessionId", session._id);
    }, []);

    const deleteSession = useCallback(
        async (sessionId) => {
            try {
                const response = await authFetch(`/questions/${sessionId}`, {
                    method: "DELETE",
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.message || "Failed to delete session");
                }

                // Remove from sessions list
                const updatedSessions = sessions.filter(
                    (s) => s._id !== sessionId,
                );
                setSessions(sortSessionsByRecentActivity(updatedSessions));

                // If deleted session was active, switch to the next most recent
                if (activeSessionId === sessionId) {
                    if (updatedSessions.length > 0) {
                        const nextSessionId = updatedSessions[0]._id;
                        setActiveSessionId(nextSessionId);
                        sessionStorage.setItem(
                            "activeSessionId",
                            nextSessionId,
                        );
                    } else {
                        setActiveSessionId(null);
                        sessionStorage.removeItem("activeSessionId");
                    }
                }

                // Clear sessionStorage for this session
                sessionStorage.removeItem(`session_${sessionId}_qindex`);
            } catch (error) {
                console.error("Failed to delete session:", error);
                setSessionsError(error.message);
            }
        },
        [sessions, activeSessionId],
    );

    const renameSession = useCallback(async (sessionId, newName) => {
        try {
            const response = await authFetch(`/questions/${sessionId}/rename`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ displayName: newName }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || "Failed to rename session");
            }

            const updatedSession = await response.json().then((d) => d.session);

            // Update sessions list
            setSessions((prev) =>
                prev.map((s) =>
                    s._id === sessionId
                        ? { ...s, displayName: updatedSession.displayName }
                        : s,
                ),
            );
        } catch (error) {
            console.error("Failed to rename session:", error);
            setSessionsError(error.message);
        }
    }, []);

    const getActiveSession = useCallback(() => {
        return sessions.find((s) => s._id === activeSessionId) || null;
    }, [sessions, activeSessionId]);

    const getSessionQuestionIndex = useCallback(() => {
        if (!activeSessionId) return 0;

        const savedIndex = sessionStorage.getItem(
            `session_${activeSessionId}_qindex`,
        );
        if (savedIndex !== null) {
            return parseInt(savedIndex, 10);
        }

        // Default to 0 (first question)
        return 0;
    }, [activeSessionId]);

    const setSessionQuestionIndex = useCallback(
        (index) => {
            if (activeSessionId) {
                sessionStorage.setItem(
                    `session_${activeSessionId}_qindex`,
                    String(index),
                );
            }
        },
        [activeSessionId],
    );

    const clearSessionStorage = useCallback(() => {
        // Clear all session-related data from sessionStorage
        sessionStorage.removeItem("activeSessionId");
        sessions.forEach((session) => {
            sessionStorage.removeItem(`session_${session._id}_qindex`);
        });
    }, [sessions]);

    return {
        sessions,
        activeSessionId,
        activeSession: getActiveSession(),
        isLoadingSessions,
        sessionsError,
        switchSession,
        deleteSession,
        renameSession,
        addSession,
        getSessionQuestionIndex,
        setSessionQuestionIndex,
        clearSessionStorage,
    };
};

export default useSession;
