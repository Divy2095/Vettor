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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-sm shadow-lg border border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground">
                            Delete Session?
                        </h2>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-muted-foreground mb-2">
                            You're about to delete:
                        </p>
                        <p className="text-sm font-medium text-foreground bg-gray-50 dark:bg-slate-800 rounded p-2 break-words">
                            {sessionName}
                        </p>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>Warning:</strong> All practice attempts and
                            feedback associated with this session will be
                            permanently deleted. This action cannot be undone.
                        </p>
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
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
                            variant="destructive"
                            onClick={handleConfirm}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Deleting..." : "Delete"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
