"use client";

/**
 * app/history/page.tsx
 * ====================
 * Session history page — lists all past interview sessions and allows
 * the user to expand any session to see the full Q&A breakdown.
 *
 * API:  GET /sessions         → list of sessions
 *       GET /sessions/{id}    → full detail with answers
 */

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/ui/Loader";
import { auth } from "@/lib/auth";
import {
  apiListSessions,
  apiGetSessionById,
  BackendSession,
  BackendSessionDetail,
} from "@/lib/api";
import {
  RiCodeSSlashLine,
  RiDatabaseLine,
  RiBarChart2Line,
  RiMicLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCalendarLine,
  RiFileListLine,
  RiCheckLine,
  RiCloseLine,
} from "react-icons/ri";

// ── Helpers ───────────────────────────────────────────────────────────────────

function roleLabel(role: string) {
  const map: Record<string, string> = {
    "software engineer":   "Software Engineer",
    "data scientist":      "Data Scientist",
    "devops engineer":     "DevOps Engineer",
    "product manager":     "Product Manager",
    "qa analyst":          "QA Analyst",
    "ux designer":         "UX Designer",
    "hr specialist":       "HR Specialist",
    "marketing associate": "Marketing Associate",
  };
  return map[role] ?? role;
}

function difficultyLabel(d: string) {
  const map: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
  return map[d] ?? d;
}

