import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  ArrowLeft,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "@/components/ThemeToggle";

export default function QuestionsDisplay() {
  const { sessionId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({
    difficulty: null,
    topic: null,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [skills, setSkills] = useState({
    extracted: [],
    expanded: [],
  });

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const token =
        localStorage.getItem("accessToken") || localStorage.getItem("authToken");
      if (!token) throw new Error("Not authenticated");

      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.difficulty && { difficulty: filters.difficulty }),
        ...(filters.topic && { topic: filters.topic }),
      });

      const response = await fetch(
        `/api/resume/questions/${sessionId}?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Failed to fetch questions");
      }

      const data = await response.json();
      setQuestions(data.questions || []);
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
      setSkills(data.skills || { extracted: [], expanded: [] });
      setError("");
    } catch (err) {
      setError(err.message);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleFilterChange = (type, value) => {
    setFilters((prev) => ({
      ...prev,
      [type]: prev[type] === value ? null : value,
    }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleDownload = async () => {
    try {
      const token =
        localStorage.getItem("accessToken") || localStorage.getItem("authToken");
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `/api/resume/questions/${sessionId}/export`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vettor-session-${sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  };

  const getDifficultyBadge = (difficulty) => {
    const d = (difficulty || "").toLowerCase();
    if (d === "easy") return "easy";
    if (d === "medium") return "medium";
    if (d === "hard") return "hard";
    return "default";
  };

  if (loading && questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground font-mono text-xs">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
          <p className="text-muted-foreground">Indexing questions from vector cache...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-6 font-mono text-xs">
        <div className="bg-surface-1 border border-rose-500/30 p-6 rounded-xl max-w-md w-full space-y-4">
          <p className="text-rose-400">Error: {error}</p>
          <Link to="/dashboard">
            <Button size="sm" variant="outline" className="w-full text-xs font-mono">
              Return to Workspace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans py-8 px-6 selection:bg-accent/20">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-border pb-5">
          <div className="space-y-1">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Workspace
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Technical Challenge Bank
            </h1>
            <p className="text-xs font-mono text-muted-foreground">
              {pagination.total} challenges indexed • Session ID: {sessionId}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="text-xs font-mono gap-1.5 border-border bg-surface-2 hover:bg-surface-2/80 text-foreground"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Skills Summary */}
        {skills.extracted.length > 0 && (
          <div className="p-4 rounded-xl border border-border bg-surface-1 space-y-2">
            <p className="font-mono text-xs font-semibold text-muted-foreground uppercase">
              Extracted Stack & Entities
            </p>
            <div className="flex flex-wrap gap-1.5">
              {skills.extracted.slice(0, 12).map((skill, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-surface-2 border border-border text-xs font-mono text-foreground"
                >
                  {skill}
                </span>
              ))}
              {skills.extracted.length > 12 && (
                <span className="px-2 py-0.5 text-xs font-mono text-muted-foreground">
                  +{skills.extracted.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="p-4 rounded-xl border border-border bg-surface-1 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-accent" />
            <span className="font-mono text-xs font-semibold uppercase text-muted-foreground">
              Filters
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            {/* Difficulty Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Level:</span>
              {["Easy", "Medium", "Hard"].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => handleFilterChange("difficulty", lvl)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    filters.difficulty === lvl
                      ? "bg-accent text-background font-semibold"
                      : "bg-surface-2 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Topic Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Topic:</span>
              <select
                value={filters.topic || ""}
                onChange={(e) =>
                  handleFilterChange("topic", e.target.value || null)
                }
                className="h-8 rounded bg-surface-2 border border-border px-2 text-xs font-mono text-foreground focus:outline-none"
              >
                <option value="">All Topics</option>
                <option value="DSA">DSA</option>
                <option value="Python">Python</option>
                <option value="JavaScript">JavaScript</option>
                <option value="OS">Operating Systems</option>
                <option value="Database">Database</option>
              </select>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-3">
          {questions.map((question, idx) => {
            const isExpanded = expandedId === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-border bg-surface-1 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : idx)}
                  className="w-full p-4 flex items-start gap-4 text-left hover:bg-surface-2/40 transition-colors"
                >
                  <div className="font-mono text-xs text-muted-foreground mt-0.5 shrink-0 w-6">
                    #{question.sr_no || idx + 1}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {question.question}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={getDifficultyBadge(question.difficulty)}
                        size="sm"
                      >
                        {question.difficulty}
                      </Badge>
                      <Badge variant="outline" size="sm">
                        {question.topic}
                      </Badge>
                      {question.final_score > 0 && (
                        <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {(question.final_score * 100).toFixed(0)}% match
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-muted-foreground mt-1">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 border-t border-border/60 bg-surface-2/30 space-y-4 text-xs font-mono">
                    {question.tags && question.tags.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-muted-foreground uppercase text-[10px]">
                          Matched Entity Tags
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {question.tags.map((t, ti) => (
                            <span
                              key={ti}
                              className="px-2 py-0.5 rounded bg-surface-1 border border-border text-muted-foreground"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
                      <div className="p-2.5 rounded bg-surface-1 border border-border">
                        <p className="text-[10px] text-muted-foreground">
                          Semantic Distance
                        </p>
                        <p className="font-bold text-foreground mt-0.5">
                          {((question.score || 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="p-2.5 rounded bg-surface-1 border border-border">
                        <p className="text-[10px] text-muted-foreground">
                          Tag Density Score
                        </p>
                        <p className="font-bold text-foreground mt-0.5">
                          {((question.tag_score || 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4 font-mono text-xs">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  page: Math.max(1, prev.page - 1),
                }))
              }
              disabled={pagination.page === 1}
              className="text-xs"
            >
              Previous
            </Button>
            <span className="text-muted-foreground px-3">
              Page {pagination.page} of {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  page: Math.min(prev.pages, prev.page + 1),
                }))
              }
              disabled={pagination.page === pagination.pages}
              className="text-xs"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
