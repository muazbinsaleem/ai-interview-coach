"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ScoreGauge } from "@/components/results/ScoreGauge";
import { PerformanceBreakdown } from "@/components/results/PerformanceBreakdown";
import { ReportModal } from "@/components/results/ReportModal";
import { Loader } from "@/components/ui/Loader";
import { store } from "@/lib/store";
import { auth } from "@/lib/auth";
import { apiSaveSession } from "@/lib/api";
import { InterviewSession } from "@/lib/types";
import { RiDownloadLine, RiShareBoxLine, RiDashboardLine } from "react-icons/ri";

function getScoreLabel(score: number): string {
  if (score >= 9) return "Outstanding";
  if (score >= 8) return "Strong Performance";
  if (score >= 7) return "Good Performance";
  if (score >= 6) return "Satisfactory";
  return "Needs Improvement";
}

function getScoreVariant(score: number): "green" | "blue" | "yellow" | "red" {
  if (score >= 8) return "green";
  if (score >= 7) return "blue";
  if (score >= 6) return "yellow";
  return "red";
}

export default function ResultsPage() {
  const router = useRouter();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [savedToBackend, setSavedToBackend] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loaded = store.load();
    if (!loaded || loaded.answers.length === 0) {
      router.push("/");
      return;
    }
    setSession(loaded);

    // Save session to backend if authenticated (best-effort, non-blocking)
    if (auth.isAuthenticated() && loaded.status === "complete") {
      const mappedRole = loaded.config.role;
      const mappedDifficulty = loaded.config.difficulty;

      const answersPayload = loaded.answers.map((ans, idx) => {
        const q = loaded.questions[idx];
        
        // Convert score from 0-10 to 0-3 for backend
        let rawScore = ans.score;
        let backendScore = 0;
        
        if (rawScore > 0) {
          if (rawScore >= 8) backendScore = 3;
          else if (rawScore >= 6) backendScore = 2;
          else if (rawScore >= 4) backendScore = 1;
          else backendScore = 0;
        }
        
        console.log(`Converting score: ${rawScore}/10 → ${backendScore}/3`);
        
        return {
          question_id: String(ans.questionId),  // ← FIX: Convert to string
          question_text: q?.text ?? "",
          question_topic: q?.topic ?? "General",
          answer_text: ans.text || "",
          score: backendScore,
          strengths: ans.strengths || [],
          weaknesses: ans.weaknesses || [],
          suggested_answer: ans.suggestedAnswer || "",
          summary: ans.summary || "",
        };
      });

      // Filter out answers with no text (completely skipped)
      const validAnswers = answersPayload.filter(a => a.answer_text && a.answer_text.trim().length > 0);

      if (validAnswers.length > 0) {
        console.log("Saving session with answers:", validAnswers.map(a => ({ id: a.question_id, score: a.score })));
        
        apiSaveSession({
          role: mappedRole,
          difficulty: mappedDifficulty,
          voice_mode: loaded.config.voiceMode || false,
          started_at: new Date(loaded.startedAt).toISOString(),
          answers: validAnswers,
        })
          .then(() => {
            console.log("Session saved successfully!");
            setSavedToBackend(true);
          })
          .catch((err) => {
            console.warn("Could not save session to backend:", err.message);
          });
      }
    }
  }, [router]);

  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <Loader label="Loading results..." />
      </div>
    );
  }

  const overallScore =
    session.answers.length > 0
      ? session.answers.reduce((sum, a) => sum + a.score, 0) / session.answers.length
      : 0;

  const answeredCount = session.answers.filter(a => a.score > 0).length;
  const strongAnswersCount = session.answers.filter(a => a.score >= 8).length;

  const topics = session.questions.map(q => q.topic);
  const topTopic = topics.length > 0 ? [...new Set(topics)].sort((a, b) =>
    session.answers.filter(ans => session.questions.find(q => q.id === ans.questionId)?.topic === a).reduce((s, ans) => s + ans.score, 0) -
    session.answers.filter(ans => session.questions.find(q => q.id === ans.questionId)?.topic === b).reduce((s, ans) => s + ans.score, 0)
  ).pop() : "None";

  const weakTopics = session.answers
    .filter(a => a.score < 6)
    .map(a => session.questions.find(q => q.id === a.questionId)?.topic)
    .filter(Boolean);
  const uniqueWeakTopics = Array.from(new Set(weakTopics));

  const handleDownload = () => {
    const date = new Date(session.startedAt).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
    const avgScore = session.answers.length > 0
      ? (session.answers.reduce((s, a) => s + a.score, 0) / session.answers.length).toFixed(1)
      : "0";

    const questionRows = session.questions.map((q, i) => {
      const ans = session.answers[i];
      if (!ans) return "";
      const scoreColor = ans.score >= 8 ? "#10b981" : ans.score >= 6 ? "#2563EB" : ans.score >= 4 ? "#f59e0b" : "#ef4444";
      return `
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:16px;page-break-inside:avoid">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px">Q${i + 1} · ${q.topic}</p>
              <p style="font-weight:600;color:#111827;margin:0">${q.text}</p>
            </div>
            <span style="font-size:22px;font-weight:700;color:${scoreColor};margin-left:16px;white-space:nowrap">${ans.score}/10</span>
          </div>
          ${ans.text ? `<div style="background:#f9fafb;border-radius:6px;padding:12px;margin-bottom:12px">
            <p style="font-size:11px;color:#6b7280;margin:0 0 4px">YOUR ANSWER</p>
            <p style="color:#374151;margin:0;font-size:14px">${ans.text}</p>
          </div>` : `<p style="color:#9ca3af;font-size:13px;font-style:italic;margin-bottom:12px">Question skipped</p>`}
          ${ans.strengths.length > 0 ? `<p style="color:#059669;font-size:13px;margin:0 0 4px"><strong>✓ Strengths:</strong> ${ans.strengths.join(" · ")}</p>` : ""}
          ${ans.weaknesses.length > 0 ? `<p style="color:#dc2626;font-size:13px;margin:0 0 8px"><strong>✗ Areas to improve:</strong> ${ans.weaknesses.join(" · ")}</p>` : ""}
          ${ans.suggestedAnswer ? `<div style="border-left:3px solid #2563EB;padding-left:12px;margin-top:8px">
            <p style="font-size:11px;color:#6b7280;margin:0 0 4px">MODEL ANSWER</p>
            <p style="color:#374151;font-size:13px;margin:0">${ans.suggestedAnswer}</p>
          </div>` : ""}
        </div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Interview Report — ${session.config.role} — ${date}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #111827; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div style="border-bottom:2px solid #2563EB;padding-bottom:20px;margin-bottom:24px">
    <h1 style="margin:0 0 4px;font-size:24px">Interview Performance Report</h1>
    <p style="margin:0;color:#6b7280">${session.config.role} · ${session.config.difficulty} · ${date}</p>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px">
    <div style="background:#f9fafb;border-radius:8px;padding:16px;text-align:center">
      <p style="font-size:11px;color:#6b7280;margin:0 0 4px;text-transform:uppercase">Overall Score</p>
      <p style="font-size:32px;font-weight:700;color:#2563EB;margin:0">${avgScore}/10</p>
    </div>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;text-align:center">
      <p style="font-size:11px;color:#6b7280;margin:0 0 4px;text-transform:uppercase">Answered</p>
      <p style="font-size:32px;font-weight:700;color:#111827;margin:0">${session.answers.filter(a => a.score > 0).length}/${session.questions.length}</p>
    </div>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;text-align:center">
      <p style="font-size:11px;color:#6b7280;margin:0 0 4px;text-transform:uppercase">Strong (≥8)</p>
      <p style="font-size:32px;font-weight:700;color:#059669;margin:0">${session.answers.filter(a => a.score >= 8).length}</p>
    </div>
  </div>
  <h2 style="font-size:16px;margin:0 0 16px">Question Breakdown</h2>
  ${questionRows}
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:32px">Generated by InterviewAI · ${new Date().toLocaleString()}</p>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-report-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(
      `I just scored ${overallScore.toFixed(1)}/10 on my ${session.config.role} mock interview using InterviewAI!`
    );
    alert("Results copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <Header />

      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full flex flex-col gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-6 pt-4"
        >
          <div className="text-center">
            <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Session Complete
            </h1>
            <p className="text-[var(--text-secondary)] mt-2">
              {session.config.role} • {session.config.difficulty}
            </p>
            {savedToBackend && (
              <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Session saved to your dashboard
              </p>
            )}
          </div>

          <Card glow className="w-full max-w-lg flex flex-col items-center gap-6 py-8">
            <ScoreGauge score={overallScore} />
            <Badge variant={getScoreVariant(overallScore)} className="text-sm px-4 py-1.5">
              {getScoreLabel(overallScore)}
            </Badge>

            <div className="flex flex-wrap items-center justify-center gap-3 w-full border-t border-[var(--border-subtle)] pt-6 mt-2">
              <Badge variant="gray" className="py-1">
                {answeredCount} Questions Answered
              </Badge>
              <Badge variant="green" className="py-1">
                {strongAnswersCount} Strong Answers
              </Badge>
              {topTopic && (
                <Badge variant="blue" className="py-1">
                  Top Topic: {topTopic}
                </Badge>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
        >
          <PerformanceBreakdown session={session} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
        >
          <Card className="flex flex-col gap-5">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-4">
              Improvement Insights
            </h2>

            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Key Takeaways</h3>
                <ul className="flex flex-col gap-2">
                  <li className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                    <span className="text-[#2563EB] shrink-0 mt-0.5">•</span>
                    <span>{strongAnswersCount >= 3 ? "Great job elaborating on concepts with clear examples." : "Focus on providing concrete examples in your answers."}</span>
                  </li>
                  <li className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                    <span className="text-[#2563EB] shrink-0 mt-0.5">•</span>
                    <span>Ensure you discuss edge cases and trade-offs to elevate your responses.</span>
                  </li>
                </ul>
              </div>

              {uniqueWeakTopics.length > 0 && (
                <div className="pt-2">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Topics to Review</h3>
                  <div className="flex flex-wrap gap-2">
                    {uniqueWeakTopics.map((topic, i) => (
                      <Badge key={i} variant="red">{String(topic)}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 pb-12"
        >
          <div className="flex w-full sm:w-auto gap-3">
            <Button variant="secondary" fullWidth onClick={() => router.push("/interview")}>
              Retake Interview
            </Button>
            <Button variant="secondary" fullWidth onClick={() => {
              store.clear();
              router.push("/");
            }}>
              New Role / Setup
            </Button>
          </div>

          <div className="flex w-full sm:w-auto gap-3">
            {auth.isAuthenticated() && (
              <Button variant="ghost" className="flex-1 sm:flex-none justify-center" onClick={() => router.push("/dashboard")}>
                <RiDashboardLine className="w-4 h-4 mr-1.5" /> Dashboard
              </Button>
            )}
            <Button variant="ghost" className="flex-1 sm:flex-none justify-center" onClick={handleDownload}>
              <RiDownloadLine className="w-4 h-4 mr-1.5" /> Report
            </Button>
            <Button variant="ghost" className="flex-1 sm:flex-none justify-center" onClick={handleShare}>
              <RiShareBoxLine className="w-4 h-4 mr-1.5" /> Share
            </Button>
            <Button variant="primary" className="flex-1 sm:flex-none justify-center" onClick={() => setShowModal(true)}>
              Full Details
            </Button>
          </div>
        </motion.div>
      </main>

      <ReportModal open={showModal} onClose={() => setShowModal(false)} session={session} />
    </div>
  );
}