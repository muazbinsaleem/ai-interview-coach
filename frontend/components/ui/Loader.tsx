import React from "react";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const sizeMap = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };

export function Loader({ size = "md", className = "", label }: LoaderProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={[
          "rounded-full border-2 border-current border-t-transparent animate-spin",
          sizeMap[size],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        role="status"
        aria-label={label ?? "Loading"}
      />
      {label && (
        <span className="text-sm text-[var(--text-muted)]">{label}</span>
      )}
    </div>
  );
}

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "rounded-md bg-[var(--bg-elevated)] animate-pulse",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 flex flex-col gap-3">
      <SkeletonLine className="h-4 w-1/3" />
      <SkeletonLine className="h-5 w-full" />
      <SkeletonLine className="h-5 w-4/5" />
      <SkeletonLine className="h-4 w-2/3" />
    </div>
  );
}
