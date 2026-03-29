"use client";

import AudioExercisePrompt from "../AudioExercisePrompt";
import type { ExerciseRendererProps, SpellingFromAudioExerciseData } from "../types";

export default function SpellingFromAudioExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
}: ExerciseRendererProps<SpellingFromAudioExerciseData>) {
  return (
    <div className="space-y-5">
      <AudioExercisePrompt
        exercise={exercise}
        title="Listen, then type the word you hear."
        description="Play the audio and type the spelling from memory."
        readyHint="Use the audio first, then type the word exactly as you hear it."
        fallbackContent={
          <>
            Fallback prompt: type the word <span className="font-semibold">{exercise.target_word}</span>.
          </>
        }
        footer={
          exercise.explanation ? (
            <>Audio spelling check with exact-match grading.</>
          ) : (
            <>Listen first, then type the spelling.</>
          )
        }
      />

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <label
          htmlFor={`spelling-input-${exercise.id}`}
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
        >
          {exercise.inputLabel ?? "Type the spelling"}
        </label>

        <input
          id={`spelling-input-${exercise.id}`}
          type="text"
          autoFocus
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={submitted}
          value={selectedValue}
          onChange={(event) => onSelect(event.target.value)}
          placeholder={exercise.placeholder ?? "Type what you heard"}
          className="mt-3 w-full rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-medium text-slate-950 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        />

        <div className="mt-3 text-sm leading-6 text-slate-600">
          {submitted
            ? "Your spelling has been checked."
            : "Exact match only for now: spacing is trimmed and letters are checked case-insensitively."}
        </div>
      </div>
    </div>
  );
}
