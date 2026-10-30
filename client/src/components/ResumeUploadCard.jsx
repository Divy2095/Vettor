import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowLeft,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ResumeUploadCard() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, uploading, processing, completed, error
  const [errorMsg, setErrorMsg] = useState("");
  const [processingTime, setProcessingTime] = useState(0);
  const [questionsCount, setQuestionsCount] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      setErrorMsg("Please upload a PDF file");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMsg("File size must be less than 5MB");
      return;
    }

    setFile(selectedFile);
    setErrorMsg("");
    setStatus("idle");
  };

  const handleUpload = async () => {
    if (!file) {
      setErrorMsg("Please select a file");
      return;
    }

    setLoading(true);
    setStatus("uploading");
    setErrorMsg("");

    try {
      const token = localStorage.getItem("accessToken") || localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication required. Please sign in.");
      }

      const formData = new FormData();
      formData.append("resume", file);

      const uploadResponse = await fetch("/api/resume/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json().catch(() => ({}));
        throw new Error(error.message || "Upload failed");
      }

      const uploadData = await uploadResponse.json();
      setSessionId(uploadData.sessionId);
      setStatus("processing");

      pollProcessingStatus(uploadData.sessionId, token);
    } catch (error) {
      setErrorMsg(error.message);
      setStatus("error");
      setLoading(false);
    }
  };

  const pollProcessingStatus = async (sId, token, maxAttempts = 60) => {
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setErrorMsg("Processing timeout. Please try again.");
        setStatus("error");
        setLoading(false);
        return;
      }

      try {
        const statusResponse = await fetch(`/api/resume/status/${sId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!statusResponse.ok) {
          throw new Error("Failed to fetch status");
        }

        const statusData = await statusResponse.json();

        if (statusData.status === "completed") {
          setQuestionsCount(statusData.totalQuestions);
          setProcessingTime(statusData.processingTime);
          setStatus("completed");
          setLoading(false);
        } else if (statusData.status === "failed") {
          setErrorMsg(statusData.errorMessage);
          setStatus("error");
          setLoading(false);
        } else {
          attempts++;
          setTimeout(poll, 2000);
        }
      } catch (error) {
        setErrorMsg("Error checking status: " + error.message);
        setStatus("error");
        setLoading(false);
      }
    };

    poll();
  };

  const handleDownload = async () => {
    if (!sessionId) return;

    try {
      const token = localStorage.getItem("accessToken") || localStorage.getItem("authToken");
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`/api/resume/questions/${sessionId}/export`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vettor-questions-${sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setErrorMsg("Download failed: " + error.message);
    }
  };

  const handleReset = () => {
    setFile(null);
    setSessionId(null);
    setStatus("idle");
    setErrorMsg("");
    setProcessingTime(0);
    setQuestionsCount(0);
    setLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Workspace
        </Link>

        <div className="rounded-xl border border-border bg-surface-1 p-8 shadow-xl space-y-6">
          <div className="space-y-1">
            <span className="font-mono text-[10px] text-accent uppercase tracking-widest font-semibold">
              PIPELINE INGESTION
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Upload Resume
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              Extract technical skills and generate personalized interview questions.
            </p>
          </div>

          {status === "idle" && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-border hover:border-accent/60 bg-surface-2/40 hover:bg-surface-2/70 rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-muted-foreground group-hover:text-accent transition-colors" />
                <div className="text-center font-mono">
                  <p className="text-xs font-medium text-foreground">
                    Click to select or drag and drop
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    PDF format (up to 5MB)
                  </p>
                </div>
              </div>

              {file && (
                <div className="p-3 bg-surface-2 border border-border rounded-lg flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 truncate">
                    <FileCheck2 className="w-4 h-4 text-accent" />
                    <span className="truncate text-foreground">{file.name}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-mono rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!file || loading}
                className="w-full h-10 font-mono text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Upload & Ingest"
                )}
              </Button>
            </div>
          )}

          {status === "uploading" && (
            <div className="text-center py-10 space-y-3 font-mono">
              <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
              <p className="text-xs text-foreground">Uploading resume bytes...</p>
            </div>
          )}

          {status === "processing" && (
            <div className="text-center py-10 space-y-3 font-mono">
              <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
              <p className="text-xs text-foreground">Running FAISS vector pipeline...</p>
              <p className="text-[11px] text-muted-foreground">
                Extracting technical entities and generating matched challenges
              </p>
            </div>
          )}

          {status === "completed" && (
            <div className="text-center py-8 space-y-4 font-mono">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-foreground">
                  Extraction Complete
                </p>
                <p className="text-xs text-muted-foreground">
                  Generated {questionsCount} questions in {(processingTime / 1000).toFixed(1)}s
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center pt-2">
                <Link to={`/dashboard/questions/${sessionId}`}>
                  <Button size="sm" className="text-xs font-mono bg-primary text-primary-foreground hover:bg-primary/90">
                    Explore Questions
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownload}
                  className="text-xs font-mono gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  JSON
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleReset}
                  className="text-xs font-mono text-muted-foreground hover:text-foreground"
                >
                  Upload Another
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-8 space-y-4 font-mono">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-foreground">Ingestion Error</p>
                <p className="text-xs text-rose-400 max-w-sm mx-auto">{errorMsg}</p>
              </div>
              <Button
                size="sm"
                onClick={handleReset}
                className="text-xs font-mono"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
