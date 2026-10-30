import React, { useState, useEffect } from "react";
import {
  Clock3,
  Edit2,
  Trash2,
  Plus,
  Terminal,
  FolderOpen,
  X,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SessionDeleteConfirmModal from "./SessionDeleteConfirmModal";
import SessionRenameModal from "./SessionRenameModal";

export default function SessionSidebar({
  sessions = [],
  activeSessionId = null,
  activeQuestionIndex = 0,
  onSelectSession = () => {},
  onDeleteSession = () => {},
  onRenameSession = () => {},
  onAddSession = () => {},
  isLoading = false,
  isMobileOpen = false,
  onCloseMobile = () => {},
}) {
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [sessionToRename, setSessionToRename] = useState(null);

  // Lock body scroll when mobile drawer is open and handle Escape key
  useEffect(() => {
    if (!isMobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onCloseMobile();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileOpen, onCloseMobile]);

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

  const handleSessionClick = (sessionId) => {
    onSelectSession(sessionId);
    if (isMobileOpen) {
      onCloseMobile();
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
    return parts.length > 0 ? parts.join(" • ") : "General Engineering";
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const renderProgress = (session) => {
    const answeredCount = session.answeredCount || 0;
    const totalQuestions = session.totalQuestions || 0;
    const progress =
      totalQuestions > 0
        ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100))
        : 0;

    return (
      <div className="mt-2.5">
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span>
            {answeredCount}/{totalQuestions || 0} completed
          </span>
          <span>{progress}%</span>
        </div>
      </div>
    );
  };

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full justify-between">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-accent" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
              Session Tracks
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground px-2 py-0.5 rounded bg-surface-2 border border-border">
              {sessions.length}
            </span>
            {isMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-accent"
                aria-label="Close session tracks drawer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3">
          <Button
            size="sm"
            onClick={onAddSession}
            variant="outline"
            className="w-full h-8 text-xs font-mono justify-center gap-1.5 border-border bg-surface-2 hover:bg-surface-2/80 text-foreground"
          >
            <Plus className="w-3.5 h-3.5" /> New Track
          </Button>
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sessions.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <Terminal className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-xs text-muted-foreground font-mono">
              No active tracks. Upload a resume to index questions.
            </p>
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session._id === activeSessionId;

            return (
              <div
                key={session._id}
                onClick={() => handleSessionClick(session._id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSessionClick(session._id);
                  }
                }}
                className={`group relative rounded-lg border p-3 text-left transition-all cursor-pointer ${
                  isActive
                    ? "border-accent/50 bg-surface-2 shadow-sm"
                    : "border-border/60 bg-surface-1 hover:border-border hover:bg-surface-2/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      )}
                      <h4 className="truncate text-xs font-medium text-foreground">
                        {getSessionDisplayName(session)}
                      </h4>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-mono text-muted-foreground">
                      {getSessionContext(session)}
                    </p>
                  </div>

                  {/* Actions: on mobile touch devices always visible, on desktop visible on hover or focus */}
                  <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 opacity-90 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleRenameClick(session, e)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded focus:outline-none focus:ring-1 focus:ring-accent"
                      title="Rename session"
                      aria-label={`Rename session ${getSessionDisplayName(session)}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(session, e)}
                      className="p-1 text-muted-foreground hover:text-rose-400 rounded focus:outline-none focus:ring-1 focus:ring-rose-400"
                      title="Delete session"
                      aria-label={`Delete session ${getSessionDisplayName(session)}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {renderProgress(session)}

                <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock3 className="w-3 h-3" />
                    {formatDate(
                      session.lastAccessedAt || session.createdAt
                    )}
                  </span>
                  {isActive ? (
                    <span className="text-accent font-semibold">
                      Q{activeQuestionIndex + 1}
                    </span>
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer telemetry status */}
      <div className="p-3 border-t border-border bg-surface-1 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Vettor Pipeline
        </span>
        <span>Active</span>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop Persistent Sidebar ── */}
      <aside className="w-72 shrink-0 border-r border-border bg-surface-1 flex-col justify-between hidden md:flex h-[calc(100vh-4rem)]">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <div className="h-4 w-24 bg-surface-2 rounded animate-pulse" />
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-20 rounded-lg bg-surface-2/60 border border-border animate-pulse"
              />
            ))}
          </div>
        ) : (
          renderSidebarContent(false)
        )}
      </aside>

      {/* ── Mobile Slide-Over Drawer ── */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Session Tracks">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-surface-1 border-r border-border shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            {isLoading ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    Loading Tracks...
                  </span>
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    className="p-1 rounded text-muted-foreground hover:text-foreground"
                    aria-label="Close drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-20 rounded-lg bg-surface-2/60 border border-border animate-pulse"
                  />
                ))}
              </div>
            ) : (
              renderSidebarContent(true)
            )}
          </div>
        </div>
      )}

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
