"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { auth } from "@/lib/auth";
import { apiGetResumes } from "@/lib/api";

interface SessionSetupProps {
  onStart: (config: {
    role: string;
    difficulty: string;
    voiceMode: boolean;
    narrateQuestions: boolean;
    useResumeSkills?: boolean;
    skills?: string[];
  }) => void;
}

const ROLES = [
  { value: "software engineer",   label: "Software Engineer" },
  { value: "data scientist",      label: "Data Scientist" },
  { value: "devops engineer",     label: "DevOps Engineer" },
  { value: "product manager",     label: "Product Manager" },
  { value: "qa analyst",          label: "QA Analyst" },
  { value: "ux designer",         label: "UX Designer" },
  { value: "hr specialist",       label: "HR Specialist" },
  { value: "marketing associate", label: "Marketing Associate" },
];

const DIFFICULTIES = [
  { value: "easy",   label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard",   label: "Hard" },
];

export function SessionSetup({ onStart }: SessionSetupProps) {
  const [role, setRole] = useState("software engineer");
  const [difficulty, setDifficulty] = useState("medium");
  const [voiceMode, setVoiceMode] = useState(true);
  const [narrateQuestions, setNarrateQuestions] = useState(true);
  const [useResumeSkills, setUseResumeSkills] = useState(false);
  const [storedSkills, setStoredSkills] = useState<string[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);

  // ── REFS to avoid race condition ──────────────────────────────────────────
  const storedSkillsRef = useRef<string[]>([]);
  const useResumeSkillsRef = useRef(false);

  // Load stored resume skills on mount
  useEffect(() => {
    const loadStoredSkills = async () => {
      if (auth.isAuthenticated()) {
        setLoadingSkills(true);
        try {
          const resumes = await apiGetResumes();
          if (resumes && resumes.length > 0) {
            const latestResume = resumes[0];
            const skills = latestResume.skills || [];
            
            // Update state
            setStoredSkills(skills);
            storedSkillsRef.current = skills;  // ← Sync ref
            
            // Auto-enable resume mode if skills exist
            if (skills.length > 0) {
              setUseResumeSkills(true);
              useResumeSkillsRef.current = true;  // ← Sync ref
            }
          }
        } catch (e) {
          console.error("Failed to load stored resume skills:", e);
        } finally {
          setLoadingSkills(false);
        }
      }
    };
    loadStoredSkills();
  }, []);

  return (
    <Card glow padding={false} className="w-full">
      <div className="p-6 border-b border-[var(--border)]">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Configure Your Session
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Select your role and preferences to start the interview.
        </p>
      </div>

      <div className="p-6 flex flex-col gap-6">
        <Select
          id="role-select"
          label="Target Role"
          options={ROLES}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        
        <Select
          id="difficulty-select"
          label="Interview Difficulty"
          options={DIFFICULTIES}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        />

        {/* Resume Skills Toggle */}
        {!loadingSkills && storedSkills.length > 0 && (
          <div className="flex items-center justify-between py-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Use Your Resume Skills
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {storedSkills.length} skills extracted: {storedSkills.slice(0, 5).join(", ")}
                {storedSkills.length > 5 && ` +${storedSkills.length - 5}`}
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={useResumeSkills}
                onChange={(e) => {
                  setUseResumeSkills(e.target.checked);
                  useResumeSkillsRef.current = e.target.checked;  // ← Sync ref
                }}
                aria-label="Toggle Resume Skills Mode"
              />
              <span className="toggle-slider" />
            </label>
          </div>
        )}

        {/* Loading indicator while fetching skills */}
        {loadingSkills && (
          <div className="flex items-center justify-center py-2">
            <span className="text-xs text-[var(--text-muted)]">Loading your resume skills...</span>
          </div>
        )}

        <div className="flex flex-col gap-4 py-2">
          {/* Voice Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Voice Mode
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                Answer questions using your microphone
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={voiceMode}
                onChange={(e) => setVoiceMode(e.target.checked)}
                aria-label="Toggle Voice Mode"
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Narrate Questions Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Narrate Questions
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                Automatically read questions aloud
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={narrateQuestions}
                onChange={(e) => setNarrateQuestions(e.target.checked)}
                aria-label="Toggle Narrate Questions"
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        <div className="pt-2">
          <Button
            id="start-interview-btn"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => onStart({ 
              role, 
              difficulty, 
              voiceMode, 
              narrateQuestions,
              useResumeSkills: useResumeSkillsRef.current,                    // ← READ FROM REF
              skills: useResumeSkillsRef.current ? storedSkillsRef.current : []  // ← READ FROM REF
            })}
          >
            Begin Interview
          </Button>
          <p className="text-center text-xs text-[var(--text-muted)] mt-4">
            5 questions — estimated 10 minutes
            {useResumeSkills && storedSkills.length > 0 && " · Using your resume skills"}
            {!useResumeSkills && storedSkills.length > 0 && " · Practice mode (generic questions)"}
          </p>
        </div>
      </div>
    </Card>
  );
}