"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/ui/Loader";
import { auth, AuthUser } from "@/lib/auth";
import { apiGetDashboard, apiListSessions, DashboardStats, BackendSession } from "@/lib/api";
import {
  RiBarChartLine,
  RiCalendarLine,
  RiTrophyLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiSubtractLine,
  RiCodeSSlashLine,
  RiDatabaseLine,
  RiBarChart2Line,
} from "react-icons/ri";

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "improving") return <RiArrowUpLine className="w-4 h-4 text-emerald-400" />;
  if (trend === "declining") return <RiArrowDownLine className="w-4 h-4 text-red-400" />;
  return <RiSubtractLine className="w-4 h-4 text-[var(--text-muted)]" />;
}

function TrendBadge({ trend }: { trend: string }) {
  const map: Record<string, "green" | "red" | "gray"> = {
    improving: "green",
    declining: "red",
    stable: "gray",
  };
  return <Badge variant={map[trend] ?? "gray"}>{trend}</Badge>;
}

function ScoreDot({ score }: { score: number }) {
  const color =
    score >= 8 ? "#10b981" : score >= 6 ? "#2563EB" : score >= 4 ? "#f59e0b" : "#ef4444";
  return (
    <div
      className="w-2.5 h-2.5 rounded-full shrink-0"
      style={{ background: color }}
    />
  );
}

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

function RoleIcon({ role }: { role: string }) {
  if (role === "software engineer" || role === "devops engineer" || role === "ux designer")
    return <RiCodeSSlashLine className="w-4 h-4" />;
  if (role === "data scientist")
    return <RiBarChart2Line className="w-4 h-4" />;
  return <RiDatabaseLine className="w-4 h-4" />;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      router.replace("/login");
      return;
    }
    setUser(auth.getUser());

    Promise.all([apiGetDashboard(), apiListSessions()])
      .then(([dashData, sessionList]) => {
        setStats(dashData);
        setSessions(sessionList.slice(0, 10));
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load dashboard data. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    auth.clear();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader label="Loading dashboard…" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-[var(--text-primary)] font-semibold">{error}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const overallAvg = stats?.average_score ?? 0;

  // FIX: show muted color when there are no sessions yet (avg === 0),
  // instead of falling through to amber which implies a bad score.
  const scoreColor =
    overallAvg >= 8
      ? "text-emerald-400"
      : overallAvg >= 6
      ? "text-blue-400"
      : overallAvg > 0
      ? "text-amber-400"
      : "text-[var(--text-muted)]";

  // Whether we have real data to show in the analytics section.
  // Use sessions.length as a fallback so the section doesn't disappear
  // if stats.total_sessions comes back wrong from the API.
  const hasData = (stats?.total_sessions ?? 0) > 0 || sessions.length > 0;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-8">
        {/* Top row — greeting + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}! 👋
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {(stats?.total_sessions ?? 0) === 0
                ? "You haven't done any sessions yet. Start practising!"
                : `${stats?.total_sessions} session${stats?.total_sessions !== 1 ? "s" : ""} completed — keep it up!`}
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button variant="primary" onClick={() => router.push("/")}>
              New Session
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </motion.div>

        {/* Stat cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {/* Average Score */}
          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Avg Score</span>
              <RiBarChartLine className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            {/* FIX: show "—" only when there are truly no sessions, not when avg happens to be 0 */}
            <p className={`text-3xl font-bold ${scoreColor}`}>
              {hasData ? overallAvg.toFixed(1) : "—"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">out of 10</p>
          </Card>

          {/* Total sessions */}
          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Sessions</span>
              <RiTrophyLine className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              {stats?.total_sessions ?? 0}
            </p>
            <p className="text-xs text-[var(--text-muted)]">all time</p>
          </Card>

          {/* This week */}
          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">This Week</span>
              <RiCalendarLine className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              {stats?.sessions_this_week ?? 0}
            </p>
            <p className="text-xs text-[var(--text-muted)]">sessions</p>
          </Card>

          {/* Trend */}
          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Trend</span>
              <TrendIcon trend={stats?.improvement_trend ?? "stable"} />
            </div>
            <div className="mt-1">
              <TrendBadge trend={stats?.improvement_trend ?? "stable"} />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {stats?.best_role && stats.best_role !== "N/A"
                ? `Best: ${roleLabel(stats.best_role)}`
                : "Keep practising!"}
            </p>
          </Card>
        </motion.div>

        {/* Topics + Score Chart row */}
        {/* FIX: use `hasData` so this section is visible whenever sessions exist,
            even if the stats object temporarily reports total_sessions as 0. */}
        {stats && hasData && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Score over time */}
            <Card className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Score History</h2>
              {stats.scores_over_time.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No scored sessions yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {stats.scores_over_time.slice(0, 8).map((entry, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <ScoreDot score={entry.score} />
                      <div className="flex-1 bg-[var(--bg-base)] rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(entry.score / 10) * 100}%`,
                            background:
                              entry.score >= 8
                                ? "#10b981"
                                : entry.score >= 6
                                ? "#2563EB"
                                : "#f59e0b",
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-[var(--text-muted)] w-8 text-right">
                        {entry.score}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] w-20 text-right shrink-0">
                        {entry.date}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Topics */}
            <div className="flex flex-col gap-4">
              {stats.strong_topics.length > 0 && (
                <Card className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold text-emerald-400">Strong Topics</h2>
                  <div className="flex flex-wrap gap-2">
                    {stats.strong_topics.map((t, i) => (
                      <Badge key={i} variant="green">{t}</Badge>
                    ))}
                  </div>
                </Card>
              )}
              {stats.weak_topics.length > 0 && (
                <Card className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold text-red-400">Topics to Improve</h2>
                  <div className="flex flex-wrap gap-2">
                    {stats.weak_topics.map((t, i) => (
                      <Badge key={i} variant="red">{t}</Badge>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </motion.div>
        )}

        {/* Session History */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-3">
              Recent Sessions
            </h2>

            {sessions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-[var(--text-secondary)]">No sessions yet.</p>
                <Button variant="primary" size="sm" onClick={() => router.push("/")}>
                  Start your first session
                </Button>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
                {sessions.map((s) => {
                  const sessionScoreColor =
                    s.overall_score >= 8
                      ? "text-emerald-400"
                      : s.overall_score >= 6
                      ? "text-blue-400"
                      : "text-amber-400";
                  return (
                    <div key={s.id} className="flex items-center gap-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                        <RoleIcon role={s.role} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {roleLabel(s.role)}
                          <span className="text-[var(--text-muted)] font-normal"> · {s.difficulty}</span>
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {formatDate(s.completed_at)} · {s.answer_count} answers
                          {s.voice_mode && " · 🎤 Voice"}
                        </p>
                      </div>
                      <span className={`text-lg font-bold tabular-nums ${sessionScoreColor}`}>
                        {s.overall_score.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </main>
    </div>
  );
}