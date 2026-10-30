import React, { useState } from "react";
import { Copy, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DuplicateSessionModal({
    session,
    onReuse,
    onCreateNew,
    onCancel,
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleReuse = async () => {
        setIsSubmitting(true);
        try {
            await onReuse();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateNew = async () => {
        setIsSubmitting(true);
        try {
            await onCreateNew();
        } finally {
            setIsSubmitting(false);
        }
    };

    const sessionName =
        session?.displayName || session?.sourceFileName || "Existing session";
    const contextParts = [
        session?.targetRole,
        session?.targetCompany,
        session?.targetLevel,
        session?.targetDomain,
    ].filter(Boolean);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
            <Card className="w-full max-w-lg border-border/70 bg-white/95 shadow-2xl dark:border-slate-800 dark:bg-slate-950/95">
                <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Copy className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                                    Matching session found
                                </p>
                                <h2 className="mt-1 text-xl font-semibold text-foreground">
                                    Reuse the existing track?
                                </h2>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    We found a session with the same resume and
                                    target setup. Reusing it will continue from
                                    where you left off.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="mt-5 rounded-2xl border border-border/70 bg-muted/40 p-4">
                        <p className="text-sm font-semibold text-foreground">
                            {sessionName}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {contextParts.length > 0
                                ? contextParts.join(" • ")
                                : "No target context saved"}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Last accessed{" "}
                            {session?.lastAccessedAt
                                ? new Date(
                                      session.lastAccessedAt,
                                  ).toLocaleString()
                                : "recently"}
                        </p>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleReuse}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Opening..." : "Reuse session"}
                        </Button>
                    </div>

                    <Button
                        type="button"
                        className="mt-3 w-full"
                        onClick={handleCreateNew}
                        disabled={isSubmitting}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {isSubmitting
                            ? "Creating..."
                            : "Create a new session anyway"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
