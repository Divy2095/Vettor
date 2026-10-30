import React, { useState } from "react";
import { Copy, RefreshCw, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg border border-border bg-surface-1 rounded-xl shadow-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 border border-border text-accent">
                            <Copy className="h-5 w-5" />
                        </div>
                        <div>
                            <span className="font-mono text-[10px] uppercase tracking-wider text-accent font-semibold">
                                DUPLICATE PROFILE DETECTED
                            </span>
                            <h2 className="mt-0.5 text-lg font-bold text-foreground">
                                Active Track Exists
                            </h2>
                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                                A session matching this resume context already has indexed challenges and evaluation telemetry.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-4 rounded-lg border border-border bg-surface-2/60 p-3.5 space-y-1.5 font-mono text-xs">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground truncate">
                            {sessionName}
                        </span>
                        <Badge variant="outline" size="sm">
                            EXISTING
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">
                        {contextParts.length > 0
                            ? contextParts.join(" • ")
                            : "Standard Target Track"}
                    </p>
                    <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                        Last active:{" "}
                        {session?.lastAccessedAt
                            ? new Date(session.lastAccessedAt).toLocaleString()
                            : "Recently"}
                    </p>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="flex-1 text-xs font-mono"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleReuse}
                        disabled={isSubmitting}
                        className="flex-1 text-xs font-mono font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        {isSubmitting ? "Switching..." : "Resume Track"}
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                </div>

                <div className="mt-3 pt-3 border-t border-border text-center">
                    <button
                        type="button"
                        className="text-xs font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                        onClick={handleCreateNew}
                        disabled={isSubmitting}
                    >
                        <RefreshCw className="w-3 h-3" />
                        <span>Force generate new independent session</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
