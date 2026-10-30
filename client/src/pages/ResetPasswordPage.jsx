import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Lock, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const email = useMemo(() => searchParams.get("email") || "", [searchParams]);
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const linkInvalid = !email || !token;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (linkInvalid) {
      setErrorMessage("This recovery link is invalid or expired. Request a new password reset.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, token, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to update password");
      }

      setSuccessMessage(
        data.message || "Password updated successfully. You can now log in."
      );
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(error.message || "Failed to update password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-accent/20">
      <header className="px-6 py-5 flex items-center justify-between border-b border-border bg-surface-1/40">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-surface-2 border border-border flex items-center justify-center font-mono font-bold text-accent text-xs">
            V//
          </div>
          <span className="font-bold tracking-tight text-sm text-foreground">
            VETTOR
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-border bg-surface-1 p-8 shadow-xl space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-accent tracking-widest uppercase">
                  CREDENTIAL RECOVERY
                </span>
                <Badge variant="outline" size="sm">
                  RECOVERY
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Reset Account Password
              </h1>
              <p className="text-xs text-muted-foreground">
                {linkInvalid
                  ? "Security token missing or invalid."
                  : `Target account: ${email}`}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    type="password"
                    placeholder="Enter new strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting || linkInvalid}
                    required
                    className="pl-9 h-10 bg-surface-2 border-border text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting || linkInvalid}
                    required
                    className="pl-9 h-10 bg-surface-2 border-border text-xs font-mono"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || linkInvalid}
                  className="w-full h-10 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Save New Password"
                  )}
                </Button>

                <Link to="/login" className="w-full">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>

      <footer className="py-4 border-t border-border text-center text-xs text-muted-foreground">
        Vettor • Resume Intelligence & Technical Interview Preparation
      </footer>
    </div>
  );
}
