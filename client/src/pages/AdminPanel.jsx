import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BrainCircuit,
  ShieldCheck,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  LogOut,
  PlusCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ThemeToggle from "@/components/ThemeToggle";
import { authFetch, clearAuthSession, ensureSession, logoutSession } from "@/lib/auth";

const statusBadgeClass = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

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
      } catch (_error) {
        clearAuthSession();
        navigate("/login");
      }
    };

    bootstrapSession();
  }, [navigate]);

  const fetchJson = async (path, options = {}) => {
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
  };

  const loadDashboardData = async (query = "") => {
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
  };

  useEffect(() => {
    if (!token) return;
    loadDashboardData();
  }, [token]);

  const handleModerationAction = async (submissionId, action) => {
    setActionLoadingId(submissionId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const adminNote = window.prompt(
        action === "approve" ? "Optional admin note for approval" : "Optional rejection note",
        "",
      );

      await fetchJson(`/admin/moderation/submissions/${submissionId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ adminNote: adminNote || "" }),
      });

      await loadDashboardData(searchText.trim());
      setSuccessMessage(action === "approve" ? "Submission approved successfully." : "Submission rejected successfully.");
    } catch (error) {
      setErrorMessage(error.message || "Could not process moderation action");
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
      setSuccessMessage("Question added to dataset successfully.");
      await loadDashboardData(searchText.trim());
    } catch (error) {
      setErrorMessage(error.message || "Could not add question");
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
    <div className="min-h-screen bg-white dark:bg-slate-950 text-foreground font-sans">
      <div className="flex">
        <div className="flex-1">
          <nav className="sticky top-0 z-40 w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-border/40 dark:border-slate-700/40 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xl font-bold text-secondary-foreground tracking-tight">
              <BrainCircuit className="w-6 h-6 text-primary" />
              Interview Buddy Admin
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Signed in as {userName}</span>
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-md">
                {initials}
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-1" /> Logout
              </Button>
            </div>
          </nav>

          <main className="max-w-7xl mx-auto p-6 lg:p-8 mt-4 relative">
            <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-orange-400/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">Moderation Dashboard</h1>
                <p className="text-muted-foreground mt-1">Review user-contributed interview questions and publish to dataset.</p>
              </div>
              <form onSubmit={handleSearch} className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search pending submissions"
                  className="h-9 pl-9 bg-secondary dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700"
                />
              </form>
            </div>

            <div className="grid gap-6 md:grid-cols-4 mb-8 relative z-10">
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                </CardContent>
              </Card>
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-700">{stats.pendingSubmissions}</div>
                </CardContent>
              </Card>
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Approved</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700">{stats.approvedSubmissions}</div>
                </CardContent>
              </Card>
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Rejected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-700">{stats.rejectedSubmissions}</div>
                </CardContent>
              </Card>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                {successMessage}
              </div>
            )}

            <Card className="mb-8 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-sm relative z-10">
              <CardHeader className="border-b border-border/40 dark:border-slate-700/40 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-primary" /> Add Question To Dataset
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <form className="space-y-3" onSubmit={handleCreateQuestion}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Question</label>
                    <textarea
                      className="w-full min-h-[100px] rounded-md border border-input bg-secondary dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Enter a high-quality interview question"
                      value={adminQuestionForm.questionText}
                      onChange={handleCreateField("questionText")}
                      required
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tags (comma separated)</label>
                      <Input
                        placeholder="javascript, system-design"
                        value={adminQuestionForm.tags}
                        onChange={handleCreateField("tags")}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Company (optional)</label>
                      <Input
                        placeholder="Example: Meta"
                        value={adminQuestionForm.company}
                        onChange={handleCreateField("company")}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Seen in a real interview?</label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={adminQuestionForm.seenInInterview === "yes" ? "default" : "outline"}
                        onClick={() => setAdminQuestionForm((prev) => ({ ...prev, seenInInterview: "yes" }))}
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        variant={adminQuestionForm.seenInInterview === "no" ? "default" : "outline"}
                        onClick={() => setAdminQuestionForm((prev) => ({ ...prev, seenInInterview: "no" }))}
                      >
                        No
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" disabled={createQuestionLoading}>
                    {createQuestionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding...
                      </>
                    ) : (
                      "Add Question"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-sm relative z-10 overflow-hidden">
              <CardHeader className="border-b border-border/40 dark:border-slate-700/40 pb-4">
                <CardTitle>Pending Contributions ({pendingSubmissions.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {loading ? (
                  <div className="py-10 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading moderation queue...
                  </div>
                ) : pendingSubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending submissions.</p>
                ) : (
                  <div className="space-y-4">
                    {pendingSubmissions.map((submission) => (
                      <div key={submission._id} className="rounded-lg border border-border/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-700/90 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium leading-relaxed">{submission.questionText}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              <span className={`rounded-full px-2 py-1 uppercase ${statusBadgeClass[submission.status]}`}>
                                {submission.status}
                              </span>
                              {submission.company && (
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">
                                  Company: {submission.company}
                                </span>
                              )}
                              <span className="rounded-full bg-purple-100 px-2 py-1 text-purple-700">
                                Seen in interview: {submission.seenInInterview ? "Yes" : "No"}
                              </span>
                              <span className="text-muted-foreground">
                                By {submission.submittedBy?.fullName || "Unknown"} ({submission.submittedBy?.email || "N/A"})
                              </span>
                            </div>
                            {submission.tags?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {submission.tags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              disabled={actionLoadingId === submission._id}
                              onClick={() => handleModerationAction(submission._id, "approve")}
                            >
                              {actionLoadingId === submission._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actionLoadingId === submission._id}
                              onClick={() => handleModerationAction(submission._id, "reject")}
                            >
                              {actionLoadingId === submission._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4 mr-1" /> Reject
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-8 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-sm relative z-10 overflow-hidden">
              <CardHeader className="border-b border-border/40 dark:border-slate-700/40 pb-4">
                <CardTitle>Recently Reviewed ({reviewedSubmissions.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {reviewedSubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reviewed submissions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {reviewedSubmissions.map((submission) => (
                      <div key={submission._id} className="rounded-lg border border-border/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-700/90 p-3">
                        <p className="text-sm font-medium">{submission.questionText}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className={`rounded-full px-2 py-1 uppercase ${statusBadgeClass[submission.status]}`}>
                            {submission.status}
                          </span>
                          <span className="text-muted-foreground">
                            Reviewed by {submission.reviewedBy?.fullName || "Admin"}
                          </span>
                        </div>
                        {submission.adminNote && (
                          <p className="mt-2 text-xs text-muted-foreground">Note: {submission.adminNote}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}
