import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "blue" | "green" | "red" | "gray" | "yellow" | "purple";
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<string, string> = {
  blue: "bg-[rgba(37,99,235,0.12)] text-[#60a5fa] border border-[rgba(37,99,235,0.2)]",
  green: "bg-[rgba(22,163,74,0.1)] text-[#4ade80] border border-[rgba(22,163,74,0.2)]",
  red: "bg-[rgba(239,68,68,0.1)] text-[#f87171] border border-[rgba(239,68,68,0.2)]",
  gray: "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)]",
  yellow: "bg-[rgba(245,158,11,0.1)] text-[#fbbf24] border border-[rgba(245,158,11,0.2)]",
  purple: "bg-[rgba(139,92,246,0.1)] text-[#a78bfa] border border-[rgba(139,92,246,0.2)]",
};

export function Badge({
  children,
  variant = "gray",
  className = "",
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 dot-pulse ${
            variant === "blue"
              ? "bg-[#60a5fa]"
              : variant === "green"
              ? "bg-[#4ade80]"
              : variant === "red"
              ? "bg-[#f87171]"
              : "bg-[var(--text-muted)]"
          }`}
        />
      )}
      {children}
    </span>
  );
}
