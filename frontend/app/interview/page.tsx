"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { QuestionCard } from "@/components/interview/QuestionCard";
import { AnswerInput } from "@/components/interview/AnswerInput";
import { FeedbackCard } from "@/components/interview/FeedbackCard";
import { VoicePlayer } from "@/components/interview/VoicePlayer";
import { evaluateAnswer } from "@/lib/evaluate";
import { apiGetQuestionsFromBank, apiGenerateQuestions } from "@/lib/api";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { Question, Answer, SessionConfig, InterviewSession, QuestionStatus } from "@/lib/types";
import { Loader } from "@/components/ui/Loader";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";

const QUESTION_TIME_LIMIT = 120;

// ─── Keyboard Shortcuts Toast ─────────────────────────────────────────────────

function ShortcutHint({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--text-muted)] text-xs">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold
                       bg-[var(--bg-elevated)] border border-[var(--border)]
                       text-[var(--text-secondary)] shadow-[0_1px_0_var(--border)]"
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

// ─── Question Timer ───────────────────────────────────────────────────────────

interface QuestionTimerProps {
  timeLeft: number;
  total: number;
  paused: boolean;
}

function QuestionTimer({ timeLeft, total, paused }: QuestionTimerProps) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / total;
  const strokeDashoffset = circumference * (1 - progress);

  const isUrgent = timeLeft <= 20;
  const isWarning = timeLeft <= 45 && timeLeft > 20;

  const color = isUrgent
    ? "#ef4444"
    : isWarning
      ? "#f59e0b"
      : "#2563EB";

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const label = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <motion.div
      className="flex items-center gap-2.5"
      animate={isUrgent && !paused ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={{ repeat: isUrgent ? Infinity : 0, duration: 0.8 }}
    >
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
          <circle
            cx="24" cy="24" r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="3"
          />
          <motion.circle
            cx="24" cy="24" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: "linear" }}
            style={{ strokeDasharray: circumference }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[10px] font-bold font-mono tabular-nums"
            style={{ color }}
          >
            {label}
          </span>
        </div>
      </div>

      {isUrgent && !paused && (
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xs font-semibold text-[#ef4444]"
        >
          Time running out!
        </motion.span>
      )}
    </motion.div>
  );
}

// ─── Enhanced Progress Bar with Step Dots ────────────────────────────────────

interface EnhancedProgressProps {
  current: number;
  total: number;
  statuses: QuestionStatus[];
}

function EnhancedProgress({ current, total, statuses }: EnhancedProgressProps) {
  const pct = Math.round((current / total) * 100);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-12 py-3 flex flex-col gap-2">
      <div className="relative h-1 w-full bg-[var(--border)] rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-[#2563EB] rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div className="flex items-center justify-between">
        {statuses.map((status, i) => {
          const isAnswered = status === "answered";
          const isSkipped = status === "skipped";
          const isCurrent = status === "current";
          const isPending = status === "pending";

          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <motion.div
                animate={{
                  scale: isCurrent ? 1.3 : 1,
                  opacity: isPending ? 0.35 : 1,
                }}
                transition={{ duration: 0.25 }}
                className={[
                  "w-2.5 h-2.5 rounded-full transition-colors duration-300",
                  isCurrent
                    ? "bg-[#2563EB] ring-2 ring-[rgba(37,99,235,0.3)]"
                    : isAnswered
                      ? "bg-[#4ade80]"
                      : isSkipped
                        ? "bg-[#f59e0b]"
                        : "bg-[var(--border)]",
                ].join(" ")}
              />
            </div>
          );
        })}

        <span className="text-[10px] font-medium text-[var(--text-muted)] tabular-nums ml-2 shrink-0">
          {current}/{total}
        </span>
      </div>
    </div>
  );
}

// ─── Keyboard Shortcuts Panel ─────────────────────────────────────────────────

