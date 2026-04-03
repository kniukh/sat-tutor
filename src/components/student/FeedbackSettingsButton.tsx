"use client";

import { useEffect, useRef, useState } from "react";
import { primeFeedbackAudio } from "@/services/feedback/feedback-effects.client";
import { useFeedbackSettings } from "@/services/feedback/use-feedback-settings";

function SoundIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M4.5 7.25h2.35l3.15-2.7v10.9l-3.15-2.7H4.5z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      {muted ? (
        <path
          d="M12.8 7.2l3.7 5.6M16.5 7.2l-3.7 5.6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      ) : (
        <path
          d="M13.3 8.1a3.4 3.4 0 010 3.8M15.3 6.5a5.8 5.8 0 010 7"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.4"
        />
      )}
    </svg>
  );
}

function HapticIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
      <rect
        x="5.3"
        y="3.3"
        width="9.4"
        height="13.4"
        rx="2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8.2 14h3.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
      {muted ? (
        <path
          d="M4.3 4.3l11.4 11.4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      ) : (
        <path
          d="M3.2 7.2h.8M3.2 10h.8M16 7.2h.8M16 10h.8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.4"
        />
      )}
    </svg>
  );
}

export default function FeedbackSettingsButton({
  tone = "light",
  label = "Feedback",
}: {
  tone?: "light" | "dark";
  label?: string;
}) {
  const { settings, updateSettings } = useFeedbackSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={
          tone === "dark"
            ? "inline-flex items-center gap-2 text-sm font-semibold text-white/75 underline underline-offset-4"
            : "hero-link inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4"
        }
      >
        <span>{label}</span>
        <span className={tone === "dark" ? "inline-flex items-center gap-1 text-white/55" : "token-text-muted inline-flex items-center gap-1"}>
          <SoundIcon muted={!settings.soundEnabled} />
          <HapticIcon muted={!settings.hapticEnabled} />
        </span>
      </button>

      {open ? (
        <div className="surface-panel absolute right-0 top-[calc(100%+0.75rem)] z-50 w-72 rounded-[1.5rem] p-4 shadow-[var(--shadow-elevated)]">
          <div className="token-text-primary text-sm font-semibold">Feedback settings</div>
          <div className="token-text-secondary mt-1 text-sm leading-6">
            Keep answer feedback satisfying without making practice noisy.
          </div>
          <div className="token-text-muted mt-2 inline-flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="surface-soft-panel inline-flex items-center gap-1 rounded-full px-2.5 py-1">
              <SoundIcon muted={!settings.soundEnabled} />
              {settings.soundEnabled ? "Sound on" : "Sound muted"}
            </span>
            <span className="surface-soft-panel inline-flex items-center gap-1 rounded-full px-2.5 py-1">
              <HapticIcon muted={!settings.hapticEnabled} />
              {settings.hapticEnabled ? "Haptics on" : "Haptics muted"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="app-card-soft flex items-center justify-between gap-3 p-3">
              <div>
                <div className="token-text-primary inline-flex items-center gap-2 text-sm font-semibold">
                  <SoundIcon muted={!settings.soundEnabled} />
                  <span>Sound</span>
                </div>
                <div className="token-text-muted text-xs">Short answer and completion tones</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextValue = !settings.soundEnabled;
                  if (nextValue) {
                    primeFeedbackAudio();
                  }
                  updateSettings({ soundEnabled: nextValue });
                }}
                className={settings.soundEnabled ? "primary-button px-4 py-2 text-sm" : "secondary-button px-4 py-2 text-sm"}
              >
                {settings.soundEnabled ? "On" : "Off"}
              </button>
            </div>

            <div className="app-card-soft flex items-center justify-between gap-3 p-3">
              <div>
                <div className="token-text-primary inline-flex items-center gap-2 text-sm font-semibold">
                  <HapticIcon muted={!settings.hapticEnabled} />
                  <span>Haptics</span>
                </div>
                <div className="token-text-muted text-xs">Light vibration on supported devices</div>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ hapticEnabled: !settings.hapticEnabled })}
                className={settings.hapticEnabled ? "primary-button px-4 py-2 text-sm" : "secondary-button px-4 py-2 text-sm"}
              >
                {settings.hapticEnabled ? "On" : "Off"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
