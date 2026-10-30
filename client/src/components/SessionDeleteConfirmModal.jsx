import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SessionDeleteConfirmModal({
    session,
    onConfirm,
    onCancel,
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm();
        } finally {
            setIsSubmitting(false);
        }
    };

    const sessionName =
        session?.displayName || session?.sourceFileName || "This session";

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface-1 rounded-xl p-6 w-full max-w-sm shadow-2xl border border-border">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-md">
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                        </div>
                        <h2 className="text-base font-bold text-foreground">
                            Delete Session Track
                        </h2>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-1 hover:bg-surface-2 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-4 text-xs">
                    <div>
                        <p className="text-muted-foreground mb-1 font-mono">
                            Target Session:
                        </p>
                        <p className="font-mono text-foreground bg-surface-2 rounded p-2.5 border border-border/60 truncate">
                            {sessionName}
                        </p>
                    </div>

                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-rose-300">
                        <p className="leading-relaxed">
                            <strong>Irreversible Action:</strong> All generated challenges, candidate responses, and rubric scores will be purged.
                        </p>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            className="text-xs font-mono"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleConfirm}
                            disabled={isSubmitting}
                            className="text-xs font-mono"
                        >
                            {isSubmitting ? "Purging..." : "Delete Permanently"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
