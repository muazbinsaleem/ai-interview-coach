"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SessionSetup } from "@/components/interview/SessionSetup";
import { RiCodeSSlashLine, RiBrainLine, RiMicLine, RiArrowRightLine, RiStarLine } from "react-icons/ri";

/* ─── Animated grid background ─── */
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.04]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" className="text-[var(--text-primary)]" />
      </svg>
      {/* Radial fade mask */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,transparent_40%,var(--bg-base)_100%)]" />
    </div>
  );
}

/* ─── Floating orbs ─── */
function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)",
          top: "-10%",
          left: "-5%",
        }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
          top: "20%",
          right: "-8%",
        }}
        animate={{ x: [0, -30, 0], y: [0, 50, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)",
          bottom: "5%",
          left: "30%",
        }}
        animate={{ x: [0, 20, 0], y: [0, -25, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 6 }}
      />
    </div>
  );
}

/* ─── Animated counter ─── */
function AnimatedCounter({ target, duration = 2 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          let start = 0;
          const step = target / (duration * 60);
          const timer = setInterval(() => {
            start += step;
            if (start >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(start));
            }
          }, 1000 / 60);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

/* ─── Typewriter headline ─── */
const WORDS = ["Frontend Dev", "Backend Dev", "Data Engineer", "Full-Stack Dev", "ML Engineer"];

function TypewriterWord() {
  const [idx, setIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = WORDS[idx];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && displayed.length < word.length) {
      timeout = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), 80);
    } else if (!deleting && displayed.length === word.length) {
      timeout = setTimeout(() => setDeleting(true), 1800);
    } else if (deleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 45);
    } else if (deleting && displayed.length === 0) {
      setDeleting(false);
      setIdx((i) => (i + 1) % WORDS.length);
    }
    return () => clearTimeout(timeout);
  }, [displayed, deleting, idx]);

  return (
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60a5fa] via-[#818cf8] to-[#2563EB] inline-block min-w-[260px]">
      {displayed}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
        className="text-[#60a5fa]"
      >
        |
      </motion.span>
    </span>
  );
}

/* ─── Stat card ─── */
function StatCard({ value, label, accent }: { value: React.ReactNode; label: string; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="flex flex-col items-center gap-1"
    >
      <span className="text-3xl font-bold" style={{ color: accent }}>{value}</span>
      <span className="text-xs text-[var(--text-muted)] uppercase tracking-widest">{label}</span>
    </motion.div>
  );
}

