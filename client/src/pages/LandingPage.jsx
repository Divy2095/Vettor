import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import ThemeToggle from "@/components/ThemeToggle";
import { fadeUp, getFadeUpWithDelay } from "@/lib/motion";
import {
  ArrowRight,
  Terminal,
  Cpu,
  Layers,
  CheckCircle2,
  BarChart2,
  GitBranch,
  ChevronRight,
  Menu,
  X,
  Code2,
  Sparkles,
} from "lucide-react";

/* ────────────────────────── Real Grounded Data for Interactive Hero ────────────────────────── */
const HERO_SKILLS = [
  { name: "Python", category: "Language" },
  { name: "PostgreSQL", category: "Database" },
  { name: "FastAPI", category: "Framework" },
  { name: "Docker", category: "Container" },
  { name: "Redis", category: "Cache / Store" },
  { name: "FAISS", category: "Vector Engine" },
];

const SAMPLE_QUESTION = {
  id: "SYS-042",
  topic: "Database Concurrency",
  difficulty: "Hard",
  similarity: "Cosine Nearest Neighbor",
  text: "How would you design a distributed idempotency key mechanism in PostgreSQL and Redis to handle concurrent API retries without double-charging?",
  rubrics: [
    { label: "Clarity", score: "9/10" },
    { label: "Structure", score: "8/10" },
    { label: "Technical Depth", score: "9/10" },
    { label: "Relevance", score: "9/10" },
  ],
};

const CAPABILITIES = [
  {
    icon: Cpu,
    title: "SBERT & FAISS Vector Matching",
    monoTag: "VECTOR_SEARCH",
    desc: "Transforms extracted skills and project context into dense 384-dimensional embeddings (all-MiniLM-L6-v2), retrieving relevant interview questions using FAISS inner product cosine similarity.",
    stat: "384-dim dense vector search",
  },
  {
    icon: Layers,
    title: "Resume Ingestion & Skill Extraction",
    monoTag: "PYMUPDF_NLP",
    desc: "Ingests standard PDF resumes via PyMuPDF, segmenting key sections (experience, projects, skills) and extracting validated technical keywords and competencies.",
    stat: "Automated entity extraction",
  },
  {
    icon: BarChart2,
    title: "4-Axis Rubric Evaluation",
    monoTag: "RUBRIC_EVAL",
    desc: "Evaluates candidate responses across four structured dimensions: Clarity, Structure, Technical Depth, and Relevance to provide specific, actionable feedback.",
    stat: "Clarity · Structure · Depth · Relevance",
  },
  {
    icon: GitBranch,
    title: "Session Management & Tracking",
    monoTag: "SESSION_TRACKING",
    desc: "Organize interview preparation across distinct sessions, retain your practice history, track score progressions, and refine responses iteratively.",
    stat: "Persistent preparation history",
  },
];

