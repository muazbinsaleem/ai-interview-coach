"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/auth";
import { apiUploadResume, BackendResumeResult } from "@/lib/api";
import {
  RiUploadCloud2Line,
  RiFileTextLine,
  RiCheckLine,
  RiCloseLine,
  RiCodeSSlashLine,
  RiDatabaseLine,
  RiBarChart2Line,
  RiBrainLine,
  RiMicLine,
  RiVolumeUpLine,
} from "react-icons/ri";

const SKILL_TOPIC_MAP: Record<string, string> = {
  React: "React Performance & Hooks",
  "Next.js": "SSR vs SSG in Next.js",
  TypeScript: "TypeScript Generics",
  JavaScript: "JavaScript Event Loop",
  CSS: "CSS Layout & Specificity",
  SQL: "SQL Window Functions",
  Python: "Python Async Programming",
  "Node.js": "Node.js Middleware",
  FastAPI: "FastAPI Dependency Injection",
  Django: "Django ORM Optimization",
  PostgreSQL: "PostgreSQL Index Strategy",
  MongoDB: "NoSQL vs SQL Trade-offs",
  Docker: "Docker Containerisation",
  Kubernetes: "Kubernetes Scaling",
  AWS: "AWS System Design",
  Git: "Git Branching Strategies",
  "Machine Learning": "ML Model Evaluation",
  pandas: "pandas vs SQL Scalability",
  "Data Analysis": "A/B Testing & p-values",
};

function getSuggestedTopics(skills: string[]): string[] {
  const topics: string[] = [];
  for (const skill of skills) {
    const match = Object.keys(SKILL_TOPIC_MAP).find((k) =>
      skill.toLowerCase().includes(k.toLowerCase())
    );
    if (match && !topics.includes(SKILL_TOPIC_MAP[match])) {
      topics.push(SKILL_TOPIC_MAP[match]);
    }
  }
  return topics.slice(0, 6);
}

function suggestRole(skills: string[]): string {
  const lower = skills.map((s) => s.toLowerCase()).join(" ");
  const frontendScore =
    (lower.includes("react") ? 3 : 0) +
    (lower.includes("next") ? 2 : 0) +
    (lower.includes("css") ? 1 : 0) +
    (lower.includes("javascript") ? 2 : 0) +
    (lower.includes("typescript") ? 1 : 0);
  const backendScore =
    (lower.includes("node") ? 3 : 0) +
    (lower.includes("python") ? 2 : 0) +
    (lower.includes("fastapi") ? 2 : 0) +
    (lower.includes("django") ? 2 : 0) +
    (lower.includes("api") ? 1 : 0) +
    (lower.includes("docker") ? 1 : 0);
  const dataScore =
    (lower.includes("sql") ? 2 : 0) +
    (lower.includes("pandas") ? 3 : 0) +
    (lower.includes("machine learning") ? 3 : 0) +
    (lower.includes("data") ? 2 : 0) +
    (lower.includes("tableau") ? 2 : 0);

  const max = Math.max(frontendScore, backendScore, dataScore);
  if (max === 0) return "software engineer";
  if (max === frontendScore) return "software engineer";
  if (max === backendScore) return "devops engineer";
  return "data scientist";
}

function RoleIcon({ role }: { role: string }) {
  if (role === "software engineer" || role === "devops engineer")
    return <RiCodeSSlashLine className="w-5 h-5" />;
  if (role === "data scientist")
    return <RiBarChart2Line className="w-5 h-5" />;
  return <RiDatabaseLine className="w-5 h-5" />;
}

