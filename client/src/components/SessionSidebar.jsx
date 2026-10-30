import React, { useState } from "react";
import { Clock3, Edit2, Sparkles, Target, Trash2, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SessionDeleteConfirmModal from "./SessionDeleteConfirmModal";
import SessionRenameModal from "./SessionRenameModal";

export default function SessionSidebar({
    sessions = [],
    activeSessionId = null,
    activeSession = null,
    activeQuestionIndex = 0,
    onSelectSession = () => {},
    onDeleteSession = () => {},
    onRenameSession = () => {},
    onAddSession = () => {},
    isLoading = false,
}) {
    const [sessionToDelete, setSessionToDelete] = useState(null);
    const [sessionToRename, setSessionToRename] = useState(null);

    const handleDeleteClick = (session, e) => {
        e.stopPropagation();
        setSessionToDelete(session);
    };

    const handleConfirmDelete = async () => {
        if (sessionToDelete) {
            await onDeleteSession(sessionToDelete._id);
            setSessionToDelete(null);
        }
    };

    const handleRenameClick = (session, e) => {
        e.stopPropagation();
        setSessionToRename(session);
    };

    const handleConfirmRename = async (newName) => {
        if (sessionToRename) {
            await onRenameSession(sessionToRename._id, newName);
            setSessionToRename(null);
        }
    };

    const getSessionDisplayName = (session) => {
        if (session.displayName) return session.displayName;
        return (
            session.sourceFileName ||
            `Session ${new Date(session.createdAt).toLocaleDateString()}`
        );
    };

    const getSessionContext = (session) => {
        const parts = [
            session.targetRole,
            session.targetCompany,
            session.targetLevel,
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(" • ") : "No context";
    };

    const formatDate = (date) => {
        const d = new Date(date);
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const renderProgress = (session) => {
        const answeredCount = session.answeredCount || 0;
        const totalQuestions = session.totalQuestions || 0;
        const progress =
            totalQuestions > 0
                ? Math.min(
                      100,
                      Math.round((answeredCount / totalQuestions) * 100),
                  )
                : 0;

        return (
            <>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400 transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                        {answeredCount}/{totalQuestions || 0} answered
                    </span>
                    <span>{progress}%</span>
                </div>
            </>
        );
    };

    const currentSession =
        activeSession ||
        sessions.find((session) => session._id === activeSessionId) ||
        sessions[0];

    if (isLoading) {
        return (
            <aside className="w-80 shrink-0 border-r border-border/60 bg-slate-50/90 p-4 backdrop-blur-xl dark:bg-slate-950/80">
                <div className="space-y-4">
                    <div className="rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                        <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                        <div className="mt-3 h-5 w-40 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                        <div className="mt-4 h-16 rounded-2xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
                    </div>
                    {[1, 2, 3].map((item) => (
                        <div
                            key={item}
                            className="rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
                        >
                            <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                            <div className="mt-3 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                            <div className="mt-4 h-2 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                        </div>
                    ))}
                </div>
            </aside>
        );
    }

    if (sessions.length === 0) {
        return (
            <aside className="w-80 shrink-0 border-r border-border/60 bg-slate-50/90 p-4 backdrop-blur-xl dark:bg-slate-950/80">
                <Card className="border-dashed border-border/70 bg-white/75 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                    <CardContent className="p-5 text-center space-y-3">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">
                                No sessions yet
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Upload a resume and generate questions to start
                                a practice track.
                            </p>
                            <div className="mt-4">
                                <Button size="sm" onClick={onAddSession}>
                                    <Plus className="w-4 h-4 mr-2 inline" /> Add
                                    Session
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </aside>
        );
    }

    return (
        <>
            <aside className="w-80 shrink-0 border-r border-border/60 bg-slate-50/90 text-slate-950 backdrop-blur-xl dark:bg-slate-950/80 dark:text-slate-50 flex flex-col">
                <div className="sticky top-0 z-10 border-b border-border/60 bg-slate-50/95 px-4 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                Session Library
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-foreground">
                                Your practice tracks
                            </h3>
                        </div>
                        <div className="rounded-full border border-border/70 bg-white px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            {sessions.length}
                        </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                        <Button
                            size="sm"
                            onClick={onAddSession}
                            className="inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Session
                        </Button>
                    </div>

                    {currentSession && (
                        <Card className="mt-4 border-primary/20 bg-gradient-to-br from-primary/10 via-white to-sky-500/10 shadow-sm dark:from-primary/15 dark:via-slate-900 dark:to-sky-500/10">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                                            Active session
                                        </p>
                                        <p className="mt-1 truncate text-sm font-semibold text-foreground">
                                            {getSessionDisplayName(
                                                currentSession,
                                            )}
                                        </p>
                                        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                                            <Target className="h-3 w-3" />
                                            {getSessionContext(currentSession)}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-white/80 px-3 py-2 text-right shadow-sm dark:bg-slate-950/70">
                                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                            Resume at
                                        </p>
                                        <p className="text-sm font-semibold text-foreground">
                                            Q{activeQuestionIndex + 1}
                                        </p>
                                    </div>
                                </div>
                                {renderProgress(currentSession)}
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                    {sessions.map((session) => {
                        const isActive = session._id === activeSessionId;
                        const answeredCount = session.answeredCount || 0;
                        const totalQuestions = session.totalQuestions || 0;
                        const progress =
                            totalQuestions > 0
                                ? Math.min(
                                      100,
                                      Math.round(
                                          (answeredCount / totalQuestions) *
                                              100,
                                      ),
                                  )
                                : 0;

                        return (
                            <div
                                key={session._id}
                                onClick={() => onSelectSession(session._id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onSelectSession(session._id);
                                    }
                                }}
                                aria-current={isActive ? "true" : undefined}
                                className={`group w-full rounded-2xl border p-4 text-left shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer ${
                                    isActive
                                        ? "border-primary/30 bg-gradient-to-br from-primary/10 to-white shadow-md shadow-primary/5 dark:from-primary/15 dark:to-slate-900"
                                        : "border-border/60 bg-white/75 hover:-translate-y-[1px] hover:border-primary/25 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-slate-900"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            {isActive && (
                                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_4px_rgba(59,130,246,0.15)]" />
                                            )}
                                            <h4 className="truncate text-sm font-semibold text-foreground">
                                                {getSessionDisplayName(session)}
                                            </h4>
                                        </div>
                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                            {getSessionContext(session)}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                                        <button
                                            type="button"
                                            onClick={(event) =>
                                                handleRenameClick(
                                                    session,
                                                    event,
                                                )
                                            }
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent bg-white/80 text-muted-foreground shadow-sm transition hover:border-border hover:text-foreground dark:bg-slate-950/70"
                                            title="Rename session"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) =>
                                                handleDeleteClick(
                                                    session,
                                                    event,
                                                )
                                            }
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent bg-white/80 text-red-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 dark:bg-slate-950/70 dark:hover:bg-red-950/30"
                                            title="Delete session"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                                        {answeredCount}/{totalQuestions || 0}{" "}
                                        answered
                                    </span>
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                        <Clock3 className="h-3 w-3" />
                                        {formatDate(
                                            session.lastAccessedAt ||
                                                session.createdAt,
                                        )}
                                    </span>
                                </div>

                                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                    <div
                                        className={`h-full rounded-full transition-all ${
                                            isActive
                                                ? "bg-gradient-to-r from-primary to-sky-400"
                                                : "bg-slate-400 dark:bg-slate-500"
                                        }`}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </aside>

            {sessionToDelete && (
                <SessionDeleteConfirmModal
                    session={sessionToDelete}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setSessionToDelete(null)}
                />
            )}

            {sessionToRename && (
                <SessionRenameModal
                    session={sessionToRename}
                    onConfirm={handleConfirmRename}
                    onCancel={() => setSessionToRename(null)}
                />
            )}
        </>
    );
}