/* ─── Feature card ─── */
function FeatureCard({
  icon,
  title,
  description,
  accentColor,
  glowColor,
  delay,
  tag,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
  glowColor: string;
  delay: number;
  tag?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className="group relative"
    >
      {/* Glow on hover */}
      <div
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
        style={{ background: `radial-gradient(circle at 50% 0%, ${glowColor}, transparent 70%)` }}
      />
      <Card glow className="relative h-full flex flex-col gap-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 z-10">
        {/* Top shimmer line */}
        <div
          className="absolute top-0 left-0 w-full h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
        />

        {/* Icon */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${glowColor}`, color: accentColor }}
        >
          {icon}
        </div>

        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
          {tag && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
              style={{ background: `${glowColor}`, color: accentColor }}
            >
              {tag}
            </span>
          )}
        </div>

        <p className="text-sm text-[var(--text-secondary)] leading-relaxed flex-1">{description}</p>

        <div className="flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ color: accentColor }}>
          Learn more <RiArrowRightLine className="w-3.5 h-3.5" />
        </div>
      </Card>
    </motion.div>
  );
}

/* ─── Step item ─── */
function StepItem({ step, title, desc, isLast }: { step: number; title: string; desc: string; isLast: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: step * 0.15 }}
      className="flex gap-5 relative"
    >
      {/* Vertical connector */}
      {!isLast && (
        <div className="absolute left-5 top-12 bottom-0 w-px bg-gradient-to-b from-[var(--border)] to-transparent" />
      )}
      {/* Circle */}
      <motion.div
        whileHover={{ scale: 1.15 }}
        className="relative z-10 w-10 h-10 shrink-0 rounded-full border-2 border-[#2563EB] bg-[rgba(37,99,235,0.08)] flex items-center justify-center text-sm font-bold text-[#60a5fa]"
      >
        {step}
        <div className="absolute inset-0 rounded-full animate-ping bg-[#2563EB] opacity-10" />
      </motion.div>
      <div className="pb-10">
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs">{desc}</p>
      </div>
    </motion.div>
  );
}

/* ─── Main page ─── */
export default function HomePage() {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  function handleStart(config: {
    role: string;
    difficulty: string;
    voiceMode: boolean;
    narrateQuestions: boolean;
    useResumeSkills?: boolean;
    skills?: string[];
  }) {
    if (typeof window !== "undefined") {
      const sessionConfig = {
        role: config.role,
        difficulty: config.difficulty,
        voiceMode: config.voiceMode,
        narrateQuestions: config.narrateQuestions,
        useResumeSkills: config.useResumeSkills || false,
        skills: config.useResumeSkills ? (config.skills || []) : [],
      };
      console.log("💾 Saving interview config:", {
        role: sessionConfig.role,
        useResumeSkills: sessionConfig.useResumeSkills,
        skillsCount: sessionConfig.skills?.length || 0,
      });
      localStorage.setItem("interview_config", JSON.stringify(sessionConfig));
    }
    router.push("/interview");
  }

  function scrollToFeatures() {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      <Header />

      <main className="flex-1 flex flex-col items-center">

        {/* ══ SECTION 1 — HERO ══ */}
        <section
          ref={heroRef}
          className="relative w-full min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-20 flex-col pt-32 pb-32 overflow-hidden"
        >
          <GridBackground />
          <FloatingOrbs />

          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center text-center"
          >
            {/* Pill badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mb-8 flex items-center gap-2 rounded-full border border-[rgba(37,99,235,0.3)] bg-[rgba(37,99,235,0.07)] px-4 py-1.5 text-xs font-medium text-[#60a5fa]"
            >
              <RiStarLine className="w-3.5 h-3.5 text-[#f59e0b]" />
              <span>AI-powered mock interviews · Get hired faster</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-[64px] font-extrabold tracking-tight text-[var(--text-primary)] leading-[1.08] mb-4 max-w-3xl"
            >
              Land your dream job
              <br />
              as a{" "}
              <TypewriterWord />
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.25 }}
              className="text-lg text-[var(--text-secondary)] leading-relaxed max-w-xl mx-auto mb-10"
            >
              Practice with role-specific questions, get instant expert feedback,
              and track your improvement — all powered by real AI evaluation.
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.35 }}
              className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-16"
            >
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button
                  variant="primary"
                  size="lg"
                  className="relative w-full sm:w-auto text-base px-8 h-12 overflow-hidden group"
                  onClick={() => document.getElementById("setup")?.scrollIntoView({ behavior: "smooth" })}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Start Practicing
                    <RiArrowRightLine className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  {/* Shimmer sweep */}
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full sm:w-auto text-base px-8 h-12"
                  onClick={scrollToFeatures}
                >
                  See How It Works
                </Button>
              </motion.div>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.55 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["AJ", "MK", "SR", "TL"].map((initials, i) => (
                    <motion.div
                      key={initials}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + i * 0.08 }}
                      className="w-8 h-8 rounded-full border-2 border-[var(--bg-base)] flex items-center justify-center text-[10px] font-bold text-white shadow-md"
                      style={{
                        background: ["#2563EB", "#16a34a", "#f59e0b", "#8b5cf6"][i],
                        zIndex: 30 - i * 10,
                      }}
                    >
                      {initials}
                    </motion.div>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">
                    <AnimatedCounter target={2400} />+
                  </span>{" "}
                  sessions completed
                </div>
              </div>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <motion.svg
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 + i * 0.06 }}
                    className="w-4 h-4 text-[#f59e0b]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </motion.svg>
                ))}
                <span className="ml-1.5 text-xs text-[var(--text-muted)]">4.9/5 from 300+ reviews</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-5 h-8 rounded-full border border-[var(--border)] flex items-start justify-center pt-1.5"
            >
              <div className="w-1 h-1.5 rounded-full bg-[var(--text-muted)]" />
            </motion.div>
          </motion.div>
        </section>

        {/* ══ STATS BAND ══ */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="w-full border-y border-[var(--border-subtle)] bg-[var(--bg-surface)] py-10"
        >
          <div className="max-w-3xl mx-auto px-4 grid grid-cols-3 gap-6 divide-x divide-[var(--border-subtle)]">
            <StatCard value={<><AnimatedCounter target={2400} />+</>} label="Sessions" accent="#60a5fa" />
            <StatCard value={<><AnimatedCounter target={98} />%</>} label="Satisfaction" accent="#34d399" />
            <StatCard value={<><AnimatedCounter target={3} />x</>} label="Faster Prep" accent="#a78bfa" />
          </div>
        </motion.section>

        {/* ══ SECTION 2 — FEATURES ══ */}
        <section id="features" className="w-full max-w-6xl mx-auto px-4 py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs font-semibold text-[#60a5fa] uppercase tracking-[0.2em] mb-3">Why InterviewAI</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] tracking-tight mb-4">
              Everything you need to succeed
            </h2>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
              A comprehensive practice environment engineered to simulate real-world technical interviews at top companies.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <FeatureCard
              icon={<RiCodeSSlashLine className="w-7 h-7" />}
              title="Role-Specific Questions"
              description="Tailored question banks for Frontend, Backend, and Data roles across all seniority levels, from Junior to Senior."
              accentColor="#60a5fa"
              glowColor="rgba(37,99,235,0.1)"
              delay={0}
              tag="New"
            />
            <FeatureCard
              icon={<RiBrainLine className="w-7 h-7" />}
              title="Real AI Evaluation"
              description="Every answer is evaluated by AI. Get a score, detailed feedback on strengths and weaknesses, and a model answer instantly."
              accentColor="#a78bfa"
              glowColor="rgba(139,92,246,0.1)"
              delay={0.1}
            />
            <FeatureCard
              icon={<RiMicLine className="w-7 h-7" />}
              title="Voice Practice Mode"
              description="Answer with your voice. Questions are narrated aloud. Practice like it's a real interview, not just a typing test."
              accentColor="#34d399"
              glowColor="rgba(16,185,129,0.1)"
              delay={0.2}
              tag="Beta"
            />
          </div>
        </section>

        {/* ══ SECTION 3 — HOW IT WORKS ══ */}
        <section className="w-full bg-[var(--bg-surface)] border-y border-[var(--border-subtle)] py-28">
          <div className="max-w-5xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              {/* Left: heading + steps */}
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="mb-12"
                >
                  <p className="text-xs font-semibold text-[#60a5fa] uppercase tracking-[0.2em] mb-3">Process</p>
                  <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] tracking-tight">
                    Three steps to interview confidence
                  </h2>
                </motion.div>

                {[
                  { title: "Configure Session", desc: "Select your role, difficulty level, and enable voice mode if desired." },
                  { title: "Answer Questions", desc: "Respond to 5 tailored technical questions via text or voice recording." },
                  { title: "Review Feedback", desc: "Get an instant score, strengths, areas to improve, and a model answer." },
                ].map((item, i) => (
                  <StepItem key={i} step={i + 1} title={item.title} desc={item.desc} isLast={i === 2} />
                ))}
              </div>

              {/* Right: decorative visual */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="hidden md:flex items-center justify-center"
              >
                <div className="relative w-[300px] h-[360px]">
                  {/* Animated score circle */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0"
                  >
                    <svg viewBox="0 0 300 300" className="w-full h-full opacity-20">
                      <circle cx="150" cy="150" r="140" fill="none" stroke="url(#grad1)" strokeWidth="1" strokeDasharray="6 12" />
                      <defs>
                        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#2563EB" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </motion.div>

                  {/* Center card */}
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-8 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl flex flex-col items-center justify-center gap-4 p-6"
                  >
                    <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-[#60a5fa] to-[#2563EB]">
                      92
                    </div>
                    <div className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-medium">AI Score</div>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`h-1.5 w-6 rounded-full ${i < 4 ? "bg-[#2563EB]" : "bg-[var(--border)]"}`} />
                      ))}
                    </div>
                    <p className="text-xs text-center text-[var(--text-secondary)] leading-relaxed">
                      Strong answer with clear examples. Consider mentioning edge cases.
                    </p>
                  </motion.div>

                  {/* Floating chips */}
                  {[
                    { label: "✓ Strength", color: "#34d399", x: "-60px", y: "20px" },
                    { label: "↑ Improve", color: "#f59e0b", x: "220px", y: "80px" },
                    { label: "★ Model", color: "#a78bfa", x: "-40px", y: "240px" },
                  ].map((chip) => (
                    <motion.div
                      key={chip.label}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, ease: "easeInOut", delay: Math.random() * 2 }}
                      className="absolute text-[10px] font-semibold px-3 py-1.5 rounded-full border shadow-lg"
                      style={{
                        left: chip.x,
                        top: chip.y,
                        color: chip.color,
                        borderColor: `${chip.color}40`,
                        background: `${chip.color}12`,
                      }}
                    >
                      {chip.label}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ══ SECTION 4 — SESSION SETUP ══ */}
        <section id="setup" className="w-full max-w-lg mx-auto px-4 py-32 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <div className="text-center mb-10">
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-xs font-semibold text-[#60a5fa] uppercase tracking-[0.2em] mb-3"
              >
                Ready?
              </motion.p>
              <h2 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
                Start your session
              </h2>
            </div>
            <SessionSetup onStart={handleStart} />
          </motion.div>
        </section>
      </main>

      {/* ══ FOOTER ══ */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            © {new Date().getFullYear()} InterviewAI 
          </p>
        </div>
      </footer>
    </div>
  );
}