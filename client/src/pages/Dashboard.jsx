import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
    BrainCircuit,
    UploadCloud,
    File,
    PlayCircle,
    Loader2,
    LogOut,
    ShieldCheck,
    Send,
    BookOpen,
    Sparkles,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import { fadeUp, getFadeUpWithDelay } from "@/lib/motion";
import { authFetch, clearAuthSession, ensureSession } from "@/lib/auth";
import { useSession } from "@/lib/sessionManager";

export default function Dashboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const resumeInputRef = useRef(null);
    const [user, setUser] = useState(null);
    const [token, setToken] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [resumeLoaded, setResumeLoaded] = useState(false);
    const [resumeFileName, setResumeFileName] = useState("");
    const [extractedSkills, setExtractedSkills] = useState([]);
    const [resumeError, setResumeError] = useState("");
    const [resumeSuccess, setResumeSuccess] = useState("");
    const [submissionLoading, setSubmissionLoading] = useState(false);
    const [submissions, setSubmissions] = useState([]);
    const [targetRole, setTargetRole] = useState("");
    const [targetCompany, setTargetCompany] = useState("");
    const [targetLevel, setTargetLevel] = useState("mid");
    const [targetDomain, setTargetDomain] = useState("");
    const [practiceAnswer, setPracticeAnswer] = useState("");
    const [practiceLoading, setPracticeLoading] = useState(false);
    const [practiceFeedback, setPracticeFeedback] = useState(null);
    const [submissionError, setSubmissionError] = useState("");
    const [submissionSuccess, setSubmissionSuccess] = useState("");
    const [duplicateSessionPrompt, setDuplicateSessionPrompt] = useState(null);
    const [pendingGenerateRequest, setPendingGenerateRequest] = useState(null);
    const [contributionForm, setContributionForm] = useState({
        questionText: "",
        tags: "",
        company: "",
        seenInInterview: "no",
    });

    // ── ML Pipeline Questions state ──
    const [mlQuestions, setMlQuestions] = useState(null);
    const [mlQuestionsLoading, setMlQuestionsLoading] = useState(false);
    const [mlQuestionsError, setMlQuestionsError] = useState("");
    const [expandedSkills, setExpandedSkills] = useState({});
    const [selectedMlQuestion, setSelectedMlQuestion] = useState(null);
    const [returnedQuestionIds, setReturnedQuestionIds] = useState(new Set());
    const [mlSessionId, setMlSessionId] = useState(null);
    const [resumeFileRef, setResumeFileRef] = useState(null);

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
        setSessionQuestionIndex,
        clearSessionStorage,
    } = useSession();

    // Derived state: current question index for active session
    const currentQuestionIndex = getSessionQuestionIndex();
    const currentQuestion =
        activeSession?.generatedQuestions?.[currentQuestionIndex] || null;

    const handleAuthFailure = (error) => {
        if (error?.message !== "AUTH_REQUIRED") return false;
        clearAuthSession();
        navigate("/login", { replace: true });
        return true;
    };

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

    const fetchMySubmissions = async () => {
        const response = await authFetch("/questions/submissions/me");

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || "Could not fetch your submissions");
        }

        setSubmissions(data.submissions || []);
    };

    useEffect(() => {
        if (!token) return;

        fetchMySubmissions().catch((error) => {
            if (handleAuthFailure(error)) return;
            setSubmissionError(
                error.message || "Could not load your submissions",
            );
        });
    }, [token]);

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
                data.message || "Question submitted for admin review.",
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
            setResumeError("You must be logged in to upload resume files.");
            event.target.value = "";
            return;
        }

        if (file.type !== "application/pdf") {
            setResumeError("Please upload a PDF file only.");
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
                throw new Error(data.message || "Could not analyze resume");
            }

            setResumeFileName(data.fileName || file.name);
            setExtractedSkills(data.skills || []);
            setResumeSuccess(data.message || "Resume analyzed successfully.");
            setIsUploading(false);
            setResumeLoaded(true);
            setResumeFileRef(file);
        } catch (error) {
            if (handleAuthFailure(error)) return;
            setIsUploading(false);
            setResumeLoaded(false);
            setResumeError(error.message || "Could not analyze resume");
        } finally {
            event.target.value = "";
        }
    };

    const handleSelectHistorySession = async (sessionId) => {
        await switchSession(sessionId);
        setPracticeAnswer("");
        setPracticeFeedback(null);
    };

    const handleNavigateQuestion = (direction) => {
        if (!activeSession?.generatedQuestions) return;

        const totalQuestions = activeSession.generatedQuestions.length;
        let newIndex = currentQuestionIndex;

        if (direction === "next" && newIndex < totalQuestions - 1) {
            newIndex++;
        } else if (direction === "prev" && newIndex > 0) {
            newIndex--;
        }

        setSessionQuestionIndex(newIndex);
        setPracticeAnswer("");
        setPracticeFeedback(null);
    };

    const buildGeneratePayload = () => ({
        targetRole: targetRole.trim(),
        targetCompany: targetCompany.trim(),
        targetLevel,
        targetDomain: targetDomain.trim(),
        sourceFileName: resumeFileName,
        resumeSkills: extractedSkills,
        questionCount: 10,
    });

    // ── Run full ML Pipeline (FAISS search) ──
    const handleFetchMLQuestions = async () => {
        if (!resumeFileRef && !resumeLoaded) return;

        setMlQuestionsLoading(true);
        setMlQuestionsError("");
        setMlQuestions(null);
        setReturnedQuestionIds(new Set());
        setMlSessionId(null);

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
                    data.error || data.message || "ML pipeline failed",
                );
            }

            // Group questions by topic for display
            const grouped = {};
            (data.questions || []).forEach((q) => {
                const topic = q.topic || "General";
                if (!grouped[topic]) grouped[topic] = [];
                grouped[topic].push(q);
            });

            const results = Object.entries(grouped).map(([topic, qs]) => ({
                skill: topic,
                matchedCount: qs.length,
                questions: qs,
            }));

            setMlQuestions({
                message: data.message || `Found ${data.totalQuestions} questions`,
                totalQuestions: data.totalQuestions || 0,
                results,
                skills: data.skills || {},
                processingTimeMs: data.processingTimeMs || 0,
                sessionId: data.sessionId,
            });
            setMlSessionId(data.sessionId);

            // Update extracted skills from ML pipeline if available
            if (data.skills?.raw?.length) {
                setExtractedSkills(data.skills.raw);
            }

            // Auto-expand topics that have matches
            const expanded = {};
            results.forEach((r) => {
                if (r.matchedCount > 0) expanded[r.skill] = true;
            });
            setExpandedSkills(expanded);

            // Track all returned questions to avoid duplicates on "Generate More"
            const allQuestionIds = new Set();
            results.forEach((skillGroup) => {
                (skillGroup.questions || []).forEach((q) => {
                    allQuestionIds.add(q.question);
                });
            });
            setReturnedQuestionIds(allQuestionIds);

            // Save questions to session: if activeSession present, append; otherwise create new session
            if (results.length > 0) {
                const flattenedQuestions = [];
                results.forEach((skillGroup) => {
                    (skillGroup.questions || []).forEach((q) => {
                        flattenedQuestions.push({
                            question: q.question,
                            topic: q.topic || "Unknown",
                            difficulty: q.difficulty || "Unknown",
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
                            // Create a new session on server and add to UI
                            const createResp = await authFetch(
                                "/ml/create-session",
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        targetRole: targetRole,
                                        targetCompany: targetCompany,
                                        targetLevel: targetLevel,
                                        targetDomain: targetDomain,
                                        sourceFileName: resumeFileName,
                                        resumeSkills: extractedSkills,
                                        mlQuestions: flattenedQuestions,
                                    }),
                                },
                            );

                            if (createResp.ok) {
                                const createData = await createResp
                                    .json()
                                    .catch(() => ({}));
                                if (createData?.session) {
                                    addSession(createData.session);
                                }
                            } else {
                                // If creation failed, log but continue
                                console.warn(
                                    "Failed to create session on server",
                                );
                            }
                        }
                    } catch (saveError) {
                        console.warn(
                            "Could not save questions to session:",
                            saveError,
                        );
                    }
                }
            }
        } catch (error) {
            if (handleAuthFailure(error)) return;
            setMlQuestionsError(
                error.message || "ML pipeline failed",
            );
        } finally {
            setMlQuestionsLoading(false);
        }
    };

    // ── Generate More Questions (avoiding duplicates) ──
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
                throw new Error(
                    data.error ||
                        data.message ||
                        "Could not fetch more questions",
                );
            }

            // Filter out duplicate questions
            const newResults = (data.results || []).map((skillGroup) => ({
                ...skillGroup,
                questions: (skillGroup.questions || []).filter(
                    (q) => !returnedQuestionIds.has(q.question),
                ),
            }));

            // Merge with existing questions
            const mergedResults = (mlQuestions?.results || []).map(
                (existing) => {
                    const newSkillData = newResults.find(
                        (n) => n.skill === existing.skill,
                    );
                    if (newSkillData) {
                        return {
                            ...existing,
                            questions: [
                                ...existing.questions,
                                ...newSkillData.questions,
                            ],
                            matchedCount:
                                existing.matchedCount +
                                newSkillData.matchedCount,
                        };
                    }
                    return existing;
                },
            );

            // Add new skills that didn't exist before
            newResults.forEach((newSkill) => {
                if (!mergedResults.find((m) => m.skill === newSkill.skill)) {
                    mergedResults.push(newSkill);
                }
            });

            // Update state
            setMlQuestions({
                ...data,
                results: mergedResults,
                totalQuestions:
                    (mlQuestions?.totalQuestions || 0) + data.totalQuestions,
            });

            // Update returned question IDs
            const updatedIds = new Set(returnedQuestionIds);
            mergedResults.forEach((skillGroup) => {
                (skillGroup.questions || []).forEach((q) => {
                    updatedIds.add(q.question);
                });
            });
            setReturnedQuestionIds(updatedIds);

            // Save new questions to session if sessionId exists
            if (activeSessionId && newResults) {
                const flattenedNewQuestions = [];
                newResults.forEach((skillGroup) => {
                    (skillGroup.questions || []).forEach((q) => {
                        flattenedNewQuestions.push({
                            question: q.question,
                            topic: q.topic || "Unknown",
                            difficulty: q.difficulty || "Unknown",
                        });
                    });
                });

                if (flattenedNewQuestions.length > 0) {
                    try {
                        await authFetch("/ml/save-questions-to-session", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                sessionId: activeSessionId,
                                questions: flattenedNewQuestions,
                            }),
                        });
                    } catch (saveError) {
                        console.warn(
                            "Could not save new questions to session:",
                            saveError,
                        );
                    }
                }
            }
        } catch (error) {
            if (handleAuthFailure(error)) return;
            setMlQuestionsError(
                error.message || "Could not generate more questions",
            );
        } finally {
            setMlQuestionsLoading(false);
        }
    };

    const toggleSkillExpand = (skill) => {
        setExpandedSkills((prev) => ({ ...prev, [skill]: !prev[skill] }));
    };

    const getDifficultyColor = (difficulty) => {
        const d = (difficulty || "").toLowerCase();
        if (d === "easy")
            return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
        if (d === "medium")
            return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
        if (d === "hard")
            return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
        return "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300";
    };

    const handleGenerate = async (forceNew = false, overridePayload = null) => {
        setIsGenerating(true);
        setSubmissionError("");

        const payload = {
            ...(overridePayload || buildGeneratePayload()),
            ...(forceNew ? { forceNew: true } : {}),
        };

        try {
            const response = await authFetch("/questions/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));

            if (response.status === 409 && data?.existingSession) {
                setPendingGenerateRequest(payload);
                setDuplicateSessionPrompt(data.existingSession);
                return;
            }

            if (!response.ok) {
                throw new Error(data.message || "Could not generate questions");
            }

            setTimeout(async () => {
                await switchSession(data.session._id);
            }, 100);
        } catch (error) {
            if (handleAuthFailure(error)) return;
            setSubmissionError(error.message || "Could not generate questions");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleReuseExistingSession = async () => {
        if (!duplicateSessionPrompt?._id) return;

        const sessionId = duplicateSessionPrompt._id;
        setDuplicateSessionPrompt(null);
        setPendingGenerateRequest(null);
        setPracticeAnswer("");
        setPracticeFeedback(null);
        await switchSession(sessionId);
    };

    const handleForceCreateSession = async () => {
        const payload = pendingGenerateRequest || buildGeneratePayload();
        setDuplicateSessionPrompt(null);
        setPendingGenerateRequest(null);
        await handleGenerate(true, payload);
    };

    const handlePracticeSubmit = async (event) => {
        event.preventDefault();

        // Use selectedMlQuestion if available, otherwise use currentQuestion
        const questionToUse = selectedMlQuestion || currentQuestion;

        if (!questionToUse) {
            setSubmissionError("Select a question before asking for feedback.");
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
                throw new Error(
                    data.message || "Could not analyze your answer",
                );
            }

            setPracticeFeedback(data.attempt);
        } catch (error) {
            if (handleAuthFailure(error)) return;
            setSubmissionError(
                error.message || "Could not analyze your answer",
            );
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
            if (!resp.ok)
                throw new Error(data.message || "Could not create session");

            if (data.session) {
                addSession(data.session);
            }
        } catch (error) {
            if (handleAuthFailure(error)) return;
            console.error("Could not create session:", error);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 text-foreground font-sans flex flex-col">
            {/* Top Navbar */}
            <nav className="sticky top-0 z-40 w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-border/40 dark:border-slate-700/40 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xl font-bold text-secondary-foreground tracking-tight">
                    <BrainCircuit className="w-6 h-6 text-primary" />
                    Interview Buddy Workspace
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    {user?.role === "admin" && (
                        <Link to="/admin">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                            >
                                <ShieldCheck className="w-4 h-4" /> Admin Panel
                            </Button>
                        </Link>
                    )}
                    <span className="text-sm font-medium text-muted-foreground mr-4">
                        Welcome, {user?.fullName || "User"}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-primary font-bold text-xs">
                        {user ? getUserInitials(user.fullName) : "U"}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        className="ml-2"
                    >
                        <LogOut className="w-4 h-4 mr-1" /> Logout
                    </Button>
                </div>
            </nav>

            {/* Main Content with Sidebar */}
            <div className="flex flex-1 overflow-hidden">
                {/* Session Sidebar */}
                <SessionSidebar
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    activeSession={activeSession}
                    activeQuestionIndex={currentQuestionIndex}
                    onSelectSession={handleSelectHistorySession}
                    onDeleteSession={deleteSession}
                    onRenameSession={renameSession}
                    onAddSession={handleAddSession}
                    isLoading={isLoadingSessions}
                />

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 relative">
                        {location.state?.adminAccessDenied && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-6">
                                {location.state.message ||
                                    "You do not have access to the admin dashboard."}
                            </div>
                        )}

                        {/* Decorative background glow */}
                        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

                        <motion.div
                            className="space-y-6 relative z-10"
                            initial="hidden"
                            animate="visible"
                            variants={fadeUp}
                        >
                            <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-center text-2xl">
                                        Add Resume
                                    </CardTitle>
                                    <CardDescription className="text-center">
                                        Upload your latest resume (PDF) for
                                        analysis.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <input
                                        ref={resumeInputRef}
                                        type="file"
                                        accept="application/pdf"
                                        className="hidden"
                                        onChange={handleUpload}
                                    />
                                    {!resumeLoaded ? (
                                        <div
                                            className="border-2 border-dashed border-border dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center gap-4 bg-muted/30 dark:bg-slate-700/30 hover:bg-muted/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                                            onClick={handleUploadClick}
                                        >
                                            {isUploading ? (
                                                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                            ) : (
                                                <UploadCloud className="w-10 h-10 text-muted-foreground" />
                                            )}
                                            <div className="text-center">
                                                <p className="text-sm font-medium">
                                                    {isUploading
                                                        ? "Uploading & Analyzing..."
                                                        : "Click to upload your resume"}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    PDF max 5MB
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border border-border dark:border-slate-700 rounded-xl p-4 flex items-center gap-4 bg-white/80 dark:bg-slate-800/80">
                                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                                                <File className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">
                                                    {resumeFileName ||
                                                        "uploaded_resume.pdf"}
                                                </p>
                                                <p className="text-xs text-green-600 font-medium">
                                                    Analysis Complete ✓
                                                </p>
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
                                                    setMlQuestionsError("");
                                                    setMlSessionId(null);
                                                    setResumeFileRef(null);
                                                }}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    )}

                                    {resumeError && (
                                        <p className="mt-3 text-sm text-red-600">
                                            {resumeError}
                                        </p>
                                    )}
                                    {resumeSuccess && (
                                        <p className="mt-3 text-sm text-green-700">
                                            {resumeSuccess}
                                        </p>
                                    )}

                                    {resumeLoaded &&
                                        extractedSkills.length > 0 && (
                                            <div className="mt-4 space-y-2">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Extracted Skills
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {extractedSkills.map(
                                                        (skill) => (
                                                            <span
                                                                key={skill}
                                                                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                                                            >
                                                                {skill}
                                                            </span>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    {/* ── Run ML Pipeline Button ── */}
                                    {resumeLoaded && extractedSkills.length > 0 && (
                                        <div className="mt-6 pt-4 border-t border-border/40 dark:border-slate-700/40">
                                            <Button
                                                className="w-full h-12 rounded-xl gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25 transition-all duration-300"
                                                onClick={handleFetchMLQuestions}
                                                disabled={mlQuestionsLoading}
                                            >
                                                {mlQuestionsLoading ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Running ML Pipeline...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-5 h-5" />
                                                        Run ML Pipeline & Find Questions
                                                    </>
                                                )}
                                            </Button>
                                            <p className="mt-2 text-xs text-center text-muted-foreground">
                                                Runs FAISS semantic search on your resume to find the most relevant interview questions
                                            </p>
                                        </div>
                                    )}

                                    {mlQuestionsError && (
                                        <p className="mt-3 text-sm text-red-600">
                                            {mlQuestionsError}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                {/* Answer Practice Section - Connected to ML Questions */}
                                {selectedMlQuestion ? (
                                    <Card className="border-border/60 bg-background/70">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-lg">
                                                Answer Practice
                                            </CardTitle>
                                            <CardDescription>
                                                Answer the selected question
                                                from your dataset
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="rounded-xl bg-muted/40 p-3 text-sm text-foreground">
                                                {selectedMlQuestion.question}
                                            </div>
                                            <form
                                                onSubmit={handlePracticeSubmit}
                                                className="space-y-3"
                                            >
                                                <textarea
                                                    className="min-h-[160px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    placeholder="Write your answer here..."
                                                    value={practiceAnswer}
                                                    onChange={(event) =>
                                                        setPracticeAnswer(
                                                            event.target.value,
                                                        )
                                                    }
                                                    disabled={practiceLoading}
                                                />
                                                <Button
                                                    type="submit"
                                                    className="w-full"
                                                    disabled={practiceLoading}
                                                >
                                                    {practiceLoading ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                                                            Reviewing...
                                                        </>
                                                    ) : (
                                                        "Get Feedback"
                                                    )}
                                                </Button>
                                            </form>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card className="border-border/60 bg-background/70">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-lg">
                                                Answer Practice
                                            </CardTitle>
                                            <CardDescription>
                                                Select a question from the
                                                dataset below to practice
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="text-center text-sm text-muted-foreground py-6">
                                            No question selected. Click on a
                                            question below to start practicing.
                                        </CardContent>
                                    </Card>
                                )}

                                {practiceFeedback && (
                                    <Card className="border-border/60 bg-background/70">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-lg">
                                                Feedback
                                            </CardTitle>
                                            <CardDescription>
                                                {
                                                    practiceFeedback.feedbackSummary
                                                }
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                {Object.entries(
                                                    practiceFeedback.rubricScore ||
                                                        {},
                                                ).map(([label, score]) => (
                                                    <div
                                                        key={label}
                                                        className="rounded-xl border border-border/60 p-3"
                                                    >
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                            {label}
                                                        </p>
                                                        <p className="mt-1 text-lg font-semibold text-foreground">
                                                            {score}
                                                            /10
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Strengths
                                                </p>
                                                <ul className="mt-2 space-y-1 text-sm text-foreground">
                                                    {(
                                                        practiceFeedback.strengths ||
                                                        []
                                                    ).map((item) => (
                                                        <li key={item}>
                                                            • {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Improve next
                                                </p>
                                                <ul className="mt-2 space-y-1 text-sm text-foreground">
                                                    {(
                                                        practiceFeedback.improvements ||
                                                        []
                                                    ).map((item) => (
                                                        <li key={item}>
                                                            • {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <p className="text-sm font-medium text-primary">
                                                Overall score:{" "}
                                                {practiceFeedback.overallScore}
                                                /10
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* ── ML Dataset Questions Section ── */}
                            {mlQuestions && mlQuestions.results?.length > 0 && (
                                <motion.div
                                    initial="hidden"
                                    animate="visible"
                                    variants={getFadeUpWithDelay(0.15)}
                                >
                                    <Card className="bg-gradient-to-br from-violet-50/80 via-white/80 to-indigo-50/80 dark:from-slate-800/90 dark:via-slate-800/80 dark:to-indigo-950/60 backdrop-blur-xl border-violet-200/60 dark:border-indigo-700/40 shadow-lg shadow-violet-500/5">
                                        <CardHeader className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                                                    <BookOpen className="w-5 h-5 text-white" />
                                                </div>
                                                <CardTitle className="text-2xl bg-gradient-to-r from-violet-700 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent">
                                                    ML Pipeline — Interview Questions
                                                </CardTitle>
                                            </div>
                                            <CardDescription className="mt-2">
                                                {mlQuestions.message}
                                                {mlQuestions.processingTimeMs > 0 && (
                                                    <span className="ml-1 text-xs opacity-70">({mlQuestions.processingTimeMs}ms)</span>
                                                )}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {/* Flat list of all questions */}
                                            <div className="space-y-3">
                                                {mlQuestions.results.flatMap(
                                                    (skillGroup) =>
                                                        skillGroup.questions.map(
                                                            (q, qIndex) => (
                                                                <button
                                                                    type="button"
                                                                    key={`${skillGroup.skill}-${qIndex}`}
                                                                    onClick={() => {
                                                                        setSelectedMlQuestion(
                                                                            q,
                                                                        );
                                                                        setPracticeAnswer(
                                                                            "",
                                                                        );
                                                                        setPracticeFeedback(
                                                                            null,
                                                                        );
                                                                    }}
                                                                    className={`w-full text-left rounded-lg border p-4 transition-all ${
                                                                        selectedMlQuestion?.question ===
                                                                        q.question
                                                                            ? "border-violet-400 bg-violet-50/60 dark:bg-violet-900/20 shadow-md"
                                                                            : "border-violet-200/60 dark:border-indigo-700/30 bg-white/70 dark:bg-slate-800/70 hover:bg-violet-50/40 dark:hover:bg-indigo-900/10"
                                                                    }`}
                                                                >
                                                                    <p className="text-sm font-medium leading-relaxed text-foreground mb-3">
                                                                        {
                                                                            q.question
                                                                        }
                                                                    </p>
                                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                        {q.topic && q.topic !== "Unknown" && (
                                                                            <span className="rounded-full bg-violet-100 dark:bg-violet-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                                                                                {q.topic}
                                                                            </span>
                                                                        )}
                                                                        {q.difficulty && q.difficulty !== "Unknown" && (
                                                                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getDifficultyColor(q.difficulty)}`}>
                                                                                {q.difficulty}
                                                                            </span>
                                                                        )}
                                                                        {(q.final_score || q.score) > 0 && (
                                                                            <span className="rounded-full bg-sky-100 dark:bg-sky-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                                                                                Score: {((q.final_score || q.score) * 100).toFixed(0)}%
                                                                            </span>
                                                                        )}
                                                                        {(q.tags || []).filter(t => t).map((tag, ti) => (
                                                                            <span key={ti} className="rounded-full bg-slate-100 dark:bg-slate-700/40 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                                                                                #{tag}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </button>
                                                            ),
                                                        ),
                                                )}
                                            </div>

                                            {/* Summary footer */}
                                            <div className="mt-6 pt-4 border-t border-violet-200/40 dark:border-indigo-700/30 flex items-center justify-between">
                                                <p className="text-xs text-muted-foreground">
                                                    {mlQuestions.totalQuestions}{" "}
                                                    total questions found
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={
                                                        handleGenerateMoreQuestions
                                                    }
                                                    disabled={
                                                        mlQuestionsLoading
                                                    }
                                                    className="gap-1.5 border-violet-300 dark:border-indigo-700 text-violet-700 dark:text-indigo-300 hover:bg-violet-50 dark:hover:bg-indigo-900/30"
                                                >
                                                    <Sparkles className="w-3.5 h-3.5" />
                                                    Generate More
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}

                            <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-center text-2xl">
                                        Contribute Question
                                    </CardTitle>
                                    <CardDescription>
                                        Submit a question for admin review.
                                        Approved questions are added to the main
                                        dataset.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <form
                                        onSubmit={handleContributionSubmit}
                                        className="space-y-3"
                                    >
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">
                                                Question
                                            </label>
                                            <textarea
                                                className="w-full min-h-[100px] rounded-md border border-input bg-secondary dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                placeholder="Enter a real interview question you faced"
                                                value={
                                                    contributionForm.questionText
                                                }
                                                onChange={handleContributionField(
                                                    "questionText",
                                                )}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">
                                                Tags (comma separated)
                                            </label>
                                            <Input
                                                placeholder="react, system-design, backend"
                                                value={contributionForm.tags}
                                                onChange={handleContributionField(
                                                    "tags",
                                                )}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">
                                                Company (optional)
                                            </label>
                                            <Input
                                                placeholder="Example: Google"
                                                value={contributionForm.company}
                                                onChange={handleContributionField(
                                                    "company",
                                                )}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">
                                                Have you seen this question in a
                                                real interview?
                                            </label>
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant={
                                                        contributionForm.seenInInterview ===
                                                        "yes"
                                                            ? "default"
                                                            : "outline"
                                                    }
                                                    onClick={() =>
                                                        setContributionForm(
                                                            (prev) => ({
                                                                ...prev,
                                                                seenInInterview:
                                                                    "yes",
                                                            }),
                                                        )
                                                    }
                                                >
                                                    Yes
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={
                                                        contributionForm.seenInInterview ===
                                                        "no"
                                                            ? "default"
                                                            : "outline"
                                                    }
                                                    onClick={() =>
                                                        setContributionForm(
                                                            (prev) => ({
                                                                ...prev,
                                                                seenInInterview:
                                                                    "no",
                                                            }),
                                                        )
                                                    }
                                                >
                                                    No
                                                </Button>
                                            </div>
                                        </div>
                                        {submissionError && (
                                            <p className="text-sm text-red-600">
                                                {submissionError}
                                            </p>
                                        )}
                                        {submissionSuccess && (
                                            <p className="text-sm text-green-700">
                                                {submissionSuccess}
                                            </p>
                                        )}
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={submissionLoading}
                                        >
                                            {submissionLoading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4 mr-2" />{" "}
                                                    Submit for Review
                                                </>
                                            )}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>

                            <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-sm">
                                <CardHeader>
                                    <CardTitle>
                                        Your Submitted Questions
                                    </CardTitle>
                                    <CardDescription>
                                        Track whether admin has reviewed your
                                        contributions.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {submissions.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No submissions yet.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {submissions
                                                .slice(0, 5)
                                                .map((item) => (
                                                    <div
                                                        key={item._id}
                                                        className="rounded-md border border-border/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-700/80 p-3"
                                                    >
                                                        <p className="text-sm font-medium text-foreground">
                                                            {item.questionText}
                                                        </p>
                                                        <div className="mt-2 flex items-center gap-2 text-xs">
                                                            <span className="rounded-full bg-primary/10 px-2 py-1 text-primary uppercase">
                                                                {item.status}
                                                            </span>
                                                            <span className="text-muted-foreground">
                                                                {new Date(
                                                                    item.createdAt,
                                                                ).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        {item.adminNote && (
                                                            <p className="mt-2 text-xs text-muted-foreground">
                                                                Admin note:{" "}
                                                                {item.adminNote}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </main>
            </div>

            {duplicateSessionPrompt && (
                <DuplicateSessionModal
                    session={duplicateSessionPrompt}
                    onReuse={handleReuseExistingSession}
                    onCreateNew={handleForceCreateSession}
                    onCancel={() => {
                        setDuplicateSessionPrompt(null);
                        setPendingGenerateRequest(null);
                    }}
                />
            )}
        </div>
    );
}
