"use client";

import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  showCharCount?: boolean;
  maxLength?: number;
}

export function Textarea({
  label,
  hint,
  error,
  showCharCount = false,
  maxLength,
  className = "",
  id,
  value,
  ...rest
}: TextareaProps) {
  const charCount = typeof value === "string" ? value.length : 0;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-[var(--text-secondary)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <textarea
          id={id}
          value={value}
          maxLength={maxLength}
          className={[
            "w-full rounded-lg border bg-[var(--bg-elevated)] px-3 py-2.5 text-sm",
            "text-[var(--text-primary)] placeholder-[var(--text-muted)]",
            "border-[var(--border)] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]",
            "outline-none transition-colors duration-150 resize-none leading-relaxed",
            error ? "border-[#ef4444]" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />
        {(showCharCount || maxLength) && (
          <span className="absolute bottom-2.5 right-3 text-xs text-[var(--text-muted)] pointer-events-none select-none">
            {charCount}
            {maxLength ? ` / ${maxLength}` : ""}
          </span>
        )}
      </div>
      {hint && !error && (
        <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-[#ef4444]">{error}</p>
      )}
    </div>
  );
}
