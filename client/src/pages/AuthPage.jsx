import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ThemeToggle from "@/components/ThemeToggle";
import { fadeUp, getFadeUpWithDelay } from "@/lib/motion";
import { clearAuthSession, ensureSession, setAuthSession } from "@/lib/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

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
        navigate(parsedUser?.role === "admin" ? "/admin" : "/dashboard", { replace: true });
      } catch (_error) {
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

        setSuccessMessage(data.message || "Account created. You can sign in now.");
      }
    } catch (error) {
      setErrorMessage(error.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email.trim()) {
      setErrorMessage("Enter your email first, then click Forgot password.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const data = await callApi("/auth/forgot-password", {
        email: form.email.trim(),
      });
      setSuccessMessage(data.message || "Password reset instructions sent.");
    } catch (error) {
      setErrorMessage(error.message || "Could not start reset flow");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex">
      {/* Visual Asymmetric Left Side */}
      <motion.div
        className="hidden lg:flex w-[60%] relative flex-col justify-between p-12 overflow-hidden items-start bg-secondary dark:bg-secondary"
        initial="hidden"
        animate="visible"
        variants={fadeUp}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-purple-500/10 pointer-events-none" />
        <div className="absolute -left-[20%] -top-[20%] w-[140%] h-[140%] bg-primary/5 blur-[120px] rounded-full mix-blend-multiply" />
        
        <Link to="/" className="relative z-10 flex items-center gap-2 text-2xl font-bold tracking-tight text-secondary-foreground">
          <BrainCircuit className="w-8 h-8 text-primary" />
          Interview Buddy
        </Link>

        <div className="relative z-10 max-w-lg mb-12">
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            Uncover your technical blind spots before the recruiter does.
          </h2>
          <p className="text-lg text-muted-foreground">
            Join thousands of candidates who turned their rejections into offers. 
            The Digital Oracle prepares you for exactly what your dream company will ask.
          </p>
        </div>
      </motion.div>

      {/* Auth Form Right Side */}
      <motion.div
        className="w-full lg:w-[40%] flex items-center justify-center p-8 bg-white dark:bg-slate-900 relative"
        initial="hidden"
        animate="visible"
        variants={getFadeUpWithDelay(0.12)}
      >
        <div className="w-full max-w-md relative space-y-6">
          <div className="absolute -top-16 right-0">
            <ThemeToggle />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              {isLogin ? "Welcome back" : "Create an account"}
            </h1>
            <p className="text-base mt-2 text-muted-foreground">
              {isLogin ? "Enter your credentials to access your dashboard." : "Enter your details to generate your first set of questions."}
            </p>
          </div>
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Full Name</label>
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    required
                    className="h-12 bg-secondary dark:bg-slate-800"
                    value={form.fullName}
                    onChange={updateField("fullName")}
                    disabled={isSubmitting}
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  required
                  className="h-12 bg-secondary dark:bg-slate-800"
                  value={form.email}
                  onChange={updateField("email")}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  {isLogin && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={handleForgotPassword}
                      disabled={isSubmitting}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  required
                  className="h-12 bg-secondary dark:bg-slate-800"
                  value={form.password}
                  onChange={updateField("password")}
                  disabled={isSubmitting}
                />
              </div>
              {isLogin && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Remember me</label>
                  <select
                    className="h-12 w-full rounded-md border border-input bg-secondary px-3 text-sm dark:bg-slate-800"
                    value={form.sessionDays}
                    onChange={updateField("sessionDays")}
                    disabled={isSubmitting}
                  >
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                  </select>
                </div>
              )}
              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
              {successMessage && <p className="text-sm text-green-700">{successMessage}</p>}
              <Button
                type="submit"
                className="w-full h-12 mt-6 text-base tracking-wide rounded-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
              </Button>
            </form>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Link to={isLogin ? "/signup" : "/login"} className="text-primary font-medium hover:underline">
                {isLogin ? "Sign up" : "Sign in"}
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

