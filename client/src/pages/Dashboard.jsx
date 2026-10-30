import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Cpu,
  UploadCloud,
  Loader2,
  LogOut,
  ShieldCheck,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Target,
  ChevronRight,
  FolderOpen,
  Layers,
  Search,
  Filter,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import DuplicateSessionModal from "@/components/DuplicateSessionModal";
import ThemeToggle from "@/components/ThemeToggle";
import SessionSidebar from "@/components/SessionSidebar";
import { authFetch, clearAuthSession, ensureSession } from "@/lib/auth";
import { useSession } from "@/lib/sessionManager";

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const resumeInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [resumeLoaded, setResumeLoaded] = useState(false);
  const [resumeFileName, setResumeFileName] = useState("");
  const [extractedSkills, setExtractedSkills] = useState([]);
  const [resumeError, setResumeError] = useState("");
  const [resumeSuccess, setResumeSuccess] = useState("");
  const [resumeFileRef, setResumeFileRef] = useState(null);

  // Target customization
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");

  // Practice state
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceFeedback, setPracticeFeedback] = useState(null);

  // Submissions state
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [submissionError, setSubmissionError] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState("");
  const [contributionForm, setContributionForm] = useState({
    questionText: "",
    tags: "",
    company: "",
    seenInInterview: "no",
  });

  // Duplicate prompt
  const [duplicateSessionPrompt, setDuplicateSessionPrompt] = useState(null);

  // ML Pipeline state
  const [mlQuestions, setMlQuestions] = useState(null);
  const [mlQuestionsLoading, setMlQuestionsLoading] = useState(false);
  const [mlQuestionsError, setMlQuestionsError] = useState("");
  const [selectedMlQuestion, setSelectedMlQuestion] = useState(null);
  const [returnedQuestionIds, setReturnedQuestionIds] = useState(new Set());

  // Application Navigation & Mobile Drawer
  const [activeTab, setActiveTab] = useState("workspace"); // "workspace" | "questions" | "practice" | "community"
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [questionSearch, setQuestionSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");

  // Multi-session support
  const {
    sessions,
    activeSessionId,
    activeSession,
    isLoadingSessions,
    switchSession,
    deleteSession,
    renameSession,
    addSession,
    getSessionQuestionIndex,
    clearSessionStorage,
  } = useSession();

  const currentQuestionIndex = getSessionQuestionIndex();
  const currentQuestion =
    activeSession?.generatedQuestions?.[currentQuestionIndex] || null;

  // Sync tab with URL search parameter & history
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get("tab");
    if (
      tabParam &&
      ["workspace", "questions", "practice", "community"].includes(
        tabParam.toLowerCase()
      )
    ) {
      setActiveTab(tabParam.toLowerCase());
    } else if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.search, location.state]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    const searchParams = new URLSearchParams(location.search);
    searchParams.set("tab", tabId);
    navigate({ search: searchParams.toString() }, { replace: true });
  };

  const handleAuthFailure = useCallback(
    (error) => {
      if (error?.message !== "AUTH_REQUIRED") return false;
      clearAuthSession();
      navigate("/login", { replace: true });
      return true;
    },
    [navigate]
  );

  useEffect(() => {
    const bootstrapSession = async () => {
      const valid = await ensureSession();
      const authUser = localStorage.getItem("authUser");
      const accessToken = localStorage.getItem("accessToken");

      if (!valid || !authUser || !accessToken) {
        clearAuthSession();
        navigate("/login");
        return;
      }

      try {
        const parsedUser = JSON.parse(authUser);
        if (parsedUser.role === "admin") {
          navigate("/admin", { replace: true });
          return;
        }
        setUser(parsedUser);
        setToken(accessToken);
      } catch (error) {
        console.error("Failed to parse user data", error);
        clearAuthSession();
        navigate("/login");
      }
    };

    bootstrapSession();
  }, [navigate]);

  const fetchMySubmissions = useCallback(async () => {
    try {
      const response = await authFetch("/questions/submissions/me");
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not fetch your submissions");
      }

      setSubmissions(data.submissions || []);
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setSubmissionError(
        error.message || "Could not load your submissions"
      );
    }
  }, [handleAuthFailure]);

  useEffect(() => {
    if (!token) return;
    fetchMySubmissions();
  }, [token, fetchMySubmissions]);

  const handleLogout = async () => {
    clearSessionStorage();
    clearAuthSession();
    navigate("/login");
  };

  const handleContributionField = (field) => (event) => {
    setContributionForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleContributionSubmit = async (event) => {
    event.preventDefault();
    setSubmissionError("");
    setSubmissionSuccess("");
    setSubmissionLoading(true);

    try {
      const payload = {
        questionText: contributionForm.questionText.trim(),
        tags: contributionForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        company: contributionForm.company.trim(),
        seenInInterview: contributionForm.seenInInterview === "yes",
      };

      const response = await authFetch("/questions/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not submit question");
      }

      setSubmissionSuccess(
        data.message || "Question submitted for administrator audit."
      );
      setContributionForm({
        questionText: "",
        tags: "",
        company: "",
        seenInInterview: "no",
      });
      await fetchMySubmissions();
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setSubmissionError(error.message || "Could not submit question");
    } finally {
      setSubmissionLoading(false);
    }
  };

  const getUserInitials = (fullName) => {
    if (!fullName) return "U";
    return fullName
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleUploadClick = () => {
    resumeInputRef.current?.click();
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!token) {
      setResumeError("Session expired. Please sign in again.");
      event.target.value = "";
      return;
    }

    if (file.type !== "application/pdf") {
      setResumeError("Only PDF format resumes are accepted.");
      event.target.value = "";
      return;
    }

    setResumeError("");
    setResumeSuccess("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await authFetch("/questions/resume/skills", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to analyze resume.");
      }

      setResumeFileName(data.fileName || file.name);
      setExtractedSkills(data.skills || []);
      setResumeSuccess(data.message || "Resume skills extracted successfully.");
      setIsUploading(false);
      setResumeLoaded(true);
      setResumeFileRef(file);
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setIsUploading(false);
      setResumeLoaded(false);
      setResumeError(error.message || "Resume parsing failed.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSelectHistorySession = async (sessionId) => {
    await switchSession(sessionId);
    setPracticeAnswer("");
    setPracticeFeedback(null);
  };

  // ── Run FAISS Semantic Retrieval ──
  const handleFetchMLQuestions = async () => {
    if (!resumeFileRef && !resumeLoaded) return;

    setMlQuestionsLoading(true);
    setMlQuestionsError("");
    setMlQuestions(null);
    setReturnedQuestionIds(new Set());

    try {
      const formData = new FormData();
      if (resumeFileRef) {
        formData.append("resume", resumeFileRef);
      }

      const response = await authFetch("/ml/process-resume", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Semantic retrieval pipeline failed"
        );
      }

      const grouped = {};
      (data.questions || []).forEach((q) => {
        const topic = q.topic || "General Systems";
        if (!grouped[topic]) grouped[topic] = [];
        grouped[topic].push(q);
      });

      const results = Object.entries(grouped).map(([topic, qs]) => ({
        skill: topic,
        matchedCount: qs.length,
        questions: qs,
      }));

      setMlQuestions({
        message: data.message || `Indexed ${data.totalQuestions} relevant challenges`,
        totalQuestions: data.totalQuestions || 0,
        results,
        skills: data.skills || {},
        processingTimeMs: data.processingTimeMs || 0,
        sessionId: data.sessionId,
      });

      if (data.skills?.raw?.length) {
        setExtractedSkills(data.skills.raw);
      }

      const allQuestionIds = new Set();
      results.forEach((skillGroup) => {
        (skillGroup.questions || []).forEach((q) => {
          allQuestionIds.add(q.question);
        });
      });
      setReturnedQuestionIds(allQuestionIds);

      // Save questions to session
      if (results.length > 0) {
        const flattenedQuestions = [];
        results.forEach((skillGroup) => {
          (skillGroup.questions || []).forEach((q) => {
            flattenedQuestions.push({
              question: q.question,
              topic: q.topic || "General",
              difficulty: q.difficulty || "Medium",
            });
          });
        });

        if (flattenedQuestions.length > 0) {
          try {
            if (activeSessionId) {
              await authFetch("/ml/save-questions-to-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sessionId: activeSessionId,
                  questions: flattenedQuestions,
                }),
              });
            } else {
              const createResp = await authFetch("/ml/create-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  targetRole: targetRole || "Software Engineer",
                  targetCompany: targetCompany || "Tech",
                  targetLevel: "mid",
                  targetDomain: "Engineering",
                  sourceFileName: resumeFileName,
                  resumeSkills: extractedSkills,
                  mlQuestions: flattenedQuestions,
                }),
              });

              if (createResp.ok) {
                const createData = await createResp.json().catch(() => ({}));
                if (createData?.session) {
                  addSession(createData.session);
                }
              }
            }
          } catch (saveError) {
            console.warn("Could not sync questions to session:", saveError);
          }
        }
      }
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setMlQuestionsError(error.message || "Semantic retrieval pipeline failed");
    } finally {
      setMlQuestionsLoading(false);
    }
  };

  const handleGenerateMoreQuestions = async () => {
    if (!extractedSkills.length) return;

    setMlQuestionsLoading(true);
    setMlQuestionsError("");

    try {
      const response = await authFetch("/ml/questions-by-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills: extractedSkills,
          maxPerSkill: 5,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to retrieve more questions");
      }

      const newResults = (data.results || []).map((skillGroup) => ({
        ...skillGroup,
        questions: (skillGroup.questions || []).filter(
          (q) => !returnedQuestionIds.has(q.question)
        ),
      }));

      const mergedResults = (mlQuestions?.results || []).map((existing) => {
        const newSkillData = newResults.find((n) => n.skill === existing.skill);
        if (newSkillData) {
          return {
            ...existing,
            questions: [...existing.questions, ...newSkillData.questions],
            matchedCount: existing.matchedCount + newSkillData.matchedCount,
          };
        }
        return existing;
      });

      newResults.forEach((newSkill) => {
        if (!mergedResults.find((m) => m.skill === newSkill.skill)) {
          mergedResults.push(newSkill);
        }
      });

      setMlQuestions({
        ...data,
        results: mergedResults,
        totalQuestions: (mlQuestions?.totalQuestions || 0) + data.totalQuestions,
      });

      const updatedIds = new Set(returnedQuestionIds);
      mergedResults.forEach((skillGroup) => {
        (skillGroup.questions || []).forEach((q) => {
          updatedIds.add(q.question);
        });
      });
      setReturnedQuestionIds(updatedIds);
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setMlQuestionsError(error.message || "Failed to retrieve more questions");
    } finally {
      setMlQuestionsLoading(false);
    }
  };

  const handlePracticeSubmit = async (event) => {
    event.preventDefault();

    const questionToUse = selectedMlQuestion || currentQuestion;

    if (!questionToUse) {
      setSubmissionError("Select a question to submit answer for rubric evaluation.");
      return;
    }

    setPracticeLoading(true);
    setSubmissionError("");

    try {
      const questionText = selectedMlQuestion
        ? selectedMlQuestion.question
        : currentQuestion.questionText;

      const response = await authFetch("/questions/practice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionText: questionText,
          answerText: practiceAnswer.trim(),
          generationSessionId: activeSessionId || null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not analyze answer");
      }

      setPracticeFeedback(data.attempt);
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setSubmissionError(error.message || "Could not evaluate answer");
    } finally {
      setPracticeLoading(false);
    }
  };

  const handleAddSession = async () => {
    try {
      const resp = await authFetch("/questions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceFileName: resumeFileName,
          resumeSkills: extractedSkills,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.message || "Could not create session");
      }

      if (data.session) {
        addSession(data.session);
      }
    } catch (error) {
      if (handleAuthFailure(error)) return;
      console.error("Could not create session:", error);
    }
  };

  const getDifficultyBadgeVariant = (difficulty) => {
    const d = (difficulty || "").toLowerCase();
    if (d === "easy") return "easy";
    if (d === "medium") return "medium";
    if (d === "hard") return "hard";
    return "default";
  };

  // Compile full available questions list across mlQuestions and activeSession
  const availableQuestions = useMemo(() => {
    if (mlQuestions?.results?.length > 0) {
      return mlQuestions.results.flatMap((group) => group.questions);
    }
    if (activeSession?.generatedQuestions?.length > 0) {
      return activeSession.generatedQuestions.map((q, idx) => ({
        question: q.questionText || q.question,
        topic: q.topic || "General Systems",
        difficulty: q.difficulty || "Medium",
        tags: q.tags || [],
        final_score: q.final_score || q.score || 0,
        sr_no: idx + 1,
      }));
    }
    return [];
  }, [mlQuestions, activeSession]);

  // Filtered questions for the Questions Tab
  const filteredQuestions = useMemo(() => {
    return availableQuestions.filter((q) => {
      const matchesDifficulty =
        difficultyFilter === "all" ||
        (q.difficulty || "").toLowerCase() === difficultyFilter.toLowerCase();

      const qText = (q.question || "").toLowerCase();
      const topicText = (q.topic || "").toLowerCase();
      const tagsText = (q.tags || []).join(" ").toLowerCase();
      const query = questionSearch.trim().toLowerCase();

      const matchesSearch =
        !query ||
        qText.includes(query) ||
        topicText.includes(query) ||
        tagsText.includes(query);

      return matchesDifficulty && matchesSearch;
    });
  }, [availableQuestions, difficultyFilter, questionSearch]);

  const selectQuestionForPractice = (q) => {
    setSelectedMlQuestion(q);
    handleTabChange("practice");
    setPracticeAnswer("");
    setPracticeFeedback(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col selection:bg-accent/20">
      {/* ── Top Navigation Bar ── */}
      <nav className="sticky top-0 z-40 w-full bg-surface-1/95 backdrop-blur-md border-b border-border px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Mobile Session Drawer Trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="md:hidden h-8 px-2.5 text-xs font-mono gap-1.5 border-border bg-surface-2 hover:bg-surface-2/80 text-foreground"
            aria-label="Open session tracks drawer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-accent" />
            <span className="hidden xs:inline">Tracks</span>
            <span className="px-1.5 py-0.2 rounded bg-surface-1 border border-border text-[10px] text-muted-foreground">
              {sessions.length}
            </span>
          </Button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="h-7 w-7 rounded bg-surface-2 border border-border flex items-center justify-center font-mono font-bold text-accent text-xs group-hover:border-accent/50 transition-colors">
              V//
            </div>
            <span className="font-bold tracking-tight text-sm text-foreground">
              VETTOR
            </span>
          </Link>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Desktop Segmented Tab Switcher */}
          <div
            role="tablist"
            aria-label="Workspace Sections"
            className="hidden sm:flex items-center p-1 rounded-lg bg-surface-2/70 border border-border/80 text-xs font-mono"
          >
            <button
              role="tab"
              aria-selected={activeTab === "workspace"}
              onClick={() => handleTabChange("workspace")}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "workspace"
                  ? "bg-surface-1 text-foreground font-semibold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-accent" />
              <span>Workspace</span>
            </button>

            <button
              role="tab"
              aria-selected={activeTab === "questions"}
              onClick={() => handleTabChange("questions")}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "questions"
                  ? "bg-surface-1 text-foreground font-semibold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-accent" />
              <span>Questions</span>
              {availableQuestions.length > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-surface-2 text-[10px] text-muted-foreground">
                  {availableQuestions.length}
                </span>
              )}
            </button>

            <button
              role="tab"
              aria-selected={activeTab === "practice"}
              onClick={() => handleTabChange("practice")}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "practice"
                  ? "bg-surface-1 text-foreground font-semibold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              <Target className="w-3.5 h-3.5 text-accent" />
              <span>Practice</span>
            </button>

            <button
              role="tab"
              aria-selected={activeTab === "community"}
              onClick={() => handleTabChange("community")}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "community"
                  ? "bg-surface-1 text-foreground font-semibold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Community</span>
            </button>
          </div>
        </div>

        {/* User & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {user?.role === "admin" && (
            <Link to="/admin">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-mono gap-1.5 border-border bg-surface-2 hover:bg-surface-2/80 text-foreground"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                <span className="hidden sm:inline">Admin Panel</span>
              </Button>
            </Link>
          )}

          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <div className="h-7 w-7 rounded-full bg-surface-2 border border-border flex items-center justify-center font-mono text-[11px] font-bold text-accent">
              {user ? getUserInitials(user.fullName) : "U"}
            </div>
            <span className="hidden lg:inline text-xs font-medium text-foreground truncate max-w-[120px]">
              {user?.fullName || "Candidate"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Mobile Tab Navigation Sub-Bar (No Hidden Tabs on Mobile) ── */}
      <div
        role="tablist"
        aria-label="Mobile Navigation"
        className="sm:hidden sticky top-16 z-30 flex items-center justify-around border-b border-border bg-surface-1/95 backdrop-blur-md px-2 py-1.5 text-xs font-mono"
      >
        <button
          role="tab"
          aria-selected={activeTab === "workspace"}
          onClick={() => handleTabChange("workspace")}
          className={`flex-1 py-1.5 px-1 text-center rounded-md transition-all ${
            activeTab === "workspace"
              ? "bg-surface-2 text-foreground font-semibold border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Workspace
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "questions"}
          onClick={() => handleTabChange("questions")}
          className={`flex-1 py-1.5 px-1 text-center rounded-md transition-all flex items-center justify-center gap-1 ${
            activeTab === "questions"
              ? "bg-surface-2 text-foreground font-semibold border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Questions</span>
          {availableQuestions.length > 0 && (
            <span className="text-[10px] text-accent font-semibold">
              ({availableQuestions.length})
            </span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "practice"}
          onClick={() => handleTabChange("practice")}
          className={`flex-1 py-1.5 px-1 text-center rounded-md transition-all ${
            activeTab === "practice"
              ? "bg-surface-2 text-foreground font-semibold border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Practice
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "community"}
          onClick={() => handleTabChange("community")}
          className={`flex-1 py-1.5 px-1 text-center rounded-md transition-all ${
            activeTab === "community"
              ? "bg-surface-2 text-foreground font-semibold border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Community
        </button>
      </div>

      {/* ── Main Layout (Sidebar + Content) ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Session Sidebar (Desktop persistent + Mobile slide-over drawer) */}
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          activeQuestionIndex={currentQuestionIndex}
          onSelectSession={handleSelectHistorySession}
          onDeleteSession={deleteSession}
          onRenameSession={renameSession}
          onAddSession={handleAddSession}
          isLoading={isLoadingSessions}
          isMobileOpen={isMobileDrawerOpen}
          onCloseMobile={() => setIsMobileDrawerOpen(false)}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {location.state?.adminAccessDenied && (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs font-mono text-amber-400">
                {location.state.message || "Admin privilege required."}
              </div>
            )}

            {/* ════════════════════ TAB 1: WORKSPACE ════════════════════ */}
            {activeTab === "workspace" && (
              <div className="space-y-6">
                {/* Resume Upload Card */}
                <Card className="border-border bg-surface-1">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="font-mono text-[10px] text-accent uppercase tracking-widest font-semibold">
                          INGESTION MODULE
                        </span>
                        <CardTitle className="text-xl font-bold">
                          Resume Profile & Skills Extraction
                        </CardTitle>
                      </div>
                      <Badge variant="outline">PDF PARSER</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Upload your technical resume to extract architectural depth, technologies, and generate grounded interview challenges.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Target Configuration */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                      <div className="space-y-1">
                        <label className="text-[11px] font-mono text-muted-foreground">
                          Target Role (optional)
                        </label>
                        <Input
                          placeholder="e.g. Staff Distributed Systems Engineer"
                          value={targetRole}
                          onChange={(e) => setTargetRole(e.target.value)}
                          className="h-8 bg-surface-2 border-border text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-mono text-muted-foreground">
                          Target Company (optional)
                        </label>
                        <Input
                          placeholder="e.g. Google, Stripe, Datadog"
                          value={targetCompany}
                          onChange={(e) => setTargetCompany(e.target.value)}
                          className="h-8 bg-surface-2 border-border text-xs"
                        />
                      </div>
                    </div>

                    <input
                      ref={resumeInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleUpload}
                    />

                    {!resumeLoaded ? (
                      <div
                        onClick={handleUploadClick}
                        className="border border-dashed border-border hover:border-accent/60 bg-surface-2/40 hover:bg-surface-2/70 rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group"
                      >
                        {isUploading ? (
                          <Loader2 className="w-8 h-8 text-accent animate-spin" />
                        ) : (
                          <UploadCloud className="w-8 h-8 text-muted-foreground group-hover:text-accent transition-colors" />
                        )}
                        <div className="text-center font-mono">
                          <p className="text-xs font-medium text-foreground">
                            {isUploading
                              ? "Extracting entities & competencies..."
                              : "Click to upload resume (PDF, max 5MB)"}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Parses production technologies, roles, and project scale markers
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="border border-border bg-surface-2/50 rounded-xl p-4 flex items-center justify-between gap-4 font-mono text-xs">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <FileCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground truncate max-w-sm">
                              {resumeFileName || "uploaded_resume.pdf"}
                            </p>
                            <p className="text-[11px] text-emerald-400">
                              Parsed & Indexed Successfully
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setResumeLoaded(false);
                            setResumeFileName("");
                            setExtractedSkills([]);
                            setResumeSuccess("");
                            setResumeError("");
                            setMlQuestions(null);
                            setResumeFileRef(null);
                          }}
                          className="text-xs text-muted-foreground hover:text-rose-400"
                        >
                          Replace File
                        </Button>
                      </div>
                    )}

                    {resumeError && (
                      <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-start gap-2 text-xs text-rose-400 font-mono">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{resumeError}</span>
                      </div>
                    )}

                    {resumeSuccess && (
                      <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 text-xs text-emerald-400 font-mono">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{resumeSuccess}</span>
                      </div>
                    )}

                    {/* Extracted Skills List */}
                    {resumeLoaded && extractedSkills.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-xs text-muted-foreground uppercase font-semibold">
                            Dissected Technical Competencies ({extractedSkills.length})
                          </p>
                          <span className="text-[10px] font-mono text-accent">
                            FAISS Ready
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {extractedSkills.map((skill) => (
                            <span
                              key={skill}
                              className="px-2.5 py-1 rounded bg-surface-2 border border-border text-xs font-mono text-foreground"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Run ML Pipeline Action */}
                    {resumeLoaded && extractedSkills.length > 0 && (
                      <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs text-muted-foreground font-mono">
                          Trigger FAISS vector retrieval across indexed senior engineering questions.
                        </div>
                        <Button
                          onClick={handleFetchMLQuestions}
                          disabled={mlQuestionsLoading}
                          className="w-full sm:w-auto h-10 px-5 text-xs font-mono font-medium tracking-tight bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {mlQuestionsLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Running FAISS Pipeline...
                            </>
                          ) : (
                            <>
                              <Cpu className="w-4 h-4 mr-2" />
                              Execute Vector Retrieval
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {mlQuestionsError && (
                      <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-mono">
                        {mlQuestionsError}
                      </div>
                    )}

                    {/* Notice if questions already available */}
                    {availableQuestions.length > 0 && (
                      <div className="p-4 rounded-xl border border-accent/30 bg-surface-2/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="space-y-0.5 font-mono text-xs">
                          <span className="text-accent font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            {availableQuestions.length} Questions Indexed for this Profile
                          </span>
                          <p className="text-muted-foreground text-[11px]">
                            Ready for exploration and rubric-based practice.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleTabChange("questions")}
                          className="text-xs font-mono gap-1.5 bg-primary text-primary-foreground"
                        >
                          View Question Bank
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ════════════════════ TAB 2: QUESTIONS ════════════════════ */}
            {activeTab === "questions" && (
              <div className="space-y-6">
                <Card className="border-border bg-surface-1">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="font-mono text-[10px] text-accent uppercase tracking-widest font-semibold">
                          CHALLENGE BANK
                        </span>
                        <CardTitle className="text-xl font-bold">
                          Matched Technical Challenges ({availableQuestions.length})
                        </CardTitle>
                        <CardDescription className="text-xs font-mono">
                          Questions retrieved via FAISS vector proximity. Select any challenge to begin structured practice.
                        </CardDescription>
                      </div>

                      {extractedSkills.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateMoreQuestions}
                          disabled={mlQuestionsLoading}
                          className="text-xs font-mono gap-1.5 border-border bg-surface-2 hover:bg-surface-2/80 text-foreground self-start sm:self-center"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-accent" />
                          Expand Bank
                        </Button>
                      )}
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      {/* Search */}
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Filter challenges by keyword or topic..."
                          value={questionSearch}
                          onChange={(e) => setQuestionSearch(e.target.value)}
                          className="h-9 pl-9 bg-surface-2 border-border text-xs font-mono"
                        />
                      </div>

                      {/* Difficulty filter buttons */}
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        <span className="text-muted-foreground text-[11px] mr-1 hidden sm:inline">
                          Level:
                        </span>
                        {["all", "easy", "medium", "hard"].map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => setDifficultyFilter(lvl)}
                            className={`px-2.5 py-1 rounded text-xs capitalize transition-all ${
                              difficultyFilter === lvl
                                ? "bg-accent text-background font-semibold"
                                : "bg-surface-2 text-muted-foreground hover:text-foreground border border-border"
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {filteredQuestions.length === 0 ? (
                      <div className="p-8 text-center space-y-3 font-mono text-xs border border-dashed border-border rounded-xl">
                        <Cpu className="w-8 h-8 text-muted-foreground mx-auto" />
                        {availableQuestions.length === 0 ? (
                          <>
                            <p className="text-foreground font-medium">
                              No questions indexed for the current session.
                            </p>
                            <p className="text-muted-foreground text-[11px] max-w-sm mx-auto">
                              Upload a resume in the Workspace to trigger FAISS vector matching.
                            </p>
                            <Button
                              size="sm"
                              onClick={() => handleTabChange("workspace")}
                              className="text-xs font-mono mt-2"
                            >
                              Go to Workspace
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="text-foreground font-medium">
                              No challenges match your filter.
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setQuestionSearch("");
                                setDifficultyFilter("all");
                              }}
                              className="text-xs font-mono"
                            >
                              Reset Filters
                            </Button>
                          </>
                        )}
                      </div>
                    ) : (
                      filteredQuestions.map((q, idx) => {
                        const isSelected =
                          selectedMlQuestion?.question === q.question;
                        return (
                          <div
                            key={idx}
                            className={`rounded-lg border p-4 transition-all ${
                              isSelected
                                ? "border-accent bg-surface-2 shadow-sm"
                                : "border-border/70 bg-surface-2/40 hover:border-border hover:bg-surface-2/70"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2 flex-1">
                                <p className="text-sm font-medium text-foreground leading-relaxed">
                                  {q.question}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  {q.topic && (
                                    <Badge variant="default" size="sm">
                                      {q.topic}
                                    </Badge>
                                  )}
                                  {q.difficulty && (
                                    <Badge
                                      variant={getDifficultyBadgeVariant(
                                        q.difficulty
                                      )}
                                      size="sm"
                                    >
                                      {q.difficulty}
                                    </Badge>
                                  )}
                                  {(q.final_score || q.score) > 0 && (
                                    <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                      Match: {(((q.final_score || q.score)) * 100).toFixed(0)}%
                                    </span>
                                  )}
                                  {(q.tags || [])
                                    .filter(Boolean)
                                    .map((t, ti) => (
                                      <span
                                        key={ti}
                                        className="text-[10px] font-mono text-muted-foreground"
                                      >
                                        #{t}
                                      </span>
                                    ))}
                                </div>
                              </div>

                              <Button
                                size="sm"
                                onClick={() => selectQuestionForPractice(q)}
                                className="shrink-0 text-xs font-mono gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                Practice
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ════════════════════ TAB 3: PRACTICE ════════════════════ */}
            {activeTab === "practice" && (
              <div className="space-y-6">
                <Card className="border-border bg-surface-1">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="font-mono text-[10px] text-accent uppercase tracking-widest font-semibold">
                          EVALUATION ENGINE
                        </span>
                        <CardTitle className="text-xl font-bold">
                          Rubric-Grounded Answer Practice
                        </CardTitle>
                      </div>
                      <Badge variant="accent">AI RUBRIC</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Submit your technical solution or situational narrative. The rubric evaluates trade-off clarity, architecture correctness, and problem relevance.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Active Question Display */}
                    {selectedMlQuestion || currentQuestion ? (
                      <div className="rounded-xl border border-border bg-surface-2/60 p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                          <span>ACTIVE TARGET CHALLENGE</span>
                          <Badge
                            variant={getDifficultyBadgeVariant(
                              selectedMlQuestion?.difficulty ||
                                currentQuestion?.difficulty
                            )}
                            size="sm"
                          >
                            {selectedMlQuestion?.difficulty ||
                              currentQuestion?.difficulty ||
                              "Medium"}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground leading-relaxed">
                          {selectedMlQuestion
                            ? selectedMlQuestion.question
                            : currentQuestion.questionText}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs font-mono text-muted-foreground space-y-2">
                        <p>No challenge selected yet.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTabChange("questions")}
                          className="text-xs font-mono"
                        >
                          Select Challenge from Bank
                        </Button>
                      </div>
                    )}

                    {/* Answer Form */}
                    <form onSubmit={handlePracticeSubmit} className="space-y-3">
                      <textarea
                        className="w-full min-h-[180px] rounded-lg border border-border bg-surface-2 p-3 text-xs font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent leading-relaxed"
                        placeholder="Structure your answer using technical context: architecture decisions, trade-offs (e.g. latency vs consistency), edge-case handling, and measured results..."
                        value={practiceAnswer}
                        onChange={(e) => setPracticeAnswer(e.target.value)}
                        disabled={practiceLoading}
                      />

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {practiceAnswer.length} characters
                        </span>
                        <Button
                          type="submit"
                          disabled={practiceLoading || !practiceAnswer.trim()}
                          className="h-9 px-5 text-xs font-mono font-medium tracking-tight bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {practiceLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                              Evaluating Rubrics...
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5 mr-2" />
                              Submit for Evaluation
                            </>
                          )}
                        </Button>
                      </div>
                    </form>

                    {/* Practice Feedback Display */}
                    {practiceFeedback && (
                      <div className="mt-6 rounded-xl border border-border bg-surface-2/40 p-5 space-y-5">
                        <div className="flex items-center justify-between border-b border-border/60 pb-3">
                          <div>
                            <span className="font-mono text-[10px] text-accent uppercase font-semibold">
                              EVALUATION REPORT
                            </span>
                            <h3 className="text-base font-bold text-foreground">
                              Rubric Assessment
                            </h3>
                          </div>
                          <div className="font-mono text-right">
                            <span className="text-2xl font-bold text-accent">
                              {practiceFeedback.overallScore}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              /10
                            </span>
                          </div>
                        </div>

                        {practiceFeedback.feedbackSummary && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {practiceFeedback.feedbackSummary}
                          </p>
                        )}

                        {/* Rubric metrics grid */}
                        {practiceFeedback.rubricScore && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {Object.entries(practiceFeedback.rubricScore).map(
                              ([label, score]) => (
                                <div
                                  key={label}
                                  className="p-3 rounded-lg border border-border bg-surface-1"
                                >
                                  <p className="text-[10px] font-mono text-muted-foreground uppercase truncate">
                                    {label}
                                  </p>
                                  <p className="mt-1 font-mono text-base font-bold text-foreground">
                                    {score}/10
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {/* Strengths & Improvements */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          {practiceFeedback.strengths?.length > 0 && (
                            <div className="p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                              <p className="text-xs font-mono font-semibold text-emerald-400 uppercase">
                                Verified Strengths
                              </p>
                              <ul className="space-y-1.5 text-xs text-muted-foreground">
                                {practiceFeedback.strengths.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {practiceFeedback.improvements?.length > 0 && (
                            <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2">
                              <p className="text-xs font-mono font-semibold text-amber-400 uppercase">
                                Priority Improvements
                              </p>
                              <ul className="space-y-1.5 text-xs text-muted-foreground">
                                {practiceFeedback.improvements.map(
                                  (item, idx) => (
                                    <li
                                      key={idx}
                                      className="flex items-start gap-2"
                                    >
                                      <Target className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                      <span>{item}</span>
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ════════════════════ TAB 4: COMMUNITY ════════════════════ */}
            {activeTab === "community" && (
              <div className="space-y-6">
                <Card className="border-border bg-surface-1">
                  <CardHeader className="pb-4">
                    <span className="font-mono text-[10px] text-accent uppercase tracking-widest font-semibold">
                      COMMUNITY DATASET
                    </span>
                    <CardTitle className="text-xl font-bold">
                      Contribute an Interview Question
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Submit questions you experienced in real interviews. Once verified by administrators, they are vectorized and made available across the platform.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleContributionSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-mono text-muted-foreground">
                          Question Prompt
                        </label>
                        <textarea
                          className="w-full min-h-[90px] rounded-lg border border-border bg-surface-2 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                          placeholder="e.g. Design a distributed counter service capable of 500k writes/sec with eventual consistency guarantees..."
                          value={contributionForm.questionText}
                          onChange={handleContributionField("questionText")}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-mono text-muted-foreground">
                            Tags (comma separated)
                          </label>
                          <Input
                            placeholder="system-design, distributed, raft"
                            value={contributionForm.tags}
                            onChange={handleContributionField("tags")}
                            className="h-9 bg-surface-2 border-border text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-mono text-muted-foreground">
                            Company / Tier (optional)
                          </label>
                          <Input
                            placeholder="Google, Stripe, Uber"
                            value={contributionForm.company}
                            onChange={handleContributionField("company")}
                            className="h-9 bg-surface-2 border-border text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-mono text-muted-foreground">
                          Observed in a Real Technical Screen?
                        </label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              contributionForm.seenInInterview === "yes"
                                ? "default"
                                : "outline"
                            }
                            onClick={() =>
                              setContributionForm((prev) => ({
                                ...prev,
                                seenInInterview: "yes",
                              }))
                            }
                            className="text-xs font-mono"
                          >
                            Yes, Real Interview
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              contributionForm.seenInInterview === "no"
                                ? "default"
                                : "outline"
                            }
                            onClick={() =>
                              setContributionForm((prev) => ({
                                ...prev,
                                seenInInterview: "no",
                              }))
                            }
                            className="text-xs font-mono"
                          >
                            Practice / Synthetic
                          </Button>
                        </div>
                      </div>

                      {submissionError && (
                        <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-mono">
                          {submissionError}
                        </div>
                      )}
                      {submissionSuccess && (
                        <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono">
                          {submissionSuccess}
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={submissionLoading}
                        className="w-full sm:w-auto h-9 px-6 text-xs font-mono font-medium tracking-tight bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {submissionLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Question for Review"
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Submissions History */}
                <Card className="border-border bg-surface-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold">
                      Your Submitted Questions ({submissions.length})
                    </CardTitle>
                    <CardDescription className="text-xs font-mono">
                      Track administrative verification status.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {submissions.length === 0 ? (
                      <p className="text-xs font-mono text-muted-foreground py-4 text-center">
                        No submissions recorded yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {submissions.slice(0, 5).map((item) => (
                          <div
                            key={item._id}
                            className="p-3 rounded-lg border border-border bg-surface-2/40 text-xs space-y-1.5"
                          >
                            <p className="font-medium text-foreground">
                              {item.questionText}
                            </p>
                            <div className="flex items-center gap-2 font-mono text-[10px]">
                              <Badge
                                variant={
                                  item.status === "approved"
                                    ? "success"
                                    : item.status === "rejected"
                                    ? "destructive"
                                    : "default"
                                }
                                size="sm"
                              >
                                {item.status.toUpperCase()}
                              </Badge>
                              <span className="text-muted-foreground">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </span>
                              {item.company && (
                                <span className="text-muted-foreground">
                                  • {item.company}
                                </span>
                              )}
                            </div>
                            {item.adminNote && (
                              <p className="text-[11px] font-mono text-muted-foreground border-t border-border/40 pt-1">
                                Admin note: {item.adminNote}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>

      {duplicateSessionPrompt && (
        <DuplicateSessionModal
          session={duplicateSessionPrompt}
          onReuse={async () => {
            const sId = duplicateSessionPrompt._id;
            setDuplicateSessionPrompt(null);
            setPracticeAnswer("");
            setPracticeFeedback(null);
            await switchSession(sId);
          }}
          onCreateNew={async () => {
            setDuplicateSessionPrompt(null);
            await handleFetchMLQuestions();
          }}
          onCancel={() => {
            setDuplicateSessionPrompt(null);
          }}
        />
      )}
    </div>
  );
}
