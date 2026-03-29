"use client";

import { useMemo, useState } from "react";
import {
  getExerciseQuestionText,
  getExerciseTargetWord,
  type SupportedVocabExerciseType,
} from "@/types/vocab-exercises";
import ExercisePlayer from "./ExercisePlayer";
import { mockExercises } from "./mock-exercises";

const TYPE_LABELS: Record<SupportedVocabExerciseType, string> = {
  meaning_match: "Meaning Match",
  translation_match: "Translation Match",
  pair_match: "Pair Match",
  listen_match: "Listen Match",
  spelling_from_audio: "Spelling From Audio",
  sentence_builder: "Sentence Builder",
  error_detection: "Error Detection",
  fill_blank: "Fill Blank",
  context_meaning: "Context Meaning",
  synonym: "Synonym",
  collocation: "Collocation",
};

type GallerySelection = "all" | SupportedVocabExerciseType;
type GalleryMode = "single" | "sequence" | "loop_first_item";

const MODE_LABELS: Record<GalleryMode, string> = {
  single: "Single",
  sequence: "Sequence",
  loop_first_item: "Loop First Item",
};

function getModeDescription(mode: GalleryMode) {
  if (mode === "single") {
    return "Show just the first exercise from the current filtered set.";
  }

  if (mode === "loop_first_item") {
    return "Repeat the first exercise a few times to quickly iterate on the same UX.";
  }

  return "Run the current filtered set in order to verify transitions and pacing.";
}

export default function ExerciseGallery() {
  const [selection, setSelection] = useState<GallerySelection>("all");
  const [mode, setMode] = useState<GalleryMode>("sequence");

  const visibleExercises = useMemo(() => {
    if (selection === "all") {
      return mockExercises;
    }

    return mockExercises.filter((exercise) => exercise.type === selection);
  }, [selection]);

  const playerExercises = useMemo(() => {
    if (visibleExercises.length === 0) {
      return [];
    }

    if (mode === "single") {
      return visibleExercises.slice(0, 1);
    }

    if (mode === "loop_first_item") {
      const firstExercise = visibleExercises[0];

      return Array.from({ length: 4 }, (_, index) => ({
        ...firstExercise,
        id: `${firstExercise.id}:loop-${index + 1}`,
        metadata: {
          ...(firstExercise.metadata ?? {}),
          gallery_loop_index: index + 1,
        },
      }));
    }

    return visibleExercises;
  }, [mode, visibleExercises]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 text-white shadow-sm">
        <div className="space-y-5 p-6 sm:p-8">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Dev Gallery
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Exercise Gallery
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              Preview each vocab exercise type in isolation or run the full five-item sequence using
              the shared exercise shell.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <button
              type="button"
              onClick={() => setSelection("all")}
              className={`rounded-[24px] border px-4 py-4 text-left transition-all duration-200 ${
                selection === "all"
                  ? "border-white/15 bg-white/15 text-white shadow-[0_18px_35px_-24px_rgba(15,23,42,0.9)]"
                  : "border-white/10 bg-white/10 text-white/80 hover:border-white/20 hover:bg-white/15"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                View
              </div>
              <div className="mt-2 text-lg font-semibold">All Types</div>
            </button>

            {mockExercises.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => setSelection(exercise.type)}
                className={`rounded-[24px] border px-4 py-4 text-left transition-all duration-200 ${
                  selection === exercise.type
                    ? "border-white/15 bg-white/15 text-white shadow-[0_18px_35px_-24px_rgba(15,23,42,0.9)]"
                    : "border-white/10 bg-white/10 text-white/80 hover:border-white/20 hover:bg-white/15"
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                  Type
                </div>
                <div className="mt-2 text-sm font-semibold">{TYPE_LABELS[exercise.type]}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Preview Set
            </div>
            <h2 className="text-2xl font-semibold text-slate-950">
              {selection === "all"
                ? "Full Mock Sequence"
                : TYPE_LABELS[selection]}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              {selection === "all"
                ? "Run all current exercise types in sequence to verify transitions, audio states, and shared player behavior."
                : "Focus on one exercise type and iterate on its prompt block, answer states, and feedback rhythm."}
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            {playerExercises.length} exercise{playerExercises.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {(Object.keys(MODE_LABELS) as GalleryMode[]).map((modeOption) => {
            const isActive = modeOption === mode;

            return (
              <button
                key={modeOption}
                type="button"
                onClick={() => setMode(modeOption)}
                className={`rounded-[24px] border p-4 text-left transition-all duration-200 ${
                  isActive
                    ? "border-slate-900 bg-slate-950 text-white shadow-[0_18px_35px_-24px_rgba(15,23,42,0.9)]"
                    : "border-slate-200 bg-slate-50 text-slate-900 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{MODE_LABELS[modeOption]}</div>
                    <div
                      className={`mt-2 text-sm leading-6 ${
                        isActive ? "text-white/75" : "text-slate-600"
                      }`}
                    >
                      {getModeDescription(modeOption)}
                    </div>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      isActive
                        ? "border border-white/15 bg-white/10 text-white/80"
                        : "border border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    {isActive ? "Active" : "Use"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {playerExercises.map((exercise) => (
            <div
              key={`card-${exercise.id}`}
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {TYPE_LABELS[exercise.type]}
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950">
                {getExerciseTargetWord(exercise)}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                {getExerciseQuestionText(exercise)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <ExercisePlayer
        exercises={playerExercises}
        title={
          selection === "all"
            ? `Exercise Gallery · ${MODE_LABELS[mode]}`
            : `${TYPE_LABELS[selection]} · ${MODE_LABELS[mode]}`
        }
      />
    </div>
  );
}
