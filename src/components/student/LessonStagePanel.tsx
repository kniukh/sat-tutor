"use client";

import { useEffect, useRef, useState } from "react";
import LessonSplitLayout from "./LessonSplitLayout";
import PassageVocabularyCapture from "./PassageVocabularyCapture";
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
  const [capturedItems, setCapturedItems] = useState<string[]>([]);
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

  function handleCaptured(itemText: string) {
    setCapturedItems((prev) => {
      if (prev.some((x) => x.toLowerCase() === itemText.toLowerCase())) return prev;
      return [...prev, itemText];
    });
  }

  function handleRemoveCaptured(itemText: string) {
    setCapturedItems((prev) => prev.filter((x) => x !== itemText));
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
      <LessonSplitLayout
        top={
          <InteractivePassageReader
            studentId={studentId}
            lessonId={lessonId}
            passageId={passageId}
            passageText={passageText}
            knownWords={localVocabItems}
          />
        }
        bottom={
          <LessonPlayer
            studentId={studentId}
            lessonId={lessonId}
            questions={questions}
            onFinished={() => setStage("completed")}
          />
        }
      />
    );
  }

  if (stage === "vocab_review") {
    return (
      <LessonSplitLayout
        top={
          <InteractivePassageReader
            studentId={studentId}
            lessonId={lessonId}
            passageId={passageId}
            passageText={passageText}
            knownWords={localVocabItems}
          />
        }
        bottom={
          <VocabularyReviewCards
            items={localVocabItems}
            onDone={() => setStage("second_read")}
          />
        }
      />
    );
  }

  if (stage === "second_read") {
    return (
      <LessonSplitLayout
        top={
          <InteractivePassageReader
            studentId={studentId}
            lessonId={lessonId}
            passageId={passageId}
            passageText={passageText}
            knownWords={localVocabItems}
          />
        }
        bottom={
          <div className="space-y-4">
            <div className="text-lg font-semibold">Read the passage again</div>
            <button
              onClick={goToQuestions}
              className="px-4 py-2 rounded-lg bg-black text-white"
            >
              Start Quiz
            </button>
          </div>
        }
      />
    );
  }

  return (
    <LessonSplitLayout
      top={
        <InteractivePassageReader
          studentId={studentId}
          lessonId={lessonId}
          passageId={passageId}
          passageText={passageText}
          knownWords={localVocabItems}
          onCaptured={handleCaptured}
        />
      }
      bottom={
        <div className="space-y-4">
          <PassageVocabularyCapture
            studentId={studentId}
            lessonId={lessonId}
            passageId={passageId}
            presetItems={capturedItems}
            onItemsChange={setCapturedItems}
            onSubmitted={handleVocabularySubmitted}
          />

          {capturedItems.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">
                Captured from text this session
              </div>
              <div className="flex flex-wrap gap-2">
                {capturedItems.map((item) => (
                  <button
                    key={item}
                    onClick={() => handleRemoveCaptured(item)}
                    className="px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-sm"
                  >
                    {item} ×
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      }
    />
  );
}
