"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Answer } from "@/lib/types";
import { RiArrowDownSLine } from "react-icons/ri";

interface FeedbackCardProps {
  feedback: Answer;
  onNext: () => void;
  onSkip: () => void;
  onReplayQuestion: () => void;
  isLast: boolean;
}

export function FeedbackCard({
  feedback,
  onNext,
  onSkip,
  onReplayQuestion,
  isLast,
}: FeedbackCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Safely get strengths and weaknesses with fallback to empty arrays
  const strengths = feedback.strengths || [];
  const weaknesses = feedback.weaknesses || [];

  const scoreVariant =
    feedback.score >= 8 ? "green" : feedback.score >= 6 ? "yellow" : "red";
  
  const scoreLabel =
    feedback.score >= 8
      ? "Strong Response"
      : feedback.score >= 6
      ? "Good Response"
      : "Needs Improvement";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card glow className="flex flex-col gap-5 border-[var(--border)] overflow-hidden">
        {/* Score Header */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-16 h-16 shrink-0">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <path
                className="text-[var(--border)] stroke-current"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                strokeWidth="3"
              />
              <motion.path
                initial={{ strokeDasharray: "0, 100" }}
                animate={{ strokeDasharray: `${feedback.score * 10}, 100` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={
                  scoreVariant === "green"
                    ? "text-[#4ade80] stroke-current"
                    : scoreVariant === "yellow"
                    ? "text-[#fbbf24] stroke-current"
                    : "text-[#f87171] stroke-current"
                }
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-[var(--text-primary)]">
                {feedback.score}
              </span>
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
              {scoreLabel}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {feedback.summary}
            </p>
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[rgba(22,163,74,0.2)] bg-[rgba(22,163,74,0.05)] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#4ade80] rounded-full" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#4ade80]">
                Strengths
              </h4>
            </div>
            <ul className="flex flex-col gap-2">
              {strengths.length > 0 ? (
                strengths.map((s, i) => (
                  <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                    <span className="text-[#4ade80] shrink-0 mt-0.5">•</span>
                    <span>{s}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-[var(--text-muted)] italic">No specific strengths identified.</li>
              )}
            </ul>
          </div>
          <div className="rounded-xl border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.05)] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#fbbf24] rounded-full" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#fbbf24]">
                Areas to Improve
              </h4>
            </div>
            <ul className="flex flex-col gap-2">
              {weaknesses.length > 0 ? (
                weaknesses.map((w, i) => (
                  <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                    <span className="text-[#fbbf24] shrink-0 mt-0.5">•</span>
                    <span>{w}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-[var(--text-muted)] italic">No specific areas identified.</li>
              )}
            </ul>
          </div>
        </div>

        {/* Model Answer Expandable */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--border-subtle)] transition-colors"
          >
            <span className="text-sm font-medium text-[var(--text-primary)]">
              View Model Answer
            </span>
            <RiArrowDownSLine
              className={`w-5 h-5 text-[var(--text-muted)] transition-transform duration-300 ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>
          <div
            className={`expand-content px-4 ${
              expanded ? "max-h-[500px] pb-4 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="h-px w-full bg-[var(--border)] mb-4" />
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
              {feedback.suggestedAnswer || "No model answer available."}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <Button variant="ghost" onClick={onReplayQuestion} size="sm">
            Replay Question
          </Button>
          <Button variant="ghost" onClick={onSkip} size="sm">
            Skip
          </Button>
          <Button variant="primary" onClick={onNext} size="sm">
            {isLast ? "Complete Session" : "Next Question"}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}