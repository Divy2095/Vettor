/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-mono font-medium transition-colors border",
  {
    variants: {
      variant: {
        default:
          "border-border bg-surface-2 text-foreground",
        accent:
          "border-accent/30 bg-accent/10 text-accent",
        success:
          "border-success/30 bg-success/10 text-success",
        outline:
          "border-border text-muted-foreground",
        easy:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        medium:
          "border-amber-500/30 bg-amber-500/10 text-amber-400",
        hard:
          "border-rose-500/30 bg-rose-500/10 text-rose-400",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.25 text-[11px]",
        lg: "px-3 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Badge({ className, variant, size, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
