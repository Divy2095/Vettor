import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  Lock,
  Mail,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "@/components/ThemeToggle";
import { fadeUp } from "@/lib/motion";
import { clearAuthSession, ensureSession, setAuthSession } from "@/lib/auth";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export default function AuthPage({ type = "login" }) {
  const isLogin = type === "login";
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    sessionDays: "7",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const hydrateSession = async () => {
      const valid = await ensureSession();
      if (!valid) return;

      try {
        const storedUser = localStorage.getItem("authUser");
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        navigate(parsedUser?.role === "admin" ? "/admin" : "/dashboard", {
          replace: true,
        });
      } catch {
        clearAuthSession();
      }
    };

    hydrateSession();
  }, [navigate]);

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const callApi = async (path, payload) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const validationMessage = Array.isArray(data.errors)
        ? data.errors.map((item) => item.message).filter(Boolean).join(" ")
        : "";

      throw new Error(validationMessage || data.message || "Request failed");
    }

    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const data = await callApi("/auth/login", {
          email: form.email.trim(),
          password: form.password,
          sessionDays: Number(form.sessionDays),
        });

        setAuthSession({
          accessToken: data.accessToken,
          user: data.user,
          sessionDays: data.sessionDays,
        });
        navigate(data.user?.role === "admin" ? "/admin" : "/dashboard");
      } else {
        const data = await callApi("/auth/register", {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
        });

        setSuccessMessage(
          data.message || "Account registered. You may now sign in."
        );
      }
    } catch (error) {
      setErrorMessage(error.message || "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email.trim()) {
      setErrorMessage("Enter your email address first, then click Forgot Password.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const data = await callApi("/auth/forgot-password", {
        email: form.email.trim(),
      });
      setSuccessMessage(data.message || "Password recovery instructions sent.");
    } catch (error) {
      setErrorMessage(error.message || "Could not initiate password reset");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-accent/20">
      {/* Top Header */}
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

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="w-full max-w-md space-y-6"
        >
          {/* Card Box */}
          <div className="rounded-xl border border-border bg-surface-1 p-8 shadow-xl">
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-accent tracking-widest uppercase">
                  {isLogin ? "WORKSPACE ACCESS" : "NEW REGISTRATION"}
                </span>
                <Badge variant="outline" size="sm">
                  ACCOUNT
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {isLogin ? "Sign in to Vettor" : "Create candidate profile"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isLogin
                  ? "Enter your credentials to access your interview workspace."
                  : "Register to analyze resumes and practice technical challenges."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                    <Input
                      type="text"
                      placeholder="Jane Doe"
                      required
                      className="pl-9 h-10 bg-surface-2 border-border text-xs"
                      value={form.fullName}
                      onChange={updateField("fullName")}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    required
                    className="pl-9 h-10 bg-surface-2 border-border text-xs"
                    value={form.email}
                    onChange={updateField("email")}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground font-medium">
                    Password
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isSubmitting}
                      className="text-xs text-accent hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    required
                    className="pl-9 h-10 bg-surface-2 border-border text-xs font-mono"
                    value={form.password}
                    onChange={updateField("password")}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {isLogin && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Session Duration
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    value={form.sessionDays}
                    onChange={updateField("sessionDays")}
                    disabled={isSubmitting}
                  >
                    <option value="1">1 Day</option>
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                  </select>
                </div>
              )}

              {/* Feedback banners */}
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

              <Button
                type="submit"
                className="w-full h-10 mt-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : isLogin ? (
                  "Sign In to Workspace"
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border text-center text-xs text-muted-foreground">
              {isLogin ? (
                <>
                  New to Vettor?{" "}
                  <Link
                    to="/signup"
                    className="text-accent font-medium hover:underline ml-1"
                  >
                    Create an account
                  </Link>
                </>
              ) : (
                <>
                  Already registered?{" "}
                  <Link
                    to="/login"
                    className="text-accent font-medium hover:underline ml-1"
                  >
                    Sign in here
                  </Link>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-border text-center text-xs text-muted-foreground">
        Vettor • Resume Intelligence & Technical Interview Preparation
      </footer>
    </div>
  );
}
