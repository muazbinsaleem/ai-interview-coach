"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { VoiceRecorder } from "./VoiceRecorder";
import { RiKeyboardLine, RiMicLine } from "react-icons/ri";

interface AnswerInputProps {
  answer: string;
  setAnswer: (val: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  voiceModeEnabled?: boolean;
}

export function AnswerInput({
  answer,
  setAnswer,
  onSubmit,
  isSubmitting,
  voiceModeEnabled = false,
}: AnswerInputProps) {
  const [activeTab, setActiveTab] = useState<"text" | "voice">(
    voiceModeEnabled ? "voice" : "text"
  );

  return (
    <Card className="flex flex-col gap-0 p-0 overflow-visible">  {/* ← Changed from overflow-hidden */}
      {/* Tabs */}
      <div className="flex items-center border-b border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 gap-1 shrink-0">
        <button
          onClick={() => setActiveTab("text")}
          className={[
            "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors",
            activeTab === "text"
              ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]",
          ].join(" ")}
        >
          <RiKeyboardLine className="w-4 h-4" />
          Type Answer
        </button>
        <button
          onClick={() => setActiveTab("voice")}
          className={[
            "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors",
            activeTab === "voice"
              ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]",
          ].join(" ")}
        >
          <RiMicLine className="w-4 h-4" />
          Voice Answer
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {activeTab === "text" ? (
          <>
            <Textarea
              id="answer-textarea"
              rows={6}
              placeholder="Explain your approach clearly. Mention trade-offs where relevant."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={isSubmitting}
              showCharCount
            />
            <Button
              id="submit-answer-btn"
              variant="primary"
              size="md"
              fullWidth
              loading={isSubmitting}
              disabled={!answer.trim()}
              onClick={onSubmit}
            >
              {isSubmitting ? "Evaluating..." : "Submit & Get Feedback"}
            </Button>
          </>
        ) : (
          <VoiceRecorder
            onComplete={(transcript) => {
              setAnswer(transcript);
              setActiveTab("text");
            }}
          />
        )}
      </div>
    </Card>
  );
}