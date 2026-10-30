import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ThemeToggle from "@/components/ThemeToggle";
import { fadeUp, getFadeUpWithDelay, staggerContainer, viewportSettings } from "@/lib/motion";
import {
  ArrowRight,
  Sparkles,
  FileText,
  BrainCircuit,
  Upload,
  BarChart3,
  Trophy,
  Star,
  CheckCircle2,
  Quote,
  Zap,
  TrendingUp,
  Users,
  Shield,
  Clock,
  MessageSquare,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

/* ─────────────────────────── data ─────────────────────────── */

const FEATURES = [
  {
    icon: FileText,
    title: "Intelligent Resume Parsing",
    desc: "Our NLP engine extracts nuanced experience, identifying leadership markers and technical depth often missed by human readers.",
    color: "orange",
    number: "01",
    large: true,
  },
  {
    icon: BrainCircuit,
    title: "AI Question Engine",
    desc: "Generates situational, behavioral, and technical questions mapped to the job descriptions you're targeting.",
    color: "amber",
    badge: "Used by 10K+ candidates",
  },
  {
    icon: Users,
    title: "Personalized Prep",
    desc: "Every generated set comes with custom advice on how to bridge the gap between your current skills and role requirements.",
    color: "violet",
  },
  {
    icon: Zap,
    title: "Real-time Feedback",
    desc: "Get instant AI-driven scores on your mock answers based on STAR method criteria and relevance to the JD.",
    color: "rose",
  },
  {
    icon: TrendingUp,
    title: "Industry Networks",
    desc: "Data-driven insights from successful candidates at Stripe, Airbnb, Google, and more top companies.",
    color: "teal",
  },
];

const STEPS = [
  {
    icon: Upload,
    title: "Upload Your Profile",
    desc: "Sync your LinkedIn profile or drop your latest resume. Our system reads between the lines to find your hidden strengths.",
    tags: ["PDF", "DOCX", "LinkedIn"],
  },
  {
    icon: BarChart3,
    title: "Contextual Analysis",
    desc: "We match your experience against current market trends and specific company interview patterns to identify likely topics.",
    stat: "500+ Company Patterns",
  },
  {
    icon: Trophy,
    title: "Simulate & Conquer",
    desc: "Receive a curated list of high-probability questions with suggested talking points to refine your delivery.",
    stat: "92% Success Rate",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Interview Buddy accurately predicted 4 out of the 5 behavioral questions I was asked at Google. It's like having a cheat code for high-level interviews.",
    name: "Sarah Chen",
    role: "Senior PM, Google",
    initials: "SC",
  },
  {
    quote:
      "The insights into my 'technical gaps' based on my resume were spot on. I spent my prep time fixing exactly what needed fixing instead of guessing.",
    name: "Marcus Johnson",
    role: "Full Stack Dev, Stripe",
    initials: "MJ",
  },
  {
    quote:
      "Transitioning from military to tech was daunting. This tool translated my skills into questions that tech recruiters actually ask. Landed my role at Airbnb!",
    name: "David Lee",
    role: "Operations Lead, Airbnb",
    initials: "DL",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "₹0",
    desc: "Perfect for exploring",
    cta: "Get Started Free",
    featured: false,
    features: [
      { text: "3 Resume Uploads", included: true },
      { text: "10 AI Questions / Session", included: true },
      { text: "Basic Feedback", included: true },
      { text: "Company-Specific Patterns", included: false },
    ],
  },
  {
    name: "Pro",
    price: "₹49",
    desc: "For serious job seekers",
    cta: "Start Pro Trial",
    featured: true,
    features: [
      { text: "Unlimited Uploads", included: true },
      { text: "Unlimited AI Questions", included: true },
      { text: "STAR Method Scoring", included: true },
      { text: "Company-Specific Patterns", included: true },
      { text: "Priority Support", included: true },
    ],
  },
  {
    name: "Enterprise",
    price: "₹449",
    desc: "For teams & bootcamps",
    cta: "Contact Sales",
    featured: false,
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Team Analytics", included: true },
      { text: "Custom AI Training", included: true },
      { text: "API Access", included: true },
      { text: "Dedicated Support", included: true },
    ],
  },
];