function RoleIcon({ role }: { role: string }) {
  if (role === "software engineer" || role === "devops engineer" || role === "ux designer")
    return <RiCodeSSlashLine className="w-4 h-4" />;
  if (role === "data scientist")
    return <RiBarChart2Line className="w-4 h-4" />;
  return <RiDatabaseLine className="w-4 h-4" />;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  // Normalise "Z" suffix so Date() parses it as UTC everywhere,
  // then display in the user's local locale without day-shift bugs.
  const normalised = iso.endsWith("Z") ? iso : iso.replace("+00:00", "Z");
  return new Date(normalised).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function scoreColor(score: number) {
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-blue-400";
  if (score >= 4) return "text-amber-400";
  if (score > 0) return "text-red-400";
  return "text-[var(--text-muted)]"; // no score / zero
}

function scoreVariant(score: number): "green" | "blue" | "yellow" | "red" | "gray" {
  if (score >= 8) return "green";
  if (score >= 6) return "blue";
  if (score >= 4) return "yellow";
  if (score > 0) return "red";
  return "gray"; // no score / zero
}

function scoreLabel(score: number) {
  if (score >= 9) return "Outstanding";
  if (score >= 8) return "Strong";
  if (score >= 6) return "Good";
  if (score >= 4) return "Average";
  return "Needs Work";
}

// ── Expanded Session Detail ────────────────────────────────────────────────────

function SessionDetail({ detail }: { detail: BackendSessionDetail }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="border-t border-[var(--border-subtle)] pt-4 mt-2 flex flex-col gap-3">
      {detail.answers.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">No answers recorded.</p>
      ) : (
        detail.answers.map((ans, idx) => (
          <div
            key={ans.id}
            className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-base)]"
          >
            {/* Question row */}
            <button
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className="w-full flex items-start gap-3 p-3 text-left hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <div
                className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  ans.score >= 8
                    ? "bg-emerald-500/10 text-emerald-400"
                    : ans.score >= 6
                    ? "bg-blue-500/10 text-blue-400"
                    : ans.score >= 4
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {ans.score}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--text-muted)] mb-0.5">
                  {ans.question_topic}
                </p>
                <p className="text-sm text-[var(--text-primary)] line-clamp-2">
                  {ans.question_text}
                </p>
              </div>
              <div className="shrink-0 text-[var(--text-muted)] mt-0.5">
                {openIdx === idx ? (
                  <RiArrowUpSLine className="w-4 h-4" />
                ) : (
                  <RiArrowDownSLine className="w-4 h-4" />
                )}
              </div>
            </button>

            {/* Expanded detail */}
            <AnimatePresence>
              {openIdx === idx && (
                <motion.div
                  key="detail"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-[var(--border-subtle)] p-4 flex flex-col gap-4">
                    {/* Score badge */}
                    <div className="flex items-center gap-2">
                      <Badge variant={scoreVariant(ans.score)}>
                        {scoreLabel(ans.score)} — {ans.score}/10
                      </Badge>
                      {ans.answer_text ? null : (
                        <Badge variant="gray">Skipped</Badge>
                      )}
                    </div>

                    {/* Answer */}
                    {ans.answer_text && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">
                          Your Answer
                        </p>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                          {ans.answer_text}
                        </p>
                      </div>
                    )}

                    {/* Strengths + Weaknesses */}
                    {(ans.strengths.length > 0 || ans.weaknesses.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ans.strengths.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-emerald-400 mb-1.5">Strengths</p>
                            <ul className="flex flex-col gap-1">
                              {ans.strengths.map((s, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                                  <RiCheckLine className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ans.weaknesses.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-red-400 mb-1.5">Areas to Improve</p>
                            <ul className="flex flex-col gap-1">
                              {ans.weaknesses.map((w, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                                  <RiCloseLine className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Model answer */}
                    {ans.suggested_answer && (
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">
                          Model Answer
                        </p>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                          {ans.suggested_answer}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))
      )}
    </div>
  );
}

// ── Session Row ────────────────────────────────────────────────────────────────

function SessionRow({ session }: { session: BackendSession }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<BackendSessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleExpand = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    // Always fetch fresh detail on first expand (detail is null until loaded).
    if (!detail) {
      setLoading(true);
      setError("");
      try {
        const data = await apiGetSessionById(session.id);
        setDetail(data);
      } catch {
        setError("Failed to load session details. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  }, [expanded, detail, session.id]);

  const sc = session.overall_score;

  return (
    <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--bg-surface)] transition-colors">
      {/* Summary row */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-[var(--bg-elevated)] transition-colors"
      >
        {/* Role icon */}
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
          <RoleIcon role={session.role} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {roleLabel(session.role)}
            <span className="font-normal text-[var(--text-muted)]">
              {" "}· {difficultyLabel(session.difficulty)}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <RiCalendarLine className="w-3.5 h-3.5" />
              {formatDate(session.completed_at)}
            </span>
            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <RiFileListLine className="w-3.5 h-3.5" />
              {session.answer_count} answers
            </span>
            {session.voice_mode && (
              <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <RiMicLine className="w-3.5 h-3.5" />
                Voice
              </span>
            )}
          </div>
        </div>

        {/* Score */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className={`text-2xl font-bold tabular-nums ${scoreColor(sc)}`}>
              {sc > 0 ? sc.toFixed(1) : "—"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">out of 10</p>
          </div>
          <div className="text-[var(--text-muted)]">
            {expanded ? (
              <RiArrowUpSLine className="w-5 h-5" />
            ) : (
              <RiArrowDownSLine className="w-5 h-5" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {loading ? (
                <div className="py-8 flex justify-center">
                  <Loader label="Loading details…" />
                </div>
              ) : error ? (
                <p className="text-sm text-red-400 text-center py-4">{error}</p>
              ) : detail ? (
                <SessionDetail detail={detail} />
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      router.replace("/login");
      return;
    }
    apiListSessions()
      .then(setSessions)
      .catch(() => setError("Failed to load sessions. Please try again."))
      .finally(() => setLoading(false));
  }, [router]);

  const roles = ["all", "software engineer", "data scientist", "devops engineer",
                 "product manager", "qa analyst", "ux designer",
                 "hr specialist", "marketing associate"];
  const difficulties = ["all", "easy", "medium", "hard"];

  // Sort newest-first so most recent sessions appear at the top.
  const sorted = [...sessions].sort((a, b) => {
    if (!a.completed_at) return 1;
    if (!b.completed_at) return -1;
    return b.completed_at.localeCompare(a.completed_at);
  });

  const filtered = sorted
    .filter((s) => filterRole === "all" || s.role === filterRole)
    .filter((s) => filterDifficulty === "all" || s.difficulty === filterDifficulty);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-8">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Session History
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {sessions.length} session{sessions.length !== 1 ? "s" : ""} completed
              {filterRole !== "all" && ` · ${filtered.length} shown`}
            </p>
          </div>
          <Button variant="primary" onClick={() => router.push("/")}>
            New Session
          </Button>
        </motion.div>

        {/* Filter tabs */}
        {!loading && sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex flex-col gap-2"
          >
            {/* Role filter */}
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRole(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filterRole === r
                      ? "bg-[#2563EB] text-white shadow-sm shadow-[#2563EB]/30"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {r === "all" ? "All Roles" : roleLabel(r)}
                  {r !== "all" && (
                    <span className="ml-1.5 opacity-70">
                      {sessions.filter((s) => s.role === r).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {/* Difficulty filter */}
            <div className="flex flex-wrap gap-2">
              {difficulties.map((d) => (
                <button
                  key={d}
                  onClick={() => setFilterDifficulty(d)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filterDifficulty === d
                      ? "bg-[var(--text-muted)] text-[var(--bg-base)] shadow-sm"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {d === "all" ? "All Levels" : difficultyLabel(d)}
                  {d !== "all" && (
                    <span className="ml-1.5 opacity-70">
                      {sessions.filter((s) => s.difficulty === d).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader label="Loading sessions…" />
          </div>
        ) : error ? (
          <Card className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-[var(--text-primary)] font-medium">{error}</p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </Card>
        ) : sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)]">
                <RiFileListLine className="w-7 h-7" />
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--text-primary)] mb-1">
                  No sessions yet
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Complete your first interview to see your history here.
                </p>
              </div>
              <Button variant="primary" onClick={() => router.push("/")}>
                Start Practicing
              </Button>
            </Card>
          </motion.div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              No {roleLabel(filterRole)} sessions yet.
            </p>
            <button
              onClick={() => setFilterRole("all")}
              className="text-xs text-[#60a5fa] hover:text-[#2563EB] transition-colors underline underline-offset-2"
            >
              Show all sessions
            </button>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="flex flex-col gap-3 pb-12"
          >
            {filtered.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}