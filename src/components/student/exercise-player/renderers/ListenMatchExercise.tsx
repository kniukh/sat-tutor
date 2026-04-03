"use client";

import { useMemo, useRef, useState } from "react";
import ExerciseOptionList from "../ExerciseOptionList";
import AudioExercisePrompt from "../AudioExercisePrompt";
import {
  getExerciseCorrectAnswer,
  getExercisePairLeftId,
  getExercisePairRightId,
  getExercisePairs,
  type VocabExerciseOption,
} from "@/types/vocab-exercises";
import type { ExerciseRendererProps, ListenMatchExerciseData } from "../types";

function parseSelectedPairKeys(value: string) {
  if (!value.trim()) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function serializeSelectedPairKeys(pairKeys: string[]) {
  return pairKeys.length > 0 ? JSON.stringify(pairKeys) : "";
}

function buildFallbackOptions(
  exercise: ListenMatchExerciseData
): { leftOptions: VocabExerciseOption[]; rightOptions: VocabExerciseOption[] } {
  const pairs = getExercisePairs(exercise);

  return {
    leftOptions: pairs.map((pair, index) => ({
      id: getExercisePairLeftId(pair),
      label: pair.left || `Audio ${index + 1}`,
    })),
    rightOptions: pairs.map((pair) => ({
      id: getExercisePairRightId(pair),
      label: pair.right,
    })),
  };
}

export default function ListenMatchExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
  feedbackReward,
  renderCaptureText,
}: ExerciseRendererProps<ListenMatchExerciseData>) {
  const pairs = getExercisePairs(exercise);
  const isPairMode = pairs.length > 1;
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [activeLeftId, setActiveLeftId] = useState<string | null>(null);
  const [activeRightId, setActiveRightId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const selectedPairKeys = parseSelectedPairKeys(selectedValue);
  const selectedPairs = selectedPairKeys.map((pairKey) => {
    const [leftId, rightId] = pairKey.split("::");
    return { key: pairKey, leftId, rightId };
  });
  const matchedLeftIds = new Set(selectedPairs.map((pair) => pair.leftId));
  const matchedRightIds = new Set(selectedPairs.map((pair) => pair.rightId));

  const fallbackOptions = useMemo(() => buildFallbackOptions(exercise), [exercise]);
  const leftOptions = useMemo(
    () =>
      exercise.options.filter((option) => option.id.startsWith("left-")).length > 0
        ? exercise.options.filter((option) => option.id.startsWith("left-"))
        : fallbackOptions.leftOptions,
    [exercise.options, fallbackOptions.leftOptions]
  );
  const rightOptions = useMemo(
    () =>
      exercise.options.filter((option) => option.id.startsWith("right-")).length > 0
        ? exercise.options.filter((option) => option.id.startsWith("right-"))
        : fallbackOptions.rightOptions,
    [exercise.options, fallbackOptions.rightOptions]
  );

  const visibleLeftOptions = leftOptions.filter((option) => !matchedLeftIds.has(option.id));
  const visibleRightOptions = rightOptions.filter((option) => !matchedRightIds.has(option.id));

  async function playPairAudio(leftId: string) {
    const pair = pairs.find((entry) => getExercisePairLeftId(entry) === leftId);
    const audioUrl = pair?.leftAudioUrl ?? pair?.left_audio_url ?? null;
    if (!audioUrl) {
      return;
    }

    const currentAudio = audioRefs.current[leftId];
    if (!currentAudio) {
      return;
    }

    try {
      setPlayingAudioId(leftId);
      currentAudio.currentTime = 0;
      await currentAudio.play();
    } catch (error) {
      console.error("listen match pair audio error", error);
      setPlayingAudioId(null);
    }
  }

  function commitPair(leftId: string, rightId: string) {
    const nextPairKeys = [
      ...selectedPairKeys.filter((pairKey) => {
        const [existingLeftId, existingRightId] = pairKey.split("::");
        return existingLeftId !== leftId && existingRightId !== rightId;
      }),
      `${leftId}::${rightId}`,
    ];

    setActiveLeftId(null);
    setActiveRightId(null);
    onSelect(serializeSelectedPairKeys(nextPairKeys));
  }

  function handleSelectLeft(leftId: string) {
    if (submitted) {
      return;
    }

    void playPairAudio(leftId);

    if (activeRightId) {
      commitPair(leftId, activeRightId);
      return;
    }

    setActiveLeftId((current) => (current === leftId ? null : leftId));
  }

  function handleSelectRight(rightId: string) {
    if (submitted) {
      return;
    }

    if (activeLeftId) {
      commitPair(activeLeftId, rightId);
      return;
    }

    setActiveRightId((current) => (current === rightId ? null : rightId));
  }

  function handleRemovePair(pairKey: string) {
    if (submitted) {
      return;
    }

    setActiveLeftId(null);
    setActiveRightId(null);
    onSelect(serializeSelectedPairKeys(selectedPairKeys.filter((key) => key !== pairKey)));
  }

  function handleReset() {
    if (submitted || selectedPairKeys.length === 0) {
      return;
    }

    setActiveLeftId(null);
    setActiveRightId(null);
    onSelect("");
  }

  if (!isPairMode) {
    return (
      <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start">
        <div className="drill-context-surface p-4">
          <div className="token-text-muted mb-2 text-xs font-semibold uppercase tracking-[0.16em]">
            Audio
          </div>
          <AudioExercisePrompt
            exercise={exercise}
            fallbackContent={<>Audio is unavailable for this listening exercise right now.</>}
          />
        </div>

        <div className="space-y-3">
          <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.16em]">
            {exercise.variant === "translation"
              ? exercise.rightColumnLabel ?? exercise.right_column_label ?? "Translations"
              : exercise.rightColumnLabel ?? exercise.right_column_label ?? "Meanings"}
          </div>
          <ExerciseOptionList
            options={exercise.options}
            selectedOptionId={selectedValue || null}
            correctOptionId={getExerciseCorrectAnswer(exercise)}
            submitted={submitted}
            feedbackReward={feedbackReward}
            onSelect={onSelect}
            renderOptionLabel={({ option, isDistractor }) =>
              renderCaptureText
                ? renderCaptureText({
                    text: option.label,
                    contextText: exercise.questionText ?? exercise.prompt ?? option.label,
                    isDistractor,
                  })
                : option.label
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="drill-context-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.16em]">
            Match Progress
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={submitted || selectedPairKeys.length === 0}
            className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Reset
          </button>
        </div>

        <div className="mt-3 flex min-h-16 flex-wrap gap-2 rounded-[18px] border border-dashed border-slate-300 bg-white p-3">
          {selectedPairs.length > 0 ? (
            selectedPairs.map((pair) => {
              const leftLabel =
                leftOptions.find((option) => option.id === pair.leftId)?.label ?? pair.leftId;
              const rightLabel =
                rightOptions.find((option) => option.id === pair.rightId)?.label ?? pair.rightId;

              return (
                <button
                  key={pair.key}
                  type="button"
                  onClick={() => handleRemovePair(pair.key)}
                  disabled={submitted}
                  className="rounded-2xl border border-slate-300 bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
                  aria-label={`Remove match ${leftLabel} to ${rightLabel}`}
                >
                  {leftLabel} {"->"} {rightLabel}
                </button>
              );
            })
          ) : (
            <div className="text-sm leading-6 text-slate-400">
              Play an audio clip on the left, then tap its matching item on the right.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3" role="list" aria-label="Audio column">
          <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.16em]">
            {exercise.leftColumnLabel ?? exercise.left_column_label ?? "Audio"}
          </div>
          {visibleLeftOptions.map((option) => {
            const pair = pairs.find((entry) => getExercisePairLeftId(entry) === option.id);
            const audioUrl = pair?.leftAudioUrl ?? pair?.left_audio_url ?? null;
            const isActive = activeLeftId === option.id;
            const isPlaying = playingAudioId === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelectLeft(option.id)}
                disabled={submitted}
                className={`rounded-[18px] border px-4 py-3 text-left transition-all active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
                  isActive
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className={`mt-1 text-xs ${isActive ? "text-white/75" : "text-slate-500"}`}>
                      {audioUrl ? (isPlaying ? "Playing..." : "Tap to play") : "Audio unavailable"}
                    </div>
                  </div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-white shadow-[var(--shadow-button)]">
                    {isPlaying ? "..." : "▶"}
                  </span>
                </div>
                {audioUrl ? (
                  <audio
                    ref={(node) => {
                      audioRefs.current[option.id] = node;
                    }}
                    src={audioUrl}
                    preload="none"
                    onEnded={() => setPlayingAudioId((current) => (current === option.id ? null : current))}
                    onPause={() => setPlayingAudioId((current) => (current === option.id ? null : current))}
                    hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="space-y-3" role="list" aria-label="Meaning column">
          <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.16em]">
            {exercise.rightColumnLabel ??
              exercise.right_column_label ??
              (exercise.variant === "translation" ? "Translations" : "Meanings")}
          </div>
          {visibleRightOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelectRight(option.id)}
              disabled={submitted}
              className={`rounded-[18px] border px-4 py-3 text-left text-sm font-semibold transition-all active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
                activeRightId === option.id
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {renderCaptureText
                ? renderCaptureText({
                    text: option.label,
                    contextText: exercise.questionText ?? exercise.prompt ?? option.label,
                  })
                : option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
