import React, { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SessionRenameModal({ session, onConfirm, onCancel }) {
    const [newName, setNewName] = useState(
        session?.displayName || session?.sourceFileName || "",
    );
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsSubmitting(true);
        try {
            await onConfirm(newName.trim());
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentName = session?.displayName || session?.sourceFileName || "";

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-sm shadow-lg border border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-foreground">
                        Rename Session
                    </h2>
                    <button
                        onClick={onCancel}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Current Name
                        </label>
                        <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-slate-800 rounded p-2 mb-4">
                            {currentName}
                        </p>

                        <label className="block text-sm font-medium text-foreground mb-2">
                            New Name
                        </label>
                        <Input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Enter new session name"
                            className="h-10 bg-secondary dark:bg-slate-800"
                            autoFocus
                            disabled={isSubmitting}
                            maxLength={255}
                        />
                    </div>

                    <div className="flex gap-3 justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                !newName.trim() ||
                                newName === currentName ||
                                isSubmitting
                            }
                        >
                            {isSubmitting ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
