"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  RiMicLine,
  RiStopFill,
  RiCheckLine,
  RiRefreshLine,
  RiAlertLine,
} from "react-icons/ri";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

// ── Web Speech API types (not shipped in all TS dom libs) ─────────────────────
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onstart:        ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend:          ((this: ISpeechRecognition, ev: Event) => void) | null;
  onspeechstart:  ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult:       ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror:        ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

interface VoiceRecorderProps {
  onComplete: (transcript: string) => void;
}

type RecorderState = "idle" | "recording" | "done" | "error";

// Animated waveform bars for recording state
function WaveformBars({ count = 20 }: { count?: number }) {
  return (
    <div className="vr-waveform" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="vr-waveform__bar"
          style={{
            animationDelay: `${(i * 0.07) % 0.9}s`,
            animationDuration: `${0.5 + (i % 5) * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

// Confidence indicator dots
function ConfidenceDots({ confidence }: { confidence: number }) {
  const filled = Math.round(confidence * 5);
  return (
    <div className="vr-confidence" aria-label={`Confidence: ${Math.round(confidence * 100)}%`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`vr-confidence__dot ${i < filled ? "vr-confidence__dot--on" : ""}`}
        />
      ))}
      <span className="vr-confidence__label">{Math.round(confidence * 100)}%</span>
    </div>
  );
}

export function VoiceRecorder({ onComplete }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [editableTranscript, setEditableTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [pressed, setPressed] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [silenceSeconds, setSilenceSeconds] = useState(0);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpeechRef = useRef<number>(Date.now());
  const mounted = useRef(false);

  // Clear silence counter
  const resetSilenceTimer = useCallback(() => {
    lastSpeechRef.current = Date.now();
    setSilenceSeconds(0);
  }, []);

  const stopRecognition = useCallback(() => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
  }, []);

  const startRecognition = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setState("error");
      setErrorMsg("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition: ISpeechRecognition = new SpeechRecognitionCtor();

    // ── Accuracy-maximising settings ──────────────────────────────────
    recognition.continuous = true;          // don't cut off mid-sentence
    recognition.interimResults = true;      // show live partial results
    recognition.maxAlternatives = 3;        // consider top-3 hypotheses
    recognition.lang = "en-US";             // explicit locale = better model
    // ─────────────────────────────────────────────────────────────────

    let rollingFinal = "";

    recognition.onstart = () => {
      setState("recording");
      resetSilenceTimer();
      // Tick silence counter every second
      silenceTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - lastSpeechRef.current) / 1000);
        setSilenceSeconds(elapsed);
      }, 500);
    };

    recognition.onspeechstart = () => {
      resetSilenceTimer();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimer();
      let interim = "";
      let newFinals = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        // Pick the alternative with the highest confidence
        let best = result[0];
        for (let j = 1; j < result.length; j++) {
          if (result[j].confidence > best.confidence) best = result[j];
        }

        if (result.isFinal) {
          newFinals += best.transcript;
          if (best.confidence > 0) setConfidence(best.confidence);
        } else {
          interim += best.transcript;
          if (best.confidence > 0) setConfidence(best.confidence);
        }
      }

      if (newFinals) {
        rollingFinal += (rollingFinal ? " " : "") + newFinals.trim();
        setFinalTranscript(rollingFinal);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" is benign — just keep going; don't crash into error state
      if (event.error === "no-speech") return;
      if (event.error === "aborted") return;  // user-triggered stop
      stopRecognition();
      setState("error");
      const msgs: Record<string, string> = {
        "not-allowed": "Microphone access was denied. Please allow mic permissions and try again.",
        "network": "Network error during recognition. Check your connection.",
        "audio-capture": "No microphone found. Please connect one and try again.",
        "service-not-allowed": "Speech service blocked. Try Chrome or Edge.",
      };
      setErrorMsg(msgs[event.error] ?? `Recognition error: ${event.error}. Please try again.`);
    };

    recognition.onend = () => {
      // Auto-restart only if this instance is still the active one
      if (mounted.current && recognitionRef.current === recognition) {
        try { recognition.start(); } catch { /* ignore if already stopped */ }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setState("error");
      setErrorMsg("Failed to start microphone. Please try again.");
    }
  }, [resetSilenceTimer, stopRecognition]);

  const handleStop = useCallback(() => {
    // Detach so onend doesn't auto-restart
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      try { r.stop(); } catch {}
    }
    stopRecognition();
    setFinalTranscript((ft) => {
      const combined = (ft + " " + interimTranscript).trim();
      setEditableTranscript(combined);
      return combined;
    });
    setInterimTranscript("");
    setState("done");
  }, [interimTranscript, stopRecognition]);

  const handleMicClick = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 300);
    if (state === "recording") {
      handleStop();
    } else {
      setFinalTranscript("");
      setInterimTranscript("");
      setConfidence(0);
      startRecognition();
    }
  };

  const handleReset = () => {
    stopRecognition();
    setFinalTranscript("");
    setInterimTranscript("");
    setEditableTranscript("");
    setConfidence(0);
    setState("idle");
    setErrorMsg("");
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopRecognition();
    };
  }, [stopRecognition]);

  // Live display: final + interim
  const liveText = (finalTranscript + (interimTranscript ? " " + interimTranscript : "")).trim();

  return (
    <>
      <style>{`
        .vr-root {
          --vr-accent:      #ef4444;
          --vr-accent-soft: rgba(239,68,68,0.12);
          --vr-accent-glow: rgba(239,68,68,0.35);
          --vr-blue:        #3b82f6;
          --vr-blue-soft:   rgba(59,130,246,0.12);
          --vr-surface:     rgba(255,255,255,0.04);
          --vr-border:      rgba(255,255,255,0.08);
          --vr-text-dim:    rgba(255,255,255,0.35);
          --vr-text-mid:    rgba(255,255,255,0.6);
          --vr-text:        rgba(255,255,255,0.9);
          font-family: 'DM Mono', 'Fira Mono', 'Courier New', monospace;
        }

        /* ── Light mode overrides ── */
        :root.light .vr-root {
          --vr-surface:     rgba(0,0,0,0.03);
          --vr-border:      rgba(0,0,0,0.10);
          --vr-text-dim:    rgba(0,0,0,0.40);
          --vr-text-mid:    rgba(0,0,0,0.65);
          --vr-text:        rgba(0,0,0,0.88);
        }

        /* ── Error ── */
        .vr-error {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 40px 24px; gap: 14px; text-align: center;
        }
        .vr-error__icon-wrap {
          width: 52px; height: 52px; border-radius: 50%;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
          display: flex; align-items: center; justify-content: center;
        }
        .vr-error__icon { width: 22px; height: 22px; color: #ef4444; }
        .vr-error__title { font-size: 13px; font-weight: 600; color: #f87171; letter-spacing: 0.03em; margin-bottom: 4px; }
        .vr-error__sub   { font-size: 12px; color: var(--vr-text-mid); line-height: 1.5; max-width: 260px; }

        /* ── Done ── */
        .vr-done { display: flex; flex-direction: column; gap: 16px; animation: vr-fadein 0.3s ease; }
        @keyframes vr-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .vr-done__header {
          display: flex; align-items: center; gap: 8px;
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;
          color: var(--vr-text-dim); padding-bottom: 4px; border-bottom: 1px solid var(--vr-border);
        }
        .vr-done__header-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #4ade80; box-shadow: 0 0 6px rgba(74,222,128,0.6);
        }
        .vr-done__actions { display: flex; align-items: center; gap: 10px; }

        /* ── Main (idle/recording) ── */
        .vr-main {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 40px 24px; gap: 28px;
        }

        /* Mic button */
        .vr-mic-wrap {
          position: relative; display: flex; align-items: center;
          justify-content: center; width: 96px; height: 96px;
        }
        .vr-ring {
          position: absolute; border-radius: 50%;
          border: 1.5px solid var(--vr-accent); opacity: 0;
          animation: vr-ring 2s ease-out infinite;
        }
        .vr-ring:nth-child(1) { inset: -10px; animation-delay: 0s; }
        .vr-ring:nth-child(2) { inset: -22px; animation-delay: 0.5s; }
        .vr-ring:nth-child(3) { inset: -36px; animation-delay: 1s; }
        @keyframes vr-ring {
          0%   { opacity: 0.7; transform: scale(0.9); }
          100% { opacity: 0;   transform: scale(1.1); }
        }
        .vr-mic-btn {
          position: relative; z-index: 2; width: 68px; height: 68px;
          border-radius: 50%; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
          outline: none;
        }
        .vr-mic-btn--idle {
          background: var(--vr-surface); border: 1.5px solid var(--vr-border);
          color: var(--vr-text-dim);
        }
        .vr-mic-btn--idle:hover {
          background: var(--vr-surface); border-color: var(--vr-text-mid);
          color: var(--vr-text); transform: scale(1.06);
        }
        .vr-mic-btn--recording {
          background: var(--vr-accent); border: 1.5px solid rgba(239,68,68,0.4);
          color: #fff; box-shadow: 0 0 28px var(--vr-accent-glow), 0 0 60px rgba(239,68,68,0.15);
          transform: scale(1.08);
        }
        .vr-mic-btn--pressed { transform: scale(0.94) !important; }
        .vr-mic-icon { width: 28px; height: 28px; }

        /* Status area */
        .vr-status {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; min-height: 80px; text-align: center; width: 100%;
        }
        .vr-hint { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--vr-text-dim); }

        /* Live transcript box while recording */
        .vr-live-box {
          width: 100%; background: var(--vr-surface);
          border: 1px solid var(--vr-border); border-radius: 10px;
          padding: 12px 14px; min-height: 56px; font-size: 13px;
          color: var(--vr-text-mid); text-align: left; line-height: 1.6;
          word-break: break-word; position: relative;
        }
        .vr-live-box__interim { color: var(--vr-text-dim); font-style: italic; }
        .vr-live-box__placeholder { color: var(--vr-text-dim); font-style: italic; }

        /* Silence indicator */
        .vr-silence {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; color: var(--vr-text-dim); letter-spacing: 0.05em;
        }
        .vr-silence--warn { color: #fbbf24; }
        .vr-silence__dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: currentColor; animation: vr-blink 1s ease-in-out infinite;
        }
        @keyframes vr-blink { 0%,100%{opacity:0.3} 50%{opacity:1} }

        /* Confidence dots */
        .vr-confidence {
          display: flex; align-items: center; gap: 4px;
          font-size: 10px; color: var(--vr-text-dim); letter-spacing: 0.06em;
        }
        .vr-confidence__dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--vr-border); transition: background 0.3s;
        }
        .vr-confidence__dot--on { background: #4ade80; box-shadow: 0 0 4px rgba(74,222,128,0.5); }
        .vr-confidence__label { margin-left: 4px; }

        /* Waveform */
        .vr-waveform { display: flex; align-items: center; gap: 2.5px; height: 32px; }
        .vr-waveform__bar {
          display: block; width: 3px; background: var(--vr-accent); border-radius: 99px;
          animation: vr-wave 0.6s ease-in-out infinite alternate; transform-origin: center;
        }
        .vr-waveform__bar:nth-child(odd)  { height: 10px; }
        .vr-waveform__bar:nth-child(even) { height: 18px; }
        .vr-waveform__bar:nth-child(3n)   { height: 26px; background: rgba(239,68,68,0.55); }
        @keyframes vr-wave {
          from { transform: scaleY(0.25); opacity: 0.45; }
          to   { transform: scaleY(1);    opacity: 1; }
        }

        /* Tips */
        .vr-tips {
          display: flex; flex-direction: column; gap: 6px;
          font-size: 11px; color: var(--vr-text-dim); letter-spacing: 0.04em;
          border-top: 1px solid var(--vr-border); padding-top: 16px; width: 100%;
        }
        .vr-tips__row { display: flex; align-items: flex-start; gap: 6px; }
        .vr-tips__dot { flex-shrink: 0; margin-top: 5px; width: 4px; height: 4px; border-radius: 50%; background: var(--vr-text-dim); }
      `}</style>

      <div className="vr-root">

        {/* ── Error ── */}
        {state === "error" && (
          <div className="vr-error">
            <div className="vr-error__icon-wrap">
              <RiAlertLine className="vr-error__icon" />
            </div>
            <div>
              <p className="vr-error__title">Recognition unavailable</p>
              <p className="vr-error__sub">{errorMsg}</p>
            </div>
            <Button variant="ghost" onClick={handleReset} className="text-sm mt-2">
              <RiRefreshLine className="w-4 h-4 mr-1.5" /> Try Again
            </Button>
          </div>
        )}

        {/* ── Done ── */}
        {state === "done" && (
          <div className="vr-done">
            <div className="vr-done__header">
              <span className="vr-done__header-dot" />
              <span>Transcript captured</span>
              {confidence > 0 && <ConfidenceDots confidence={confidence} />}
            </div>
            <Textarea
              value={editableTranscript}
              onChange={(e) => setEditableTranscript(e.target.value)}
              rows={5}
              label="Edit your transcript"
              className="font-medium"
            />
            <div className="vr-done__actions">
              <Button variant="ghost" onClick={handleReset} className="shrink-0 text-sm">
                <RiRefreshLine className="w-4 h-4 mr-1.5" />
                Re-record
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={() => onComplete(editableTranscript)}
                disabled={!editableTranscript.trim()}
              >
                <RiCheckLine className="w-4 h-4 mr-1.5" />
                Use This Answer
              </Button>
            </div>
          </div>
        )}

        {/* ── Idle / Recording ── */}
        {(state === "idle" || state === "recording") && (
          <div className="vr-main">
            <div className="vr-mic-wrap">
              {state === "recording" && (
                <>
                  <span className="vr-ring" />
                  <span className="vr-ring" />
                  <span className="vr-ring" />
                </>
              )}
              <button
                onClick={handleMicClick}
                className={[
                  "vr-mic-btn",
                  state === "recording" ? "vr-mic-btn--recording" : "vr-mic-btn--idle",
                  pressed ? "vr-mic-btn--pressed" : "",
                ].join(" ")}
                aria-label={state === "recording" ? "Stop recording" : "Start recording"}
              >
                {state === "recording"
                  ? <RiStopFill className="vr-mic-icon" />
                  : <RiMicLine className="vr-mic-icon" />}
              </button>
            </div>

            <div className="vr-status">
              {state === "idle" && (
                <p className="vr-hint">Tap the mic to begin</p>
              )}

              {state === "recording" && (
                <>
                  <WaveformBars count={18} />

                  {/* Live transcript box */}
                  <div className="vr-live-box">
                    {liveText ? (
                      <>
                        <span>{finalTranscript}</span>
                        {interimTranscript && (
                          <span className="vr-live-box__interim">
                            {finalTranscript ? " " : ""}{interimTranscript}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="vr-live-box__placeholder">Listening — speak clearly…</span>
                    )}
                  </div>

                  {/* Confidence + silence */}
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    {confidence > 0 && <ConfidenceDots confidence={confidence} />}
                    <div className={`vr-silence ${silenceSeconds >= 4 ? "vr-silence--warn" : ""}`}>
                      <span className="vr-silence__dot" />
                      {silenceSeconds === 0
                        ? "Detecting speech…"
                        : silenceSeconds >= 4
                        ? `${silenceSeconds}s silence — still recording`
                        : `${silenceSeconds}s pause`}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Tips — shown only in idle */}
            {state === "idle" && (
              <div className="vr-tips">
                <div className="vr-tips__row">
                  <span className="vr-tips__dot" />
                  <span>Speak at a natural pace — pauses are handled automatically</span>
                </div>
                <div className="vr-tips__row">
                  <span className="vr-tips__dot" />
                  <span>Works best in Chrome or Edge with a quiet environment</span>
                </div>
                <div className="vr-tips__row">
                  <span className="vr-tips__dot" />
                  <span>You can edit the transcript before submitting</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}