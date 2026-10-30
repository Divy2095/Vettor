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
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface-1 rounded-xl p-6 w-full max-w-sm shadow-2xl border border-border">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <span className="font-mono text-[10px] text-accent uppercase tracking-wider">
                            TRACK METADATA
                        </span>
                        <h2 className="text-base font-bold text-foreground">
                            Rename Session
                        </h2>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-1 hover:bg-surface-2 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-mono text-muted-foreground mb-1">
                            Current Identifier
                        </label>
                        <p className="text-xs text-foreground bg-surface-2 rounded-md p-2.5 mb-3 border border-border/60 truncate">
                            {currentName}
                        </p>

                        <label className="block text-xs font-mono text-muted-foreground mb-1">
                            New Identifier
                        </label>
                        <Input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g. Staff Distributed Systems Track"
                            className="h-9 bg-surface-2 border-border text-xs font-sans"
                            autoFocus
                            disabled={isSubmitting}
                            maxLength={255}
                        />
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
                            type="submit"
                            size="sm"
                            disabled={
                                !newName.trim() ||
                                newName === currentName ||
                                isSubmitting
                            }
                            className="text-xs font-mono font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
