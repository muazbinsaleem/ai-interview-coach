"use client";

import React, { useEffect, useState, useRef } from "react";
import { RiVolumeUpLine, RiStopLine } from "react-icons/ri";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";

interface VoicePlayerProps {
  text: string;
  className?: string;
}

// Animated sound bars shown while speaking
function SoundBars() {
  return (
    <span className="voice-player__bars" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="voice-player__bar" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

export function VoicePlayer({ text, className = "" }: VoicePlayerProps) {
  const { speak, stop, speaking } = useTextToSpeech();
  const [mounted, setMounted] = useState(false);
  const [ripple, setRipple] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = () => {
    setRipple(true);
    setTimeout(() => setRipple(false), 600);
    speaking ? stop() : speak(text);
  };

  if (!mounted) return null;

  return (
    <>
      <style>{`
        .voice-player {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-family: 'DM Mono', 'Fira Mono', monospace;
          font-weight: 500;
          letter-spacing: 0.04em;
          cursor: pointer;
          border: 1px solid transparent;
          overflow: hidden;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          outline: none;
          text-transform: uppercase;
        }
        .voice-player--idle {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.45);
        }
        .voice-player--idle:hover {
          background: rgba(255,255,255,0.09);
          border-color: rgba(255,255,255,0.22);
          color: rgba(255,255,255,0.85);
          box-shadow: 0 0 18px rgba(99,179,237,0.12);
        }
        .voice-player--speaking {
          background: rgba(59,130,246,0.15);
          border-color: rgba(96,165,250,0.5);
          color: #93c5fd;
          box-shadow: 0 0 22px rgba(59,130,246,0.25), inset 0 0 12px rgba(59,130,246,0.08);
        }
        .voice-player__icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }
        .voice-player--idle:hover .voice-player__icon {
          transform: scale(1.15);
        }
        /* Ripple */
        .voice-player__ripple {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: radial-gradient(circle at center, rgba(96,165,250,0.35) 0%, transparent 70%);
          animation: vp-ripple 0.6s ease-out forwards;
          pointer-events: none;
        }
        @keyframes vp-ripple {
          from { opacity: 1; transform: scale(0.5); }
          to   { opacity: 0; transform: scale(2); }
        }
        /* Sound bars */
        .voice-player__bars {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          height: 14px;
        }
        .voice-player__bar {
          display: block;
          width: 2.5px;
          border-radius: 99px;
          background: #93c5fd;
          animation: vp-bar 0.7s ease-in-out infinite alternate;
          transform-origin: bottom;
        }
        .voice-player__bar:nth-child(1) { height: 6px;  animation-duration: 0.55s; }
        .voice-player__bar:nth-child(2) { height: 11px; animation-duration: 0.70s; }
        .voice-player__bar:nth-child(3) { height: 8px;  animation-duration: 0.60s; }
        .voice-player__bar:nth-child(4) { height: 13px; animation-duration: 0.75s; }
        @keyframes vp-bar {
          from { transform: scaleY(0.35); opacity: 0.5; }
          to   { transform: scaleY(1);    opacity: 1;   }
        }
      `}</style>

      <button
        onClick={handleClick}
        className={[
          "voice-player",
          speaking ? "voice-player--speaking" : "voice-player--idle",
          className,
        ].join(" ")}
        aria-label={speaking ? "Stop speaking" : "Listen to question"}
      >
        {ripple && <span className="voice-player__ripple" />}

        {speaking ? (
          <>
            <SoundBars />
            <span>Speaking</span>
            <RiStopLine className="voice-player__icon" />
          </>
        ) : (
          <>
            <RiVolumeUpLine className="voice-player__icon" />
            <span>Listen</span>
          </>
        )}
      </button>
    </>
  );
}