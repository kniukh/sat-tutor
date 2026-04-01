"use client";

import type { FeedbackSettings } from "./feedback-preferences.client";

export type FeedbackCue = "correct" | "incorrect" | "combo" | "completion";

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let activeNodes: Array<OscillatorNode | GainNode> = [];

function getAudioContext() {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.14;
    masterGain.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume().catch(() => undefined);
  }

  return audioContext;
}

function clearActiveNodes() {
  for (const node of activeNodes) {
    try {
      node.disconnect();
    } catch {}

    if ("stop" in node && typeof node.stop === "function") {
      try {
        node.stop();
      } catch {}
    }
  }

  activeNodes = [];
}

function playTone(params: {
  type: OscillatorType;
  fromHz: number;
  toHz: number;
  durationMs: number;
  gain: number;
  delayMs?: number;
}) {
  const context = getAudioContext();
  if (!context || !masterGain) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startAt = context.currentTime + (params.delayMs ?? 0) / 1000;
  const endAt = startAt + params.durationMs / 1000;

  oscillator.type = params.type;
  oscillator.frequency.setValueAtTime(params.fromHz, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(60, params.toHz),
    endAt
  );

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, params.gain), startAt + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(gainNode);
  gainNode.connect(masterGain);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.02);

  activeNodes.push(oscillator, gainNode);
}

function playSound(cue: FeedbackCue) {
  clearActiveNodes();

  switch (cue) {
    case "correct":
      playTone({
        type: "triangle",
        fromHz: 720,
        toHz: 980,
        durationMs: 110,
        gain: 0.08,
      });
      break;
    case "incorrect":
      playTone({
        type: "sine",
        fromHz: 210,
        toHz: 150,
        durationMs: 120,
        gain: 0.09,
      });
      break;
    case "combo":
      playTone({
        type: "triangle",
        fromHz: 920,
        toHz: 1260,
        durationMs: 120,
        gain: 0.085,
      });
      break;
    case "completion":
      playTone({
        type: "triangle",
        fromHz: 700,
        toHz: 880,
        durationMs: 120,
        gain: 0.07,
      });
      playTone({
        type: "triangle",
        fromHz: 880,
        toHz: 1120,
        durationMs: 130,
        gain: 0.075,
        delayMs: 95,
      });
      playTone({
        type: "sine",
        fromHz: 1120,
        toHz: 1360,
        durationMs: 150,
        gain: 0.08,
        delayMs: 185,
      });
      break;
  }
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }

  navigator.vibrate(pattern);
}

function playHaptic(cue: FeedbackCue) {
  switch (cue) {
    case "correct":
      vibrate(10);
      break;
    case "incorrect":
      vibrate(20);
      break;
    case "combo":
      vibrate([10, 28, 10]);
      break;
    case "completion":
      vibrate([12, 30, 12, 30, 18]);
      break;
  }
}

export function primeFeedbackAudio() {
  getAudioContext();
}

export function triggerFeedbackCue(cue: FeedbackCue, settings: FeedbackSettings) {
  if (settings.soundEnabled) {
    playSound(cue);
  }

  if (settings.hapticEnabled) {
    playHaptic(cue);
  }
}

export function getAnswerFeedbackCue(params: {
  isCorrect: boolean;
  comboCountAfter: number;
}) {
  if (!params.isCorrect) {
    return "incorrect" satisfies FeedbackCue;
  }

  if ([3, 5, 8].includes(params.comboCountAfter)) {
    return "combo" satisfies FeedbackCue;
  }

  return "correct" satisfies FeedbackCue;
}
