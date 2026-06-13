"use client";

import React from "react";
import { motion } from "framer-motion";

interface ProgressBarProps {
  current: number;
  total: number;
  className?: string;
}

export function ProgressBar({ current, total, className = "" }: ProgressBarProps) {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className={`w-full bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 sm:px-6 lg:px-8 py-3 ${className}`}>
      <div className="max-w-6xl mx-auto flex items-center gap-4">
        <span className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
          Question {current} of {total}
        </span>
        <div
          className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Question ${current} of ${total}`}
        >
          <motion.div
            className="h-full bg-[#2563EB] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
        <span className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
          {percentage}%
        </span>
      </div>
    </div>
  );
}
