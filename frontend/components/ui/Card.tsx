import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  padding?: boolean;
}

export function Card({ children, className = "", glow = false, padding = true }: CardProps) {
  return (
    <div
      className={[
        "rounded-xl border",
        "bg-[var(--bg-surface)] border-[var(--border)]",
        "shadow-[0_1px_3px_rgba(0,0,0,0.3)]",
        glow ? "card-hover-glow" : "",
        padding ? "p-5" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
