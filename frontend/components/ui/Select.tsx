"use client";

import React from "react";
import { RiArrowDownSLine } from "react-icons/ri";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, id, className = "", ...rest }: SelectProps) {
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
        <select
          id={id}
          className={[
            "w-full appearance-none rounded-lg border bg-[var(--bg-elevated)] px-3 py-2.5 pr-9 text-sm",
            "text-[var(--text-primary)] border-[var(--border)]",
            "focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none",
            "transition-colors duration-150 cursor-pointer",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <RiArrowDownSLine className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
      </div>
    </div>
  );
}