function UploadZone({
  onFile,
  loading,
}: {
  onFile: (f: File) => void;
  loading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.type === "application/pdf") onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      className={`
        relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed
        p-10 sm:p-14 text-center cursor-pointer transition-all duration-200
        ${dragging
          ? "border-[#2563EB] bg-[#2563EB]/5 scale-[1.01]"
          : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[#2563EB]/60 hover:bg-[var(--bg-elevated)]"
        }
        ${loading ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />

      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors
        ${dragging ? "bg-[#2563EB]/20 text-[#60a5fa]" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>
        <RiUploadCloud2Line className="w-8 h-8" />
      </div>

      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">
          {dragging ? "Drop your PDF here" : "Drag & drop your resume"}
        </p>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          or <span className="text-[#60a5fa] font-medium">click to browse</span> — PDF only, max 10 MB
        </p>
      </div>
    </div>
  );
}

export default function ResumePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BackendResumeResult | null>(null);

  useEffect(() => {
    if (!auth.isAuthenticated()) router.replace("/login");
  }, [router]);

  async function handleUpload() {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large. Maximum size is 10 MB.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await apiUploadResume(file);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setResult(null);
    setError("");
  }

  const suggestedRole = result ? suggestRole(result.skills) : null;
  const suggestedTopics = result ? getSuggestedTopics(result.skills) : [];

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Resume Analysis
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Upload your PDF resume and our AI will extract your technical skills and suggest the best interview track for you.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-4"
            >
              <UploadZone
                onFile={(f) => { setFile(f); setError(""); }}
                loading={loading}
              />

              {file && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#2563EB]/10 flex items-center justify-center text-[#60a5fa] shrink-0">
                    <RiFileTextLine className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{file.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {(file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    aria-label="Remove file"
                  >
                    <RiCloseLine className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-red-400 px-1"
                >
                  {error}
                </motion.p>
              )}

              <Button
                variant="primary"
                fullWidth
                disabled={!file || loading}
                onClick={handleUpload}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Analysing resume…
                  </>
                ) : (
                  <>
                    <RiBrainLine className="w-4 h-4 mr-2" />
                    Analyse with AI
                  </>
                )}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-5"
            >
              <Card className="flex items-center gap-4 py-5">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <RiCheckLine className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-[var(--text-primary)]">Resume analysed!</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                    {result.skills.length} technical skills identified
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-[#60a5fa] hover:text-[#2563EB] font-medium transition-colors"
                >
                  Upload new
                </button>
              </Card>

              {result.skills.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                >
                  <Card className="flex flex-col gap-4">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-3">
                      Extracted Technical Skills
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {result.skills.map((skill, i) => (
                        <Badge key={i} variant="blue">{skill}</Badge>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              )}

              {suggestedRole && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 }}
                >
                  <Card className="flex flex-col gap-4">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-3">
                      Recommended Interview Track
                    </h2>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 flex items-center justify-center text-[#60a5fa]">
                        <RoleIcon role={suggestedRole} />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-[var(--text-primary)]">{suggestedRole}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Based on your extracted skills
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              {suggestedTopics.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.3 }}
                >
                  <Card className="flex flex-col gap-4">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-3">
                      Suggested Interview Topics to Practise
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {suggestedTopics.map((t, i) => (
                        <Badge key={i} variant="purple">{t}</Badge>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.35 }}
              >
                <Card className="flex items-center gap-3 py-3 px-4 bg-[#2563EB]/5 border-[#2563EB]/20">
                  <div className="flex items-center gap-2">
                    <RiMicLine className="w-4 h-4 text-[#60a5fa]" />
                    <span className="text-xs text-[var(--text-secondary)]">Voice Mode</span>
                  </div>
                  <div className="w-px h-4 bg-[var(--border)]" />
                  <div className="flex items-center gap-2">
                    <RiVolumeUpLine className="w-4 h-4 text-[#60a5fa]" />
                    <span className="text-xs text-[var(--text-secondary)]">Questions will be narrated aloud</span>
                  </div>
                </Card>
              </motion.div>

              {/* CTA - Voice Mode ENABLED with skills */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.4 }}
                className="flex flex-col sm:flex-row gap-3 pt-2 pb-8"
              >
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    if (typeof window !== "undefined" && suggestedRole) {
                      const config = {
                        role: suggestedRole,
                        difficulty: "medium",
                        voiceMode: true,
                        narrateQuestions: true,
                        useResumeSkills: true,
                        skills: result.skills,
                      };
                      // Debug log
                      console.log("💾 Saving interview config:", {
                        role: config.role,
                        useResumeSkills: config.useResumeSkills,
                        skillsCount: config.skills.length,
                        firstFewSkills: config.skills.slice(0, 5)
                      });
                      localStorage.setItem("interview_config", JSON.stringify(config));
                    }
                    router.push("/interview");
                  }}
                >
                  <RiMicLine className="w-4 h-4 mr-2" />
                  Start Voice Interview
                </Button>
                <Button variant="secondary" fullWidth onClick={() => router.push("/")}>
                  Custom Setup
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}