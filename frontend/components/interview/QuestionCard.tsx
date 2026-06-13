"use client";

import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Question } from "@/lib/types";

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  direction?: number;
}

function difficultyBadgeVariant(d: string): "yellow" | "blue" | "red" {
  if (!d) return "blue";
  if (d === "easy") return "yellow";
  if (d === "hard") return "red";
  return "blue";
}

function formatDifficulty(difficulty: string): string {
  if (!difficulty) return "Medium";
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

export function QuestionCard({ question, index, total, direction = 1 }: QuestionCardProps) {
  // Ensure difficulty has a default value
  const difficulty = question.difficulty || "medium";
  const topic = question.topic || "General";

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: direction * 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction * -40 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 flex flex-col gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="blue" className="text-xs">
            {topic}
          </Badge>
          <Badge variant={difficultyBadgeVariant(difficulty)} className="text-xs">
            {formatDifficulty(difficulty)}
          </Badge>
        </div>
        <span className="text-xs text-[var(--text-muted)] shrink-0">
          {index + 1} / {total}
        </span>
      </div>

      {/* Question text */}
      <p className="text-base sm:text-lg font-semibold text-[var(--text-primary)] leading-snug">
        {question.text}
      </p>
    </motion.div>
  );
}