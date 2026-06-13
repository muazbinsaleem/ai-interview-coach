"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ScoreGaugeProps {
  score: number;
}

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const [mounted, setMounted] = useState(false);
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / 10, 1);
  const offset = circumference * (1 - pct);

  const color =
    score >= 8 ? "#4ade80" : score >= 6 ? "#60a5fa" : "#f87171";

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative flex items-center justify-center w-48 h-48">
      <svg
        width="192"
        height="192"
        viewBox="0 0 192 192"
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="96"
          cy="96"
          r={radius}
          fill="none"
          className="stroke-[var(--border)]"
          strokeWidth="12"
        />
        {mounted && (
          <motion.circle
            cx="96"
            cy="96"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="text-5xl font-bold tracking-tight"
          style={{ color }}
        >
          {score.toFixed(1)}
        </span>
        <span className="text-sm text-[var(--text-muted)] font-medium mt-1">out of 10</span>
      </div>
    </div>
  );
}
