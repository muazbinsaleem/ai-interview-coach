import React from "react";

interface ProgressBarProps {
  current: number;
  total: number;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ current, total, className = "", showLabel = false }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={["flex flex-col gap-1", className].filter(Boolean).join(" ")}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Question {current} of {total}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div className="w-full h-0.5 bg-[var(--border-subtle)] overflow-hidden">
        <div
          className="h-full bg-[#2563EB] progress-bar-fill"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`Question ${current} of ${total}`}
        />
      </div>
    </div>
  );
}