const PIPELINE_STEPS = [
  {
    step: "01",
    tag: "INGESTION",
    title: "PDF Text Extraction",
    desc: "Upload a standard PDF resume. PyMuPDF extracts raw text blocks, normalizes formatting, and isolates projects, experience, and competencies.",
  },
  {
    step: "02",
    tag: "EMBEDDING",
    title: "Vector Similarity Matching",
    desc: "Candidate skills are mapped to 384-dimensional vectors with Sentence-Transformers and queried against the FAISS index to find matched technical questions.",
  },
  {
    step: "03",
    tag: "EVALUATION",
    title: "Structured Rubric Scoring",
    desc: "Submit your technical explanation and receive instant feedback on clarity, structure, technical depth, and question relevance with strengths and improvement notes.",
  },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHeroTab, setActiveHeroTab] = useState("preview");

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent/20 selection:text-white">
      {/* ────────────────────────── Navigation ────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b ${
          scrolled
            ? "bg-background/90 backdrop-blur-md border-border/80 shadow-sm"
            : "bg-background/60 backdrop-blur-sm border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-8 w-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center font-mono font-bold text-accent group-hover:border-accent/50 transition-colors">
              <span className="text-sm tracking-tighter">V//</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold tracking-tight text-base text-foreground">
                VETTOR
              </span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-surface-2 border border-border">
                v2.4
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a
              href="#capabilities"
              className="hover:text-foreground transition-colors"
            >
              Capabilities
            </a>
            <a
              href="#pipeline"
              className="hover:text-foreground transition-colors"
            >
              Pipeline
            </a>
            <a
              href="#metrics"
              className="hover:text-foreground transition-colors"
            >
              Architecture
            </a>
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login">
              <Button
                variant="ghost"
                size="sm"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button
                size="sm"
                className="text-sm font-medium tracking-tight bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3.5 shadow-[0_0_14px_-2px_rgba(139,156,247,0.25)] transition-all"
              >
                Launch Workspace
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-muted-foreground hover:text-foreground focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-border bg-surface-1 px-6 py-4 space-y-3">
            <a
              href="#capabilities"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm text-muted-foreground hover:text-foreground py-1"
            >
              Capabilities
            </a>
            <a
              href="#pipeline"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm text-muted-foreground hover:text-foreground py-1"
            >
              Pipeline
            </a>
            <a
              href="#metrics"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm text-muted-foreground hover:text-foreground py-1"
            >
              Architecture
            </a>
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full text-xs">
                  Sign In
                </Button>
              </Link>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="w-full text-xs shadow-[0_0_12px_-2px_rgba(139,156,247,0.25)]">
                  Launch Workspace
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ────────────────────────── Hero Section ────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 px-6 overflow-hidden">
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[radial-gradient(ellipse_at_center,rgba(139,156,247,0.08),transparent_70%)] pointer-events-none blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto">
          {/* Top Pill */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex items-center justify-center md:justify-start"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface-1 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-foreground font-semibold font-mono">VETTOR 2.4</span>
              <span className="text-border">/</span>
              <span>FAISS Vector Pipeline Active</span>
            </div>
          </motion.div>

          {/* Heading & Subheading */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={getFadeUpWithDelay(0.08)}
              className="lg:col-span-7 space-y-6 text-center lg:text-left"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.08]">
                Analyze your resume.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-indigo-200 to-white">
                  Prepare for real technical interviews.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Vettor extracts your actual engineering skills, technologies, and project competencies — then uses semantic vector matching to retrieve relevant technical interview questions and grade your answers against structured rubrics.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
                <Link to="/signup">
                  <Button
                    size="lg"
                    className="h-12 px-6 rounded-md text-sm font-semibold tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_0_20px_-3px_rgba(139,156,247,0.3)] hover:shadow-[0_0_24px_-2px_rgba(139,156,247,0.4)]"
                  >
                    Analyze Your Resume
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>

                <a href="#pipeline">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-6 rounded-md text-sm border-border bg-surface-1 hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                  >
                    <Terminal className="w-4 h-4 mr-2 text-accent" />
                    Inspect Pipeline
                  </Button>
                </a>
              </div>

              {/* Technical trust badges */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Resume-Grounded Questions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-accent" />
                  <span>SBERT + FAISS Semantic Search</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-muted-foreground" />
                  <span>Structured 4-Axis Rubric Feedback</span>
                </div>
              </div>
            </motion.div>

            {/* Right: Technical Interactive Terminal Card with Ambient Glow */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={getFadeUpWithDelay(0.16)}
              className="lg:col-span-5 w-full relative"
            >
              {/* Subtle Lavender Radial Glow Behind Hero Preview */}
              <div className="absolute -inset-4 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgba(139,156,247,0.14),transparent_70%)] pointer-events-none rounded-2xl blur-xl" />

              <div className="relative rounded-xl border border-border bg-surface-1 shadow-2xl overflow-hidden text-xs">
                {/* Terminal header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2/60">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                      vettor://pipeline/matcher.py
                    </span>
                  </div>
                  <Badge variant="accent" size="sm">
                    LIVE_PIPELINE
                  </Badge>
                </div>

                {/* Subnav in terminal */}
                <div className="flex border-b border-border bg-surface-2/30 px-3">
                  <button
                    onClick={() => setActiveHeroTab("preview")}
                    className={`px-3 py-2 text-[11px] font-mono border-b-2 transition-colors ${
                      activeHeroTab === "preview"
                        ? "border-accent text-accent font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Matched Challenge
                  </button>
                  <button
                    onClick={() => setActiveHeroTab("skills")}
                    className={`px-3 py-2 text-[11px] font-mono border-b-2 transition-colors ${
                      activeHeroTab === "skills"
                        ? "border-accent text-accent font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Extracted Stack ({HERO_SKILLS.length})
                  </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  {activeHeroTab === "preview" ? (
                    <>
                      {/* Question Header */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-muted-foreground">
                          ID: <span className="text-foreground">{SAMPLE_QUESTION.id}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-mono text-[11px]">
                            {SAMPLE_QUESTION.similarity}
                          </span>
                          <Badge variant="hard" size="sm">
                            {SAMPLE_QUESTION.difficulty}
                          </Badge>
                        </div>
                      </div>

                      {/* Question text */}
                      <div className="p-3 rounded-lg border border-border bg-surface-2/50 text-foreground font-sans text-xs leading-relaxed">
                        {SAMPLE_QUESTION.text}
                      </div>

                      {/* Rubric metrics */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                          Evaluation Rubrics (0–10 Scoring)
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {SAMPLE_QUESTION.rubrics.map((rubric) => (
                            <div
                              key={rubric.label}
                              className="flex items-center justify-between p-2 rounded bg-surface-2/30 border border-border/50 text-[11px]"
                            >
                              <span className="text-muted-foreground font-sans">
                                {rubric.label}
                              </span>
                              <span className="text-accent font-mono font-semibold">
                                {rubric.score}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                        Extracted Technical Entities
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {HERO_SKILLS.map((s) => (
                          <div
                            key={s.name}
                            className="p-2 rounded border border-border bg-surface-2/40 flex items-center justify-between"
                          >
                            <span className="truncate text-foreground font-sans text-[11px] font-medium">
                              {s.name}
                            </span>
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {s.category}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Terminal footer status */}
                  <div className="pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      FAISS Index: 338 questions (all-MiniLM-L6-v2)
                    </span>
                    <span>Ready for input</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ────────────────────────── Architecture Metrics ────────────────────────── */}
      <section id="metrics" className="border-y border-border bg-surface-1/50 py-10 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="font-mono text-3xl font-bold tracking-tight text-foreground">
              384-dim
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-sans">
              SBERT Dense Vector Space
            </div>
          </div>
          <div>
            <div className="font-mono text-3xl font-bold tracking-tight text-foreground">
              338
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-sans">
              Curated Technical Questions Indexed
            </div>
          </div>
          <div>
            <div className="font-mono text-3xl font-bold tracking-tight text-foreground">
              4-Axis
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-sans">
              Structured Rubric Dimensions
            </div>
          </div>
          <div>
            <div className="font-mono text-3xl font-bold tracking-tight text-foreground">
              100%
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-sans">
              Resume-Grounded Matching
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────── Capabilities Bento ────────────────────────── */}
      <section id="capabilities" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl space-y-3">
            <Badge variant="accent">SYSTEM CAPABILITIES</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Engineered for genuine technical preparation.
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Instead of generic behavioral templates, Vettor reads your actual technical decisions and retrieves relevant engineering problem sets.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {CAPABILITIES.map((cap) => (
              <Card
                key={cap.title}
                className="border-border bg-surface-1 hover:border-accent/40 hover:shadow-[0_0_24px_-4px_rgba(139,156,247,0.12)] transition-all shadow-sm"
              >
                <CardContent className="p-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-10 w-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-accent">
                      <cap.icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest px-2 py-0.5 rounded bg-surface-2 border border-border">
                      {cap.monoTag}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-foreground tracking-tight font-sans">
                      {cap.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed font-sans">
                      {cap.desc}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono text-accent">
                    <span>{cap.stat}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────── Pipeline Workflow ────────────────────────── */}
      <section id="pipeline" className="border-t border-border bg-surface-1/40 py-24 px-6 relative">
        {/* Subtle Ambient Glow */}
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[250px] bg-[radial-gradient(ellipse_at_center,rgba(139,156,247,0.05),transparent_70%)] pointer-events-none blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl space-y-3">
            <Badge variant="default">PIPELINE WORKFLOW</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How Vettor operates.
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              From raw PDF bytes to structured technical challenges and actionable rubric evaluation.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {PIPELINE_STEPS.map((step) => (
              <div
                key={step.step}
                className="relative p-7 rounded-xl border border-border bg-surface-1 flex flex-col justify-between space-y-6 hover:border-accent/40 hover:shadow-[0_0_20px_-4px_rgba(139,156,247,0.1)] transition-all"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-bold text-accent">
                      {step.step}
                    </span>
                    <Badge variant="outline" size="sm">
                      {step.tag}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground tracking-tight font-sans">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-sans">
                    {step.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-border/60 flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Deterministic validation</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────── Final CTA ────────────────────────── */}
      <section className="border-t border-border py-20 px-6 bg-surface-1/30 relative">
        <div className="max-w-4xl mx-auto text-center space-y-6 p-10 md:p-14 rounded-2xl border border-border bg-surface-1 relative overflow-hidden shadow-lg">
          {/* Subtle Glow inside CTA card */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[350px] h-[150px] bg-[radial-gradient(ellipse_at_center,rgba(139,156,247,0.12),transparent_70%)] pointer-events-none blur-2xl" />

          <div className="space-y-3 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-surface-2 text-xs text-accent font-medium mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Get Started</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Ready to verify your interview readiness?
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
              Upload your resume in seconds. Discover what technical interview panels will ask based on your actual project experience.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 pt-2 relative z-10">
            <Link to="/signup">
              <Button
                size="lg"
                className="h-12 px-8 rounded-md text-sm font-semibold tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_-3px_rgba(139,156,247,0.3)] transition-all"
              >
                Launch Workspace
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ────────────────────────── Footer ────────────────────────── */}
      <footer className="border-t border-border bg-surface-1 py-12 px-6 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded bg-surface-2 border border-border flex items-center justify-center font-mono font-bold text-accent text-xs">
              V//
            </div>
            <span className="font-mono">VETTOR — Technical Resume Intelligence</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#capabilities" className="hover:text-foreground transition-colors">
              Capabilities
            </a>
            <a href="#pipeline" className="hover:text-foreground transition-colors">
              Pipeline
            </a>
            <a href="#metrics" className="hover:text-foreground transition-colors">
              Architecture
            </a>
            <Link to="/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
          </div>

          <div className="font-mono">© 2026 Vettor. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
