"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { InterviewSession } from "@/lib/types";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  session: InterviewSession;
}

function getScoreVariant(score: number): "green" | "blue" | "yellow" | "red" {
  if (score >= 8) return "green";
  if (score >= 7) return "blue";
  if (score >= 6) return "yellow";
  return "red";
}

export function ReportModal({ open, onClose, session }: ReportModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Full Interview Report" maxWidth="max-w-3xl">
      <div className="flex flex-col gap-8">
        {/* Session Summary */}
        <div className="flex flex-col gap-3 pb-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Badge variant="blue">{session.config.role}</Badge>
            <Badge variant="gray">{session.config.difficulty}</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            This comprehensive report contains all questions, your submitted answers, and the detailed AI feedback for each response. Use this to identify patterns in your performance and areas for targeted study.
          </p>
        </div>

        {/* Detailed Q&A */}
        <div className="flex flex-col gap-8">
          {session.answers.map((answer, idx) => {
            const question = session.questions[idx];
            if (!question) return null;

            return (
              <div 
                key={`${answer.questionId}-${idx}`} 
                className="flex flex-col gap-4 pb-8 border-b border-[var(--border-subtle)] last:border-0 last:pb-0"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Question {idx + 1}
                    </span>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">
                      {question.text}
                    </h3>
                  </div>
                  <Badge variant={getScoreVariant(answer.score)} className="shrink-0 w-fit">
                    Score: {answer.score}/10
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-4">
                    {/* User Answer */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                        Your Answer
                      </span>
                      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3 text-sm text-[var(--text-primary)] leading-relaxed min-h-[100px]">
                        {answer.text || <span className="italic text-[var(--text-muted)]">No answer provided.</span>}
                      </div>
                    </div>

                    {/* Model Answer */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                        Model Answer
                      </span>
                      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-3 text-sm text-[var(--text-primary)] leading-relaxed">
                        {answer.suggestedAnswer}
                      </div>
                    </div>
                  </div>

                  {/* Feedback */}
                  <div className="flex flex-col gap-4">
                    <div className="rounded-lg border border-[rgba(22,163,74,0.2)] bg-[rgba(22,163,74,0.05)] p-4 h-full">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#4ade80] mb-3">
                        Strengths
                      </h4>
                      <ul className="flex flex-col gap-2">
                        {answer.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                            <span className="text-[#4ade80] shrink-0 mt-0.5">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-lg border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.05)] p-4 h-full">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#fbbf24] mb-3">
                        Areas to Improve
                      </h4>
                      <ul className="flex flex-col gap-2">
                        {answer.weaknesses.map((w, i) => (
                          <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                            <span className="text-[#fbbf24] shrink-0 mt-0.5">•</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}