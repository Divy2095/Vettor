import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ShieldCheck,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  LogOut,
  PlusCircle,
  ArrowLeft,
  Users,
  Clock,
  Check,
  X,
  Layers,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ThemeToggle from "@/components/ThemeToggle";
import { authFetch, clearAuthSession, ensureSession, logoutSession } from "@/lib/auth";

export default function AdminPanel() {
  const navigate = useNavigate();

  const [token, setToken] = useState("");
  const [userName, setUserName] = useState("Admin");

  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingSubmissions: 0,
    approvedSubmissions: 0,
    rejectedSubmissions: 0,
  });
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [reviewedSubmissions, setReviewedSubmissions] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [createQuestionLoading, setCreateQuestionLoading] = useState(false);
  const [adminQuestionForm, setAdminQuestionForm] = useState({
    questionText: "",
    tags: "",
    company: "",
    seenInInterview: "no",
  });

  useEffect(() => {
    const bootstrapSession = async () => {
      const valid = await ensureSession();
      const accessToken = localStorage.getItem("accessToken");
      const rawUser = localStorage.getItem("authUser");

      if (!valid || !accessToken || !rawUser) {
        clearAuthSession();
        navigate("/login");
        return;
      }

      try {
        const parsedUser = JSON.parse(rawUser);
        if (parsedUser.role !== "admin") {
          navigate("/dashboard", {
            replace: true,
            state: {
              adminAccessDenied: true,
              message: "Only the admin account can access the admin dashboard.",
            },
          });
          return;
        }

        setUserName(parsedUser.fullName || "Admin");
        setToken(accessToken);
      } catch {
        clearAuthSession();
        navigate("/login");
      }
    };

    bootstrapSession();
  }, [navigate]);

  const fetchJson = useCallback(async (path, options = {}) => {
    const response = await authFetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      clearAuthSession();
      navigate("/login", {
        replace: true,
      });
      throw new Error("Unauthorized admin access");
    }

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }, [navigate]);

  const loadDashboardData = useCallback(async (query = "") => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [statsData, pendingData, reviewedData] = await Promise.all([
        fetchJson("/admin/moderation/stats"),
        fetchJson(`/admin/moderation/pending?search=${encodeURIComponent(query)}&limit=50`),
        fetchJson("/admin/moderation/reviewed?limit=10"),
      ]);

      setStats(statsData.stats || stats);
      setPendingSubmissions(pendingData.submissions || []);
      setReviewedSubmissions(reviewedData.submissions || []);
    } catch (error) {
      if (error.message === "AUTH_REQUIRED") {
        clearAuthSession();
        navigate("/login", { replace: true });
        return;
      }
      setErrorMessage(error.message || "Could not load admin dashboard data");
    } finally {
      setLoading(false);
    }
  }, [fetchJson, navigate, stats]);

  useEffect(() => {
    if (!token) return;
    loadDashboardData();
  }, [token, loadDashboardData]);

  const handleModerationAction = async (submissionId, action) => {
    setActionLoadingId(submissionId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const adminNote = window.prompt(
        action === "approve"
          ? "Optional note for approving submission:"
          : "Optional reason for rejection:",
        ""
      );

      await fetchJson(`/admin/moderation/submissions/${submissionId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ adminNote: adminNote || "" }),
      });

      await loadDashboardData(searchText.trim());
      setSuccessMessage(
        action === "approve"
          ? "Question approved and indexed."
          : "Submission marked as rejected."
      );
    } catch (error) {
      setErrorMessage(error.message || "Moderation request failed");
    } finally {
      setActionLoadingId("");
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    await loadDashboardData(searchText.trim());
  };

  const handleCreateField = (field) => (event) => {
    setAdminQuestionForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleCreateQuestion = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setCreateQuestionLoading(true);

    try {
      const payload = {
        questionText: adminQuestionForm.questionText.trim(),
        tags: adminQuestionForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        company: adminQuestionForm.company.trim(),
        seenInInterview: adminQuestionForm.seenInInterview === "yes",
      };

      await fetchJson("/admin/questions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setAdminQuestionForm({
        questionText: "",
        tags: "",
        company: "",
        seenInInterview: "no",
      });
      setSuccessMessage("Curated challenge published to global dataset.");
      await loadDashboardData(searchText.trim());
    } catch (error) {
      setErrorMessage(error.message || "Could not author challenge");
    } finally {
      setCreateQuestionLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutSession();
    navigate("/login");
  };

  const initials = useMemo(() => {
    if (!userName) return "AD";
    return userName
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [userName]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent/20">
      {/* Admin Nav */}
      <nav className="sticky top-0 z-40 w-full bg-surface-1 border-b border-border px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded bg-surface-2 border border-border flex items-center justify-center font-mono font-bold text-accent text-xs">
              V//
            </div>
            <span className="font-bold tracking-tight text-sm text-foreground">
              VETTOR
            </span>
          </Link>
          <div className="h-4 w-px bg-border" />
          <Badge variant="accent" size="sm">
            ADMIN CONSOLE
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/dashboard">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-mono border-border bg-surface-2 hover:bg-surface-2/80 text-foreground"
            >
              Candidate View
            </Button>
          </Link>
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <div className="h-7 w-7 rounded-full bg-surface-2 border border-border flex items-center justify-center font-mono text-[11px] font-bold text-accent">
              {initials}
            </div>
            <span className="hidden md:inline text-xs font-medium text-foreground">
              {userName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Admin Content */}
      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Moderation & Dataset Control
            </h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              Audit candidate contributions and manage verified technical challenges.
            </p>
          </div>

          <form onSubmit={handleSearch} className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search pending queue..."
              className="h-9 pl-9 bg-surface-1 border-border text-xs font-mono"
            />
          </form>
        </div>

        {/* Telemetry Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-surface-1">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              Registered Candidates
            </span>
            <p className="text-2xl font-bold font-mono text-foreground mt-1">
              {stats.totalUsers}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-surface-1">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              Pending Queue
            </span>
            <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {stats.pendingSubmissions}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-surface-1">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              Approved & Indexed
            </span>
            <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {stats.approvedSubmissions}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-surface-1">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              Rejected Submissions
            </span>
            <p className="text-2xl font-bold font-mono text-rose-400 mt-1">
              {stats.rejectedSubmissions}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs font-mono text-rose-400">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
            {successMessage}
          </div>
        )}

        {/* Author Question Card */}
        <Card className="border-border bg-surface-1">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-accent" />
              Direct Author Question to Platform
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-muted-foreground">
                  Challenge Text
                </label>
                <textarea
                  className="w-full min-h-[80px] rounded-lg border border-border bg-surface-2 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Enter a production-grade interview problem..."
                  value={adminQuestionForm.questionText}
                  onChange={handleCreateField("questionText")}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">
                    Tags (comma separated)
                  </label>
                  <Input
                    placeholder="go, raft, concurrency"
                    value={adminQuestionForm.tags}
                    onChange={handleCreateField("tags")}
                    className="h-9 bg-surface-2 border-border text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">
                    Company (optional)
                  </label>
                  <Input
                    placeholder="e.g. Stripe"
                    value={adminQuestionForm.company}
                    onChange={handleCreateField("company")}
                    className="h-9 bg-surface-2 border-border text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <span>Verified Screen:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAdminQuestionForm((prev) => ({
                        ...prev,
                        seenInInterview:
                          prev.seenInInterview === "yes" ? "no" : "yes",
                      }))
                    }
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      adminQuestionForm.seenInInterview === "yes"
                        ? "bg-accent text-background font-semibold"
                        : "bg-surface-2 text-muted-foreground"
                    }`}
                  >
                    {adminQuestionForm.seenInInterview === "yes" ? "Yes" : "No"}
                  </button>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={createQuestionLoading}
                  className="h-8 px-4 text-xs font-mono font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {createQuestionLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    "Publish Challenge"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Pending Moderation Queue */}
        <Card className="border-border bg-surface-1">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">
                Pending Moderation Queue ({pendingSubmissions.length})
              </CardTitle>
              <Badge variant="outline" size="sm">
                QUEUE
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="py-8 flex items-center justify-center text-xs font-mono text-muted-foreground">
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-accent" />
                Loading queue entries...
              </div>
            ) : pendingSubmissions.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground py-4 text-center">
                Moderation queue clear.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingSubmissions.map((sub) => (
                  <div
                    key={sub._id}
                    className="p-4 rounded-xl border border-border bg-surface-2/40 text-xs space-y-3"
                  >
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {sub.questionText}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
                      {sub.company && (
                        <span className="px-2 py-0.5 rounded bg-surface-1 border border-border text-foreground">
                          {sub.company}
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        Seen in interview: {sub.seenInInterview ? "Yes" : "No"}
                      </span>
                      <span className="text-muted-foreground">
                        • By: {sub.submittedBy?.fullName || "User"} (
                        {sub.submittedBy?.email || "N/A"})
                      </span>
                    </div>

                    {sub.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sub.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-mono text-muted-foreground"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-border/40 justify-end">
                      <Button
                        size="sm"
                        disabled={actionLoadingId === sub._id}
                        onClick={() => handleModerationAction(sub._id, "approve")}
                        className="h-7 text-xs font-mono bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      >
                        {actionLoadingId === sub._id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-3 h-3" /> Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionLoadingId === sub._id}
                        onClick={() => handleModerationAction(sub._id, "reject")}
                        className="h-7 text-xs font-mono gap-1"
                      >
                        {actionLoadingId === sub._id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <X className="w-3 h-3" /> Reject
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Reviewed */}
        <Card className="border-border bg-surface-1">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-bold">
              Recently Reviewed Submissions ({reviewedSubmissions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {reviewedSubmissions.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground py-4 text-center">
                No recent review records.
              </p>
            ) : (
              <div className="space-y-2">
                {reviewedSubmissions.map((sub) => (
                  <div
                    key={sub._id}
                    className="p-3 rounded-lg border border-border bg-surface-2/30 text-xs flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {sub.questionText}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        Reviewed by {sub.reviewedBy?.fullName || "Admin"}{" "}
                        {sub.adminNote && `• Note: ${sub.adminNote}`}
                      </p>
                    </div>
                    <Badge
                      variant={
                        sub.status === "approved" ? "success" : "destructive"
                      }
                      size="sm"
                    >
                      {sub.status.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
