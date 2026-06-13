"use client";

import React from "react";
import { RiSunLine, RiMoonLine } from "react-icons/ri";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors border border-transparent hover:border-[var(--border)]"
    >
      {theme === "dark" ? (
        <RiSunLine className="w-4 h-4" />
      ) : (
        <RiMoonLine className="w-4 h-4" />
      )}
    </button>
  );
}
