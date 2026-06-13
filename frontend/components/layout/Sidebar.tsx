"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  RiMenuFoldLine,
  RiMenuUnfoldLine,
  RiCheckLine,
  RiCircleLine,
  RiSubtractLine,
} from "react-icons/ri";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { QuestionStatus } from "@/lib/types";

interface SidebarProps {
  role: string;
  difficulty: string;
  voiceMode: boolean;
  questionCount: number;
  currentIndex: number;
  questionStatuses: QuestionStatus[];
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  onEndSession: () => void;
}

function StatusIcon({ status }: { status: QuestionStatus }) {
  if (status === "answered")
    return <RiCheckLine className="w-3.5 h-3.5 text-[#4ade80]" />;
  if (status === "current")
    return <span className="w-2 h-2 rounded-full bg-[#2563EB] dot-pulse" />;
  if (status === "skipped")
    return <RiSubtractLine className="w-3.5 h-3.5 text-[var(--text-muted)]" />;
  return <RiCircleLine className="w-3.5 h-3.5 text-[var(--text-muted)]" />;
}

function difficultyVariant(d: string): "yellow" | "blue" | "red" {
  if (d === "Junior") return "yellow";
  if (d === "Senior") return "red";
  return "blue";
}

export function Sidebar({
  role,
  difficulty,
  voiceMode,
  questionCount,
  currentIndex,
  questionStatuses,
  collapsed,
  onCollapse,
  onEndSession,
}: SidebarProps) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 60 : 240 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden"
      style={{ minHeight: "calc(100vh - 56px)" }}
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-3 py-3 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => onCollapse(!collapsed)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <RiMenuUnfoldLine className="w-4 h-4" />
          ) : (
            <RiMenuFoldLine className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Logo row (when expanded) */}
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-4 py-3"
        >
          <Link href="/" className="flex items-center gap-2 group w-fit">
            <Image
              src="/logo.webp"
              alt="InterviewAI Logo"
              width={32}
              height={32}
              className="rounded-lg shrink-0 group-hover:opacity-90 transition-opacity"
            />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              InterviewAI
            </span>
          </Link>
        </motion.div>
      )}

      {/* Session info */}
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-4 py-3 border-b border-[var(--border-subtle)] flex flex-col gap-2"
        >
          <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">
            Session
          </p>
          <Badge variant="blue" className="w-fit text-xs">
            {role}
          </Badge>
          <Badge variant={difficultyVariant(difficulty)} className="w-fit text-xs">
            {difficulty}
          </Badge>
          {voiceMode && (
            <Badge variant="purple" dot className="w-fit text-xs">
              Voice Mode
            </Badge>
          )}
        </motion.div>
      )}

      {/* Question navigator */}
      <div className="flex-1 px-2 py-3">
        {!collapsed && (
          <p className="px-2 mb-2 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">
            Questions
          </p>
        )}
        <div className="flex flex-col gap-1">
          {Array.from({ length: questionCount }).map((_, i) => {
            const status = questionStatuses[i] ?? "pending";
            const isCurrent = i === currentIndex;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={[
                  "flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs transition-colors",
                  collapsed ? "justify-center" : "",
                  isCurrent
                    ? "bg-[rgba(37,99,235,0.1)] text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]",
                ].join(" ")}
              >
                <span
                  className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold border ${
                    isCurrent
                      ? "border-[#2563EB] text-[#2563EB]"
                      : "border-[var(--border)] text-[var(--text-muted)]"
                  }`}
                >
                  {i + 1}
                </span>
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">Question {i + 1}</span>
                    <StatusIcon status={status} />
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* End session */}
      <div className="p-3 border-t border-[var(--border-subtle)]">
        {collapsed ? (
          <button
            onClick={onEndSession}
            title="End Session"
            className="w-full flex items-center justify-center p-2 rounded-lg text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <Button variant="danger" size="sm" fullWidth onClick={onEndSession}>
            End Session
          </Button>
        )}
      </div>
    </motion.aside>
  );
}
