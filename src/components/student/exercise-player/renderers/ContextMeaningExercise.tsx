import ExerciseOptionList from "../ExerciseOptionList";
import ExercisePromptPanel from "../ExercisePromptPanel";
import { getExerciseCorrectAnswer } from "@/types/vocab-exercises";
import type {
  ContextMeaningExerciseData,
  ExerciseRendererProps,
} from "../types";

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedContext(contextText: string, focusText: string) {
  if (!focusText.trim()) {
    return contextText;
  }

  const pattern = new RegExp(`(${escapeRegExp(focusText)})`, "gi");
  const parts = contextText.split(pattern);

  return parts.map((part, index) =>
    part.toLowerCase() === focusText.toLowerCase() ? (
      <mark
        key={`${part}-${index}`}
        className="rounded-md bg-amber-200/80 px-1.5 py-0.5 font-semibold text-slate-950"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

export default function ContextMeaningExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
}: ExerciseRendererProps<ContextMeaningExerciseData>) {
  return (
    <div className="space-y-5">
      <ExercisePromptPanel
        eyebrow={exercise.prompt}
        body={
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Read the context
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                Focus: {exercise.focusText}
              </span>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-base leading-8 text-slate-100 shadow-[0_18px_35px_-24px_rgba(15,23,42,0.8)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Passage
              </div>
              <div className="mt-3">
                {renderHighlightedContext(exercise.contextText, exercise.focusText)}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[0.7fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Focus Word
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950">
                  {exercise.focusText}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                Use the nearby clues to infer meaning in context, not just the dictionary definition.
              </div>
            </div>
          </div>
        }
        footer={<>Use nearby clues first, then choose the meaning that best fits this exact context.</>}
      />

      <ExerciseOptionList
        options={exercise.options}
        selectedOptionId={selectedValue || null}
        correctOptionId={getExerciseCorrectAnswer(exercise)}
        submitted={submitted}
        onSelect={onSelect}
      />
    </div>
  );
}
