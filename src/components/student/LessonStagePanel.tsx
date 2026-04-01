"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  correct_option?: "A" | "B" | "C" | "D";
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
  lifecycle_state?: string | null;
  review_bucket?:
    | "recently_failed"
    | "weak_again"
    | "overdue"
    | "reinforcement"
    | "scheduled"
    | null;
  review_ready?: boolean;
};

type LessonCompletionResult = {
  vocabularyPreparation?: {
    generatedCount?: number;
    preparedCount?: number;
    totalItems?: number;
  } | null;
} | null;

type Props = {
  accessCode: string;
  studentId: string;
  lessonId: string;
  lessonName: string;
  passageId?: string;
  passageText: string;
  state: {
    stage: "first_read" | "vocab_review" | "second_read" | "questions" | "completed";
  };
  questions: Question[];
  vocabItems: VocabItem[];
};

const STAGE_ORDER = ["first_read", "vocab_review", "second_read", "questions"] as const;

export default function LessonStagePanel({
  accessCode,
  studentId,
  lessonId,
  lessonName,
  passageId,
  passageText,
  state,
  questions,
  vocabItems,
}: Props) {
  const [stage, setStage] = useState(state.stage);
  const [capturedItems, setCapturedItems] = useState<CapturedVocabularyItem[]>([]);
  const [localVocabItems, setLocalVocabItems] = useState<VocabItem[]>(vocabItems ?? []);
  const [completionResult, setCompletionResult] = useState<LessonCompletionResult>(null);
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
      if (prev.some((x) => x.itemText.toLowerCase() === item.itemText.toLowerCase())) {
        return prev;
      }

      return [...prev, item];
    });
  }

  function handleVocabularySubmitted(items: VocabItem[]) {
    void saveReadingMetricsIfNeeded();
    setLocalVocabItems(items);
    setStage("vocab_review");
  }

  function renderStageProgress() {
    const stageKey = stage === "completed" ? "questions" : stage;
    const stageIndex = Math.max(STAGE_ORDER.indexOf(stageKey), 0);
    const progressPercent = ((stageIndex + 1) / STAGE_ORDER.length) * 100;

    return (
      <div className="reading-topbar">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span>Reading</span>
            <span>
              {stageIndex + 1}/{STAGE_ORDER.length}
            </span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  const reviewReadyCount = localVocabItems.filter((item) => item.review_ready).length;

  if (stage === "completed") {
    const preparedCount =
      completionResult?.vocabularyPreparation?.totalItems ?? localVocabItems.length;
    const generatedCount = completionResult?.vocabularyPreparation?.generatedCount ?? 0;
    const lessonPracticeHref = `/s/${accessCode}/vocabulary/drill?mode=learn_new_words&lesson=${lessonId}`;
    const studioHref = `/s/${accessCode}/vocabulary?mode=learn_new_words&lesson=${lessonId}`;

    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="app-card px-5 py-6 sm:px-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="app-kicker">
                Lesson Complete
              </div>
              <h2 className="app-heading-lg">Keep the lesson words alive</h2>
              <p className="app-copy">
                {preparedCount > 0
                  ? `${preparedCount} words from ${lessonName} are ready for useful follow-up practice, so you can move straight from reading into reinforcement.`
                  : "Your reading progress is saved. Vocabulary Studio can keep building follow-up practice as lesson words finish syncing."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              {preparedCount > 0 ? (
                <span className="app-chip app-chip-success">
                  {preparedCount} lesson words ready
                </span>
              ) : null}
              {generatedCount > 0 ? (
                <span className="app-chip app-chip-secondary">
                  {generatedCount} newly prepared
                </span>
              ) : null}
              {reviewReadyCount > 0 ? (
                <span className="app-chip app-chip-success">
                  {reviewReadyCount} ready to revisit
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={lessonPracticeHref}
                className="app-button app-button-primary"
              >
                Practice Lesson Words Now
              </Link>
              <Link
                href={studioHref}
                className="app-button app-button-secondary"
              >
                Continue to Vocabulary Studio
              </Link>
              <Link
                href={`/s/${accessCode}`}
                className="app-button app-button-muted"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "questions") {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-12rem)] w-full max-w-3xl flex-col px-4 pb-6 sm:px-6">
        <LessonPlayer
          studentId={studentId}
          lessonId={lessonId}
          questions={questions}
          passageText={passageText}
          passageId={passageId}
          knownWords={localVocabItems}
          onFinished={(result) => {
            setCompletionResult(result);
            setStage("completed");
          }}
        />
      </div>
    );
  }

  if (stage === "vocab_review") {
    return (
      <div className="space-y-4">
        {renderStageProgress()}
        <VocabularyReviewCards
          items={localVocabItems}
          onDone={() => setStage("second_read")}
        />
      </div>
    );
  }

  if (stage === "second_read") {
    return (
      <div className="reading-stage-shell pb-28">
        {renderStageProgress()}

        <div className="mx-auto max-w-3xl px-4 pb-8 pt-3 sm:px-6">
          <div className="reading-surface px-5 py-7 sm:px-8 sm:py-9">
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

        <div className="reading-action-bar">
          <div className="reading-action-bar__inner flex items-center gap-3">
            <div className="min-w-0 flex-1 text-sm text-slate-600">
              Tap a marked word for meaning. Double tap for audio.
            </div>
            <button
              onClick={goToQuestions}
              className="primary-button min-h-14 shrink-0"
            >
              Start Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reading-stage-shell pb-32">
      {renderStageProgress()}

      <div className="mx-auto max-w-3xl px-4 pb-8 pt-3 sm:px-6">
        <div className="reading-surface px-5 py-7 sm:px-8 sm:py-9">
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
      </div>

      <PassageVocabularyCapture
        studentId={studentId}
        lessonId={lessonId}
        passageId={passageId}
        presetItems={capturedItems}
        onItemsChange={setCapturedItems}
        onSubmitted={handleVocabularySubmitted}
        compact
        hideManualInput
        immersive
      />
    </div>
  );
}
