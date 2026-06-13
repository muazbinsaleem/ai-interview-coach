"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { InterviewSession, Answer } from "@/lib/types";
import { RiArrowDownSLine } from "react-icons/ri";

interface PerformanceBreakdownProps {
  session: InterviewSession;
}

function getScoreVariant(score: number): "green" | "blue" | "yellow" | "red" {
  if (score >= 8) return "green";
  if (score >= 7) return "blue";
  if (score >= 6) return "yellow";
  return "red";
}

export function PerformanceBreakdown({ session }: PerformanceBreakdownProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  function toggleRow(idx: number) {
    const next = new Set(expandedRows);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedRows(next);
  }

  return (
    <Card padding={false} className="overflow-hidden">
      <div className="p-5 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Question Breakdown
        </h2>
      </div>
      <div className="flex flex-col">
        {session.answers.map((answer, idx) => {
          const question = session.questions[idx];
          if (!question) return null;
          const isExpanded = expandedRows.has(idx);

          return (
            <motion.div
              key={`${answer.questionId}-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.06 }}
              className="border-b border-[var(--border-subtle)] last:border-0"
            >
              <button
                onClick={() => toggleRow(idx)}
                className="w-full flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:p-5 text-left hover:bg-[var(--border-subtle)] transition-colors group"
              >
                <div className="flex items-center gap-3 w-full sm:w-auto sm:flex-1 min-w-0">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)]">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="gray" className="text-[10px] py-0">
                        {question.topic}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--text-primary)] font-medium truncate">
                      {question.text}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0 pl-10 sm:pl-0">
                  <Badge variant={getScoreVariant(answer.score)}>
                    Score: {answer.score}/10
                  </Badge>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--bg-elevated)] group-hover:bg-[var(--bg-surface)] transition-colors">
                    <RiArrowDownSLine
                      className={`w-5 h-5 text-[var(--text-muted)] transition-transform duration-300 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-2 flex flex-col gap-5">
                      {/* Full Question & Answer */}
                      <div className="flex flex-col gap-3">
                        <div className="rounded-lg bg-[var(--bg-elevated)] p-4 border border-[var(--border)]">
                          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                            Your Answer
                          </p>
                          <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                            {answer.text || <span className="italic text-[var(--text-muted)]">No answer provided.</span>}
                          </p>
                        </div>
                      </div>

                      {/* AI Feedback */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-[rgba(22,163,74,0.2)] bg-[rgba(22,163,74,0.05)] p-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#4ade80] mb-2">
                            Strengths
                          </h4>
                          <ul className="flex flex-col gap-1">
                            {answer.strengths.map((s, i) => (
                              <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                                <span className="text-[#4ade80] shrink-0">•</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.05)] p-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#fbbf24] mb-2">
                            Areas to Improve
                          </h4>
                          <ul className="flex flex-col gap-1">
                            {answer.weaknesses.map((w, i) => (
                              <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                                <span className="text-[#fbbf24] shrink-0">•</span>
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Model Answer */}
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                        <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                          Model Answer
                        </p>
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                          {answer.suggestedAnswer}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}