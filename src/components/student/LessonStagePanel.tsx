"use client";

import { useEffect, useRef, useState } from "react";
import PassageVocabularyCapture from "./PassageVocabularyCapture";
import type { CapturedVocabularyItem } from "./PassageVocabularyCapture";
import VocabularyReviewCards from "./VocabularyReviewCards";
import LessonPlayer from "./LessonPlayer";
import InteractivePassageReader from "./InteractivePassageReader";

type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option?: string;
  explanation?: string | null;
  question_type: string;
};

type VocabItem = {
  id: string;
  item_text: string;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  example_text?: string | null;
  context_sentence?: string | null;
  audio_url?: string | null;
};

type Props = {
  studentId: string;
  lessonId: string;
  passageId?: string;
  passageText: string;
  state: {
    stage: "first_read" | "vocab_review" | "second_read" | "questions" | "completed";
  };
  questions: Question[];
  vocabItems: VocabItem[];
};

export default function LessonStagePanel({
  studentId,
  lessonId,
  passageId,
  passageText,
  state,
  questions,
  vocabItems,
}: Props) {
  const [stage, setStage] = useState(state.stage);
  const [capturedItems, setCapturedItems] = useState<CapturedVocabularyItem[]>([]);
  const [localVocabItems, setLocalVocabItems] = useState<VocabItem[]>(vocabItems ?? []);
  const readingStageStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (stage === "first_read" || stage === "second_read") {
      readingStageStartedAtRef.current = Date.now();
      return;
    }

    readingStageStartedAtRef.current = null;
  }, [stage]);

  function countWords(text: string) {
    return text
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  async function saveReadingMetricsIfNeeded() {
    if (stage !== "first_read" && stage !== "second_read") {
      return;
    }

    const startedAt = readingStageStartedAtRef.current;
    if (!startedAt) {
      return;
    }

    const readingDurationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const wordsCount = countWords(passageText);
    const wordsPerMinute =
      readingDurationSec > 0 ? Number(((wordsCount / readingDurationSec) * 60).toFixed(2)) : 0;

    try {
      await fetch("/api/reading/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId,
          readingDurationSec,
          wordsCount,
          wordsPerMinute,
        }),
      });
    } catch (error) {
      console.error("save reading metrics error", error);
    }
  }

  async function goToQuestions() {
    await saveReadingMetricsIfNeeded();

    await fetch("/api/lesson/mark-second-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, lessonId }),
    });

    setStage("questions");
  }

  function handleCaptured(item: CapturedVocabularyItem) {
    setCapturedItems((prev) => {
      if (prev.some((x) => x.itemText.toLowerCase() === item.itemText.toLowerCase())) return prev;
      return [...prev, item];
    });
  }

  function handleRemoveCaptured(itemText: string) {
    setCapturedItems((prev) => prev.filter((x) => x.itemText !== itemText));
  }

  function handleVocabularySubmitted(items: VocabItem[]) {
    void saveReadingMetricsIfNeeded();
    setLocalVocabItems(items);
    setStage("vocab_review");
  }

  if (stage === "completed") {
    return <div className="text-xl font-semibold">Lesson completed</div>;
  }

  if (stage === "questions") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col">
        <LessonPlayer
          studentId={studentId}
          lessonId={lessonId}
          questions={questions}
          passageText={passageText}
          passageId={passageId}
          onFinished={() => setStage("completed")}
        />
      </div>
    );
  }

  if (stage === "vocab_review") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Review the captured words, then read the passage one more time.
        </div>
        <VocabularyReviewCards
          items={localVocabItems}
          onDone={() => setStage("second_read")}
        />
      </div>
    );
  }

  if (stage === "second_read") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Second Read
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Double tap a marked word to hear its audio.
            </div>
          </div>
          <button
            onClick={goToQuestions}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Start Quiz
          </button>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
          <InteractivePassageReader
            studentId={studentId}
            lessonId={lessonId}
            passageId={passageId}
            passageText={passageText}
            knownWords={localVocabItems}
            mode="audio_review"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            First Read
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Long press a word to save it for vocabulary review.
          </div>
        </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {capturedItems.length} saved
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
        <InteractivePassageReader
          studentId={studentId}
          lessonId={lessonId}
          passageId={passageId}
          passageText={passageText}
          knownWords={localVocabItems}
          onCaptured={handleCaptured}
          mode="capture"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <PassageVocabularyCapture
          studentId={studentId}
          lessonId={lessonId}
          passageId={passageId}
          presetItems={capturedItems}
          onItemsChange={setCapturedItems}
          onSubmitted={handleVocabularySubmitted}
          compact
          hideManualInput
        />

        {capturedItems.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {capturedItems.map((item) => (
              <button
                key={`${item.sourceType}:${item.itemText}`}
                onClick={() => handleRemoveCaptured(item.itemText)}
                className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-900"
              >
                {item.itemText} ×
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-500">
            Save a few tough words from the passage, then review them as cards.
          </div>
        )}
      </div>
    </div>
  );
}