const STATS = [
  { value: "25K+", label: "Active Users" },
  { value: "92%", label: "Success Rate" },
  { value: "500+", label: "Companies Covered" },
  { value: "4.9★", label: "User Rating" },
];

const COMPANIES = ["Google", "Stripe", "Airbnb", "Meta", "Amazon", "Netflix"];

/* ─────────────── tiny reusable components ─────────────── */

function SectionBadge({ icon: Icon, text }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium tracking-wide">
      <Icon className="w-4 h-4" />
      {text}
    </div>
  );
}

function SectionHeading({ badge, badgeIcon, title, highlight, description }) {
  return (
    <div className="text-center mb-16 space-y-4">
      <SectionBadge icon={badgeIcon} text={badge} />
      <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-secondary-foreground">
        {title}{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">
          {highlight}
        </span>
      </h2>
      {description && (
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────── Main component ─────────────────────── */

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-foreground font-sans selection:bg-primary/20 overflow-x-hidden">

      {/* ═══════════════════ NAVIGATION ═══════════════════ */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg shadow-black/[0.03]"
            : "bg-white/70 dark:bg-slate-900/70 backdrop-blur-md"
        } border-b border-border/40 dark:border-slate-700/40`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-8 h-16 md:h-20">
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-secondary-foreground"
          >
            <BrainCircuit className="w-7 h-7 text-primary" />
            Interview Buddy
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-primary transition-colors">How It Works</a>
            <a href="#testimonials" className="hover:text-primary transition-colors">Testimonials</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <Link to="/login" className="text-sm font-medium hover:text-primary transition-colors">
              Sign In
            </Link>
            <Link to="/signup">
              <Button className="rounded-full shadow-lg shadow-primary/20 transition-transform active:scale-95">
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-secondary-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/40 dark:border-slate-700/40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-6 pb-6 space-y-4">
            <a href="#features" className="block py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#testimonials" className="block py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileMenuOpen(false)}>Testimonials</a>
            <a href="#pricing" className="block py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <div className="flex gap-3 pt-2">
              <div className="flex-1">
                <ThemeToggle />
              </div>
              <Link to="/login" className="flex-1">
                <Button variant="outline" className="w-full rounded-full">Sign In</Button>
              </Link>
              <Link to="/signup" className="flex-1">
                <Button className="w-full rounded-full">Get Started</Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════════════ HERO SECTION ═══════════════════ */}
      <motion.section
        className="pt-32 md:pt-40 pb-16 px-6 lg:px-8"
        initial="hidden"
        whileInView="visible"
        viewport={viewportSettings}
        variants={fadeUp}
      >
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          {/* Left — copy */}
          <div className="flex-1 text-center lg:text-left space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium tracking-wide">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>AI-Powered Interview Prep</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-secondary-foreground leading-[1.1]">
              Ace Your Interviews with{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">
                AI-Powered Questions
              </span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Transform your resume into a personalized interview simulation.
              Our AI analyzes your professional history to generate high-impact
              questions tailored to your career path.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 justify-center lg:justify-start">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="rounded-full text-base h-14 px-8 shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
                >
                  Start Practice Free <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full text-base h-14 px-8 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm"
              >
                View Demo
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-6 pt-2 justify-center lg:justify-start text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-primary" /> 25K+ Users
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-primary fill-primary" /> 4.9 Rating
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary" /> SOC 2 Compliant
              </span>
            </div>
          </div>

          {/* Right — Dashboard Mockup */}
          <div className="flex-1 w-full relative">
            <div className="absolute -inset-8 bg-gradient-to-br from-orange-200/30 to-amber-200/20 blur-3xl rounded-full pointer-events-none" />
            <div className="relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-border/50 dark:border-slate-700/50 rounded-2xl shadow-2xl shadow-orange-900/10 p-4 animate-float">
              <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-border/30 dark:border-slate-700/30">
                <div className="flex h-[380px]">
                  {/* Sidebar */}
                  <div className="w-14 bg-muted/60 dark:bg-slate-700/60 flex flex-col items-center py-5 gap-5 border-r border-border/30 dark:border-slate-700/30">
                    <BrainCircuit className="w-5 h-5 text-primary" />
                    <Sparkles className="w-5 h-5 text-muted-foreground/40" />
                    <FileText className="w-5 h-5 text-muted-foreground/40" />
                    <Clock className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                  {/* Content */}
                  <div className="flex-1 p-6 space-y-5">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-primary font-bold">
                          Current Session
                        </p>
                        <h3 className="text-lg font-bold tracking-tight">
                          Senior Product Designer
                        </h3>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold">
                        JD
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 p-3.5 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            AI Analysis
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed">
                          Your tone was 84% more confident. Focus on your "Why".
                        </p>
                      </div>
                      <div className="bg-muted/50 p-3.5 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Avg Response
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed">
                          2m 45s — ideal for system design rounds.
                        </p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-border/30 dark:border-slate-600/30 flex items-center gap-4">
                      <div className="w-1.5 h-10 bg-primary rounded-full shrink-0" />
                      <p className="text-sm italic">
                        "Tell me about a time you had to pivot based on
                        conflicting data..."
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════ TRUSTED BY + STATS ═══════════════════ */}
      <motion.section
        className="py-20 px-6 lg:px-8"
        initial="hidden"
        whileInView="visible"
        viewport={viewportSettings}
        variants={fadeUp}
      >
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Company logos */}
          <div className="text-center space-y-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
              Trusted by professionals from leading companies
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-14 opacity-30">
              {COMPANIES.map((c) => (
                <span
                  key={c}
                  className="text-2xl font-bold text-secondary-foreground"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
          {/* Stats */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
            variants={staggerContainer}
          >
            {STATS.map((s, index) => (
              <motion.div key={s.label} variants={getFadeUpWithDelay(index * 0.06)}>
                <Card className="text-center bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="py-6 px-4">
                    <p className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">
                      {s.value}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">{s.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ═══════════════════ FEATURES ═══════════════════ */}
      <motion.section
        id="features"
        className="py-20 px-6 lg:px-8"
        initial="hidden"
        whileInView="visible"
        viewport={viewportSettings}
        variants={fadeUp}
      >
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="Features"
            badgeIcon={Sparkles}
            title="Precision-Engineered"
            highlight="Prep"
            description="Forget generic interview tips. Get surgical accuracy with AI that understands your unique professional journey."
          />

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Large card */}
            <Card className="md:col-span-7 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 group overflow-hidden relative">
              <CardHeader className="p-8 md:p-10 space-y-4">
                <span className="text-5xl font-extrabold text-primary/10">01</span>
                <CardTitle className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  {FEATURES[0].title}
                </CardTitle>
                <CardDescription className="text-base max-w-sm leading-relaxed">
                  {FEATURES[0].desc}
                </CardDescription>
                <button className="inline-flex items-center gap-2 text-primary font-semibold text-sm pt-4 group/btn">
                  Learn More
                  <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                </button>
              </CardHeader>
              <div className="absolute -bottom-12 -right-12 w-60 h-60 bg-orange-200/30 rounded-full blur-3xl transition-transform duration-700 group-hover:scale-150 pointer-events-none" />
            </Card>

            {/* Medium card */}
            <Card className="md:col-span-5 bg-gradient-to-br from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20 border-border/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 text-center">
              <CardContent className="p-8 md:p-10 flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 animate-pulse-slow">
                  <BrainCircuit className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-extrabold tracking-tight">{FEATURES[1].title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{FEATURES[1].desc}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-xs font-bold text-primary">
                  <Users className="w-4 h-4" /> {FEATURES[1].badge}
                </span>
              </CardContent>
            </Card>

            {/* Three small cards */}
            {FEATURES.slice(2).map((f, i) => (
              <Card
                key={f.title}
                className="md:col-span-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <CardHeader className="p-6 md:p-8 space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <f.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-bold">{f.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}

            {/* Wide testimonial card */}
            <Card className="md:col-span-12 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center">
                <img
                  alt="Professional using Interview Buddy"
                  className="w-full md:w-48 h-48 object-cover rounded-xl shadow-lg"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJ3wawPJBsu6sqU3A-WA1Vus6leWreh0k54SMOcLdiCCtzpNkibN8S1QKvjhED-3aeayatRa25F9jct9E9vCEl-yeXnvymMMp8BlZU-u81VEe2jKbTf-AX77u8V2zubNbnzWSVcDweW7E1r1faaWVoX51oDi_LbQHVn_2oxSXxpf5mNuAK-z_34QT9cOTzhHBpagjeTB_yl8Wo2O23nLeue7Mt_j-oIRuFopXj80LIRA4YzoDGqPqr49UD__kzC8OPwhBDlTkIEqBA"
                />
                <div className="space-y-4">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-primary fill-primary" />
                    ))}
                  </div>
                  <blockquote className="text-lg italic font-medium leading-relaxed">
                    "Interview Buddy transformed how I approach system design. It
                    felt like practicing with a real mentor who knows the exact
                    questions companies ask."
                  </blockquote>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    — Sarah Jenkins, Staff Engineer at Google
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <motion.section
        id="how-it-works"
        className="py-20 px-6 lg:px-8 bg-muted/30 dark:bg-slate-950"
        initial="hidden"
        whileInView="visible"
        viewport={viewportSettings}
        variants={fadeUp}
      >
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="How It Works"
            badgeIcon={Zap}
            title="The Interview Buddy"
            highlight="Process"
            description="Three simple steps from resume to interview mastery. Our AI handles the complexity so you can focus on acing your interview."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-[4.5rem] left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-primary/5 via-primary/20 to-primary/5 z-0" />

            {STEPS.map((step, i) => (
              <Card
                key={step.title}
                className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden text-center z-10"
              >
                <CardContent className="p-8 space-y-5">
                  {/* Step number watermark */}
                  <span className="absolute top-6 right-6 text-7xl font-extrabold text-primary/[0.04] pointer-events-none leading-none">
                    0{i + 1}
                  </span>

                  <div className="relative z-10 w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 transition-shadow hover:shadow-xl hover:shadow-orange-500/30">
                    <step.icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-xl font-bold tracking-tight">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>

                  {/* Bottom extras */}
                  {step.tags && (
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      {step.tags.map((t) => (
                        <span
                          key={t}
                          className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {step.stat && (
                    <div className="flex items-center justify-center gap-2 pt-2 text-xs font-bold text-primary">
                      <TrendingUp className="w-4 h-4" /> {step.stat}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════ TESTIMONIALS ═══════════════════ */}
      <motion.section
        id="testimonials"
        className="py-20 px-6 lg:px-8"
        initial="hidden"
        whileInView="visible"
        viewport={viewportSettings}
        variants={fadeUp}
      >
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="Testimonials"
            badgeIcon={MessageSquare}
            title="Trusted by"
            highlight="High-Performers"
            description="See how Interview Buddy has helped professionals land roles at top-tier companies."
          />

          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6" variants={staggerContainer}>
            {TESTIMONIALS.map((t) => (
              <motion.div key={t.name} variants={fadeUp}>
                <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 overflow-hidden relative">
                  <CardContent className="p-8 space-y-5 relative">
                    {/* Watermark */}
                    <Quote className="absolute top-4 right-4 w-16 h-16 text-primary/[0.06] pointer-events-none" />

                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-primary fill-primary" />
                      ))}
                    </div>

                    <p className="text-sm leading-relaxed relative z-10">"{t.quote}"</p>

                    <div className="flex items-center gap-3 pt-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                        {t.initials}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ═══════════════════ PRICING ═══════════════════ */}
      <motion.section
        id="pricing"
        className="py-20 px-6 lg:px-8 bg-muted/30 dark:bg-slate-950"
        initial="hidden"
        whileInView="visible"
        viewport={viewportSettings}
        variants={fadeUp}
      >
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="Pricing"
            badgeIcon={Zap}
            title="Simple, Transparent"
            highlight="Pricing"
            description="Start for free. Upgrade when you need more power."
          />

          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto" variants={staggerContainer}>
            {PRICING.map((plan, index) => (
              <motion.div key={plan.name} variants={getFadeUpWithDelay(index * 0.08)}>
                <Card
                  className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                    plan.featured
                      ? "bg-secondary-foreground text-secondary shadow-2xl shadow-primary/20 ring-2 ring-primary"
                      : "bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-border/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl"
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 translate-y-0 px-4 py-1 bg-gradient-to-r from-orange-500 to-amber-600 rounded-b-lg text-white text-xs font-bold uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}
                  <CardContent className="p-8 space-y-6">
                    <div className="space-y-1 pt-2">
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      <p className={`text-sm ${plan.featured ? "text-secondary/60" : "text-muted-foreground"}`}>
                        {plan.desc}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-extrabold">{plan.price}</span>
                      <span className={`text-sm ${plan.featured ? "text-secondary/60" : "text-muted-foreground"}`}>
                        /month
                      </span>
                    </div>

                    {plan.featured ? (
                      <Button className="w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700 shadow-lg">
                        {plan.cta}
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full rounded-full">
                        {plan.cta}
                      </Button>
                    )}

                    <ul className="space-y-3">
                      {plan.features.map((f) => (
                        <li key={f.text} className="flex items-center gap-3 text-sm">
                          {f.included ? (
                            <CheckCircle2
                              className={`w-5 h-5 shrink-0 ${
                                plan.featured ? "text-amber-400" : "text-primary"
                              }`}
                            />
                          ) : (
                            <X className="w-5 h-5 shrink-0 text-muted-foreground/30" />
                          )}
                          <span className={!f.included ? "text-muted-foreground/40" : ""}>{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ═══════════════════ CTA ═══════════════════ */}
      <motion.section
        className="py-8 px-6 lg:px-8"
        initial="hidden"
        whileInView="visible"
        viewport={viewportSettings}
        variants={fadeUp}
      >
        <div className="max-w-7xl mx-auto rounded-3xl overflow-hidden relative bg-secondary-foreground text-secondary py-20 md:py-28 px-8 text-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/20 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-bl from-amber-500/10 to-transparent pointer-events-none" />
          <div className="relative z-10 space-y-6 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Ready to Master Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                Next Interview?
              </span>
            </h2>
            <p className="text-secondary/70 text-lg leading-relaxed">
              Join over 25,000 professionals who have used Interview Buddy to
              secure their dream roles. Your journey to the next level begins
              here.
            </p>
            <div className="pt-6">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="rounded-full text-lg h-16 px-10 bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700 shadow-2xl shadow-orange-500/30 transition-all hover:-translate-y-0.5 active:scale-95"
                >
                  Create Your Free Profile <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
            <p className="text-secondary/40 text-xs pt-4">
              No credit card required · 14-day free trial · Cancel anytime
            </p>
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="border-t border-border/40 dark:border-slate-700/40 py-16 md:py-20 px-6 md:px-8 bg-[#fdfcfb] dark:bg-slate-950">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12 md:gap-0">
          {/* Brand */}
          <div className="space-y-5 max-w-xs">
            <Link
              to="/"
              className="flex items-center gap-2 text-xl font-bold tracking-tight text-secondary-foreground"
            >
              <BrainCircuit className="w-7 h-7 text-primary" />
              Interview Buddy
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your AI-powered interview preparation partner. Transform your
              resume into personalized interview simulations.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 md:gap-16">
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Platform</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
                <li><Link to="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link></li>
                <li><a href="#pricing" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">API</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Company</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Legal</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Data Security</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-border/40 dark:border-slate-700/40 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground/50">
            © 2026 Interview Buddy. All rights reserved.
          </p>
          <div className="flex gap-6">
            {["Legal", "Privacy", "Support", "API"].map((l) => (
              <a
                key={l}
                href="#"
                className="text-xs uppercase tracking-[0.15em] text-muted-foreground/50 hover:text-primary transition-colors"
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
