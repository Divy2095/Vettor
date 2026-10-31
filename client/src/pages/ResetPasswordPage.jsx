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

  // Extract recovery token from query parameters or URL hash fragment (Supabase redirect)
  const token = useMemo(() => {
    const fromQuery =
      searchParams.get("token") ||
      searchParams.get("token_hash") ||
      searchParams.get("code");
    if (fromQuery) return fromQuery;

    if (typeof window !== "undefined" && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const fromHash = hashParams.get("access_token") || hashParams.get("token");
      if (fromHash) return fromHash;
    }

    return "";
  }, [searchParams]);

  const email = useMemo(() => {
    const fromQuery = searchParams.get("email");
    if (fromQuery) return fromQuery;
    return "";
  }, [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const linkInvalid = !token;

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
        body: JSON.stringify({ email: email || undefined, token, password }),
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
                  : "Enter and confirm your new secure password."}
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {!linkInvalid ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 bg-surface-2 border-border font-mono text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9 bg-surface-2 border-border font-mono text-sm"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-mono text-xs font-bold uppercase tracking-wider py-5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  The recovery link must include a valid security token or OTP code.
                </p>
                <Link to="/auth?mode=login">
                  <Button
                    variant="outline"
                    className="w-full border-border font-mono text-xs uppercase"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-2" />
                    Return to Sign In
                  </Button>
                </Link>
              </div>
            )}

            <div className="pt-2 text-center">
              <Link
                to="/auth?mode=login"
                className="text-xs font-mono text-muted-foreground hover:text-accent inline-flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 border-t border-border text-center text-xs text-muted-foreground font-mono">
        VETTOR SECURE AUTH // RECOVERY PIPELINE
      </footer>
    </div>
  );
}
