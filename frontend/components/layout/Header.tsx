"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { RiMenuLine, RiCloseLine, RiDashboardLine, RiLogoutBoxLine, RiFileListLine, RiFileUserLine } from "react-icons/ri";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { auth } from "@/lib/auth";

const publicNavLinks = [
  { href: "/", label: "Home" },
  { href: "/interview", label: "Practice" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  // Check auth state on mount and on route changes
  useEffect(() => {
    setIsAuthed(auth.isAuthenticated());
  }, [pathname]);

  function handleLogout() {
    auth.clear();
    setIsAuthed(false);
    setMobileOpen(false);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--bg-base)]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="InterviewAI home"
        >
          <Image
            src="/logo.webp"
            alt="InterviewAI Logo"
            width={36}
            height={36}
            className="rounded-lg shadow-sm group-hover:opacity-90 transition-opacity"
          />
          <span className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
            InterviewAI
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {publicNavLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "text-[var(--text-primary)] bg-[var(--bg-elevated)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
          {isAuthed && (
            <>
              <Link
                href="/dashboard"
                className={[
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  pathname === "/dashboard"
                    ? "text-[var(--text-primary)] bg-[var(--bg-elevated)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]",
                ].join(" ")}
              >
                Dashboard
              </Link>
              <Link
                href="/history"
                className={[
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  pathname === "/history"
                    ? "text-[var(--text-primary)] bg-[var(--bg-elevated)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]",
                ].join(" ")}
              >
                History
              </Link>
              <Link
                href="/resume"
                className={[
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  pathname === "/resume"
                    ? "text-[var(--text-primary)] bg-[var(--bg-elevated)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]",
                ].join(" ")}
              >
                Resume
              </Link>
            </>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {isAuthed ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <RiDashboardLine className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
                aria-label="Log out"
              >
                <RiLogoutBoxLine className="w-3.5 h-3.5" />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors"
              >
                Get started
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <RiCloseLine className="w-5 h-5" /> : <RiMenuLine className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 flex flex-col gap-1">
          {publicNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              {link.label}
            </Link>
          ))}

          {isAuthed ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors flex items-center gap-2"
              >
                <RiDashboardLine className="w-4 h-4" /> Dashboard
              </Link>
              <Link
                href="/history"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors flex items-center gap-2"
              >
                <RiFileListLine className="w-4 h-4" /> History
              </Link>
              <Link
                href="/resume"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors flex items-center gap-2"
              >
                <RiFileUserLine className="w-4 h-4" /> Resume
              </Link>
              <button
                onClick={handleLogout}
                className="mt-1 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors text-left flex items-center gap-2"
              >
                <RiLogoutBoxLine className="w-4 h-4" /> Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="mt-1 px-3 py-2 rounded-lg text-sm font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors text-center"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