function KeyboardShortcuts({ hasFeedback }: { hasFeedback: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
          onMouseEnter={() => setVisible(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                     flex items-center gap-4 px-4 py-2.5 rounded-xl
                     bg-[var(--bg-surface)] border border-[var(--border)]
                     shadow-[0_8px_24px_rgba(0,0,0,0.35)]
                     backdrop-blur-md"
        >
          {!hasFeedback && (
            <>
              <ShortcutHint label="Submit" keys={["⌘", "↵"]} />
              <div className="w-px h-4 bg-[var(--border)]" />
              <ShortcutHint label="Skip" keys={["S"]} />
            </>
          )}
          {hasFeedback && (
            <ShortcutHint label="Next" keys={["N"]} />
          )}
          <div className="w-px h-4 bg-[var(--border)]" />
          <ShortcutHint label="End session" keys={["Esc"]} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const router = useRouter();
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [currentFeedback, setCurrentFeedback] = useState<Answer | null>(null);
  const [allAnswers, setAllAnswers] = useState<Answer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [direction, setDirection] = useState(1);
  const [idealAnswers, setIdealAnswers] = useState<Map<number, string>>(new Map());

  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [timerPaused, setTimerPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { speak, stop } = useTextToSpeech();

  const resetTimer = useCallback(() => {
    setTimeLeft(QUESTION_TIME_LIMIT);
    setTimerPaused(false);
  }, []);

  const pauseTimer = useCallback(() => setTimerPaused(true), []);
  const resumeTimer = useCallback(() => setTimerPaused(false), []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timerPaused || currentFeedback) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current!);
  }, [timerPaused, currentFeedback, currentIndex]);

  useEffect(() => {
    if (timeLeft === 0 && !currentFeedback && !isSubmitting) {
      if (answerText.trim()) {
        handleSubmit();
      } else {
        handleSkip();
      }
    }
  }, [timeLeft]);

  // ── Data loading with IDEAL ANSWERS storage ─────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!auth.isAuthenticated()) {
      router.push("/login");
      return;
    }

    const raw = localStorage.getItem("interview_config");
    if (!raw) { router.push("/"); return; }

    let parsed: SessionConfig;
    try {
      parsed = JSON.parse(raw) as SessionConfig;
    } catch {
      router.push("/");
      return;
    }

    console.log("📋 Loaded interview config:", {
      role: parsed.role,
      difficulty: parsed.difficulty,
      voiceMode: parsed.voiceMode,
      narrateQuestions: parsed.narrateQuestions,
      skillsCount: parsed.skills?.length || 0,
    });

    setConfig(parsed);

    const mappedRole = parsed.role;
    const mappedDifficulty = parsed.difficulty;
    const skills = (parsed.useResumeSkills && parsed.skills) ? parsed.skills : [];


    console.log(`🎯 Fetching questions with ${skills.length} skills`);

    setIsLoadingQuestions(true);

    const fetchQuestions =
      skills.length > 0
        ? apiGenerateQuestions(mappedRole, mappedDifficulty, skills)
        : apiGetQuestionsFromBank(mappedRole, mappedDifficulty);

    fetchQuestions
      .then((qs) => {
        console.log(`✅ Received ${qs.length} questions from API`);
        
        // Store ideal answers if they exist in the response
        const idealMap = new Map<number, string>();
        
        const mapped: Question[] = qs.map((q, idx) => {
          // Backend may return ideal_answer or _ideal_answer — check both
          const idealAnswer = q.ideal_answer || q._ideal_answer;
          if (idealAnswer) {
            idealMap.set(idx, idealAnswer);
            console.log(`📝 Stored ideal answer for question ${idx + 1}`);
          }
          return {
            id: q.id,
            // Backend sends 'category'; fall back to 'topic' if present
            role: (q.role ?? parsed.role ?? "") as Question["role"],
            difficulty: (q.difficulty ?? parsed.difficulty ?? "") as Question["difficulty"],
            text: q.text,
            topic: q.category ?? q.topic ?? "General",
          };
        });
        
        setIdealAnswers(idealMap);
        setQuestions(mapped);
        
        if (parsed.narrateQuestions && mapped.length > 0) {
          setTimeout(() => speak(mapped[0].text), 500);
        }
      })
      .catch((err) => {
        console.error("❌ Failed to load questions:", err);
        setLoadError("Could not load questions. Please check you are logged in and the server is running.");
      })
      .finally(() => setIsLoadingQuestions(false));
  }, []);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!currentQuestion || !answerText.trim() || !config) return;
    setIsSubmitting(true);
    pauseTimer();
    stop();
    try {
      const idealAnswer = idealAnswers.get(currentIndex);
      console.log(`📝 Submitting answer for question ${currentIndex + 1}, has ideal answer: ${idealAnswer ? 'YES' : 'NO'}`);
      
      const result = await evaluateAnswer(
        currentQuestion,
        answerText,
        config.role,
        config.difficulty,
        idealAnswer
      );
      setAllAnswers((prev) => [...prev, result]);
      setCurrentFeedback(result);
    } catch (e) {
      console.error("Evaluation failed", e);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentQuestion, answerText, config, stop, pauseTimer, currentIndex, idealAnswers]);

  const handleNext = useCallback(() => {
    setDirection(1);
    stop();
    if (currentIndex + 1 >= totalQuestions) {
      handleEndSession(allAnswers);
      return;
    }
    const nextIdx = currentIndex + 1;
    setCurrentIndex(nextIdx);
    setAnswerText("");
    setCurrentFeedback(null);
    resetTimer();
    if (config?.narrateQuestions) {
      setTimeout(() => speak(questions[nextIdx].text), 500);
    }
  }, [currentIndex, totalQuestions, allAnswers, config, questions, speak, stop, resetTimer]);

  const handleSkip = useCallback(() => {
    setDirection(1);
    stop();
    pauseTimer();
    const skippedAnswer: Answer = {
      questionId: currentQuestion.id,
      text: "",
      score: 0,
      strengths: [],
      weaknesses: ["Question was skipped"],
      suggestedAnswer: "Please attempt the question to receive a model answer.",
      summary: "Skipped",
    };
    const updatedAnswers = [...allAnswers, skippedAnswer];
    setAllAnswers(updatedAnswers);

    if (currentIndex + 1 >= totalQuestions) {
      handleEndSession(updatedAnswers);
      return;
    }
    const nextIdx = currentIndex + 1;
    setCurrentIndex(nextIdx);
    setAnswerText("");
    setCurrentFeedback(null);
    resetTimer();
    if (config?.narrateQuestions) {
      setTimeout(() => speak(questions[nextIdx].text), 500);
    }
  }, [currentIndex, totalQuestions, currentQuestion, allAnswers, config, questions, speak, stop, pauseTimer, resetTimer]);

  const handleEndSession = useCallback((finalAnswers = allAnswers) => {
    if (!config) return;
    stop();
    const session: InterviewSession = {
      config,
      questions,
      answers: finalAnswers,
      currentIndex,
      status: "complete",
      startedAt: Date.now(),
    };
    store.save(session);
    router.push("/results");
  }, [config, questions, allAnswers, currentIndex, stop, router]);

  const handleReplayQuestion = useCallback(() => {
    if (!currentQuestion) return;
    // Clear feedback so AnswerInput becomes visible again
    setCurrentFeedback(null);
    setAnswerText("");
    resetTimer();
    // Small delay so the answer area animates in before TTS starts
    setTimeout(() => speak(currentQuestion.text), 400);
  }, [currentQuestion, speak, resetTimer]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === "TEXTAREA" || tag === "INPUT";

      if (e.key === "Escape") {
        handleEndSession();
        return;
      }

      if (!isTyping && e.key.toLowerCase() === "n" && currentFeedback) {
        handleNext();
        return;
      }

      if (!isTyping && e.key.toLowerCase() === "s" && !currentFeedback && !isSubmitting) {
        handleSkip();
        return;
      }

      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !currentFeedback && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentFeedback, isSubmitting, handleNext, handleSkip, handleSubmit, handleEndSession]);

  // ── Statuses ─────────────────────────────────────────────────────────────────
  const questionStatuses: QuestionStatus[] = questions.map((_, i) => {
    if (i < currentIndex) return allAnswers[i]?.score === 0 ? "skipped" : "answered";
    if (i === currentIndex) return "current";
    return "pending";
  });

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (isLoadingQuestions || (!config && !loadError)) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <Loader label="Loading questions…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-[var(--text-primary)] font-semibold text-lg">{loadError}</p>
        <button
          onClick={() => router.push("/login")}
          className="px-6 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (!config || questions.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <Loader label="Preparing your session…" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] overflow-hidden">
      <Sidebar
        role={config.role}
        difficulty={config.difficulty}
        voiceMode={config.voiceMode}
        questionCount={totalQuestions}
        currentIndex={currentIndex}
        questionStatuses={questionStatuses}
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        onEndSession={() => handleEndSession()}
      />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto relative">
        <div className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-md border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between pr-4 sm:pr-6 lg:pr-12">
            <EnhancedProgress
              current={currentIndex + 1}
              total={totalQuestions}
              statuses={questionStatuses}
            />
            <div className="shrink-0 pl-2">
              <QuestionTimer
                timeLeft={timeLeft}
                total={QUESTION_TIME_LIMIT}
                paused={timerPaused || !!currentFeedback}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-8 sm:px-6 lg:px-12 w-full max-w-4xl mx-auto flex flex-col gap-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex flex-col gap-6"
            >
              <motion.div
                className="flex flex-col gap-3"
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.05, ease: "easeOut" }}
              >
                <QuestionCard
                  question={currentQuestion}
                  index={currentIndex}
                  total={totalQuestions}
                  direction={direction}
                />
                <div className="self-end">
                  <VoicePlayer text={currentQuestion.text} />
                </div>
              </motion.div>

              <AnimatePresence mode="wait">
                {!currentFeedback ? (
                  <motion.div
                    key="answer"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <AnswerInput
                      answer={answerText}
                      setAnswer={setAnswerText}
                      onSubmit={handleSubmit}
                      isSubmitting={isSubmitting}
                      voiceModeEnabled={config.voiceMode}
                    />
                    <motion.div
                      className="flex items-center justify-between mt-4 px-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <span className="text-xs text-[var(--text-muted)]">
                        <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)]">
                          ⌘↵
                        </kbd>{" "}
                        to submit
                      </span>
                      <button
                        onClick={handleSkip}
                        disabled={isSubmitting}
                        className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors underline-offset-4 hover:underline flex items-center gap-1.5"
                      >
                        Skip Question
                        <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)]">
                          S
                        </kbd>
                      </button>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="feedback"
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  >
                    <FeedbackCard
                      feedback={currentFeedback}
                      onNext={handleNext}
                      onSkip={handleSkip}
                      onReplayQuestion={handleReplayQuestion}
                      isLast={currentIndex + 1 >= totalQuestions}
                    />
                    <motion.div
                      className="flex justify-end mt-3 px-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <span className="text-xs text-[var(--text-muted)]">
                        Press{" "}
                        <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)]">
                          N
                        </kbd>{" "}
                        for next question
                      </span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <KeyboardShortcuts hasFeedback={!!currentFeedback} />
    </div>
  );
}