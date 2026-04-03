"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  studentLessonPath,
  studentLibraryPath,
  studentDashboardPath,
  studentVocabularyDrillPath,
  studentVocabularyPath,
} from "@/lib/routes/student";
import PassageVocabularyCapture from "./PassageVocabularyCapture";
import type { CapturedVocabularyItem } from "./PassageVocabularyCapture";
import VocabularyReviewCards from "./VocabularyReviewCards";
import LessonPlayer from "./LessonPlayer";
import InteractivePassageReader from "./InteractivePassageReader";
import LessonVocabularyTray from "./LessonVocabularyTray";

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

type InlinePreviewPayload = {
  item_text: string;
  item_type: "word" | "phrase";
  plain_english_meaning: string;
  translation: string;
  context_meaning: string;
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
  nextLessonId?: string | null;
  passageId?: string;
  passageText: string;
  state: {
    stage: "first_read" | "vocab_review" | "second_read" | "questions" | "completed";
  };
  questions: Question[];
  vocabItems: VocabItem[];
};

const STAGE_ORDER = ["first_read", "vocab_review", "second_read", "questions"] as const;
const VOCAB_REVIEW_PAGE_SIZE = 6;

function getCapturedVocabularyKey(itemText: string) {
  return itemText.trim().toLowerCase();
}

function mergeVocabularyItems(
  currentItems: VocabItem[],
  nextItems: VocabItem[]
) {
  if (nextItems.length === 0) {
    return currentItems;
  }

  const merged = new Map<string, VocabItem>();

  for (const item of currentItems) {
    merged.set(item.item_text.trim().toLowerCase(), item);
  }

  for (const item of nextItems) {
    merged.set(item.item_text.trim().toLowerCase(), {
      ...merged.get(item.item_text.trim().toLowerCase()),
      ...item,
    });
  }

  return Array.from(merged.values());
}

function buildFallbackVocabularyItemsForReview(
  items: CapturedVocabularyItem[],
  lessonId: string
) {
  return items.map((item, index) => ({
    id: `checkpoint-fallback:${lessonId}:${index}:${item.itemText.toLowerCase()}`,
    item_text: item.itemText,
    english_explanation:
      item.preview?.plainEnglishMeaning?.trim() ||
      item.preview?.contextMeaning?.trim() ||
      `Meaning of "${item.itemText}" in the passage.`,
    translated_explanation: item.preview?.translation?.trim() || null,
    example_text:
      item.contextText ??
      item.preview?.contextMeaning?.trim() ??
      null,
    context_sentence:
      item.contextText ??
      item.preview?.contextMeaning?.trim() ??
      null,
    audio_url: null,
  }));
}

function isFallbackVocabularyItem(item: VocabItem) {
  const english = item.english_explanation?.trim().toLowerCase() ?? "";
  const translated = item.translated_explanation?.trim().toLowerCase() ?? "";

  return (
    !english ||
    english.startsWith(`meaning of "${item.item_text.trim().toLowerCase()}"`) ||
    english.startsWith("meaning of this word in the passage") ||
    english.startsWith("meaning of this phrase in the passage") ||
    translated === item.item_text.trim().toLowerCase()
  );
}

async function buildPreviewBackfilledVocabularyItems(params: {
  studentId: string;
  lessonId: string;
  items: CapturedVocabularyItem[];
}) {
  const firstPageItems = params.items.slice(0, VOCAB_REVIEW_PAGE_SIZE);

  const previewResults = await Promise.allSettled(
    firstPageItems.map(async (item) => {
      if (
        item.preview?.plainEnglishMeaning?.trim() ||
        item.preview?.translation?.trim() ||
        item.preview?.contextMeaning?.trim()
      ) {
        return {
          item,
          preview: {
            item_text: item.itemText,
            item_type: item.itemType,
            plain_english_meaning: item.preview?.plainEnglishMeaning?.trim() ?? "",
            translation: item.preview?.translation?.trim() ?? "",
            context_meaning: item.preview?.contextMeaning?.trim() ?? "",
          } satisfies InlinePreviewPayload,
        };
      }

      const response = await fetch("/api/vocabulary/preview-inline", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: params.studentId,
          lessonId: params.lessonId,
          itemText: item.itemText,
          sourceText: item.contextText?.trim() || item.itemText,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to preview vocabulary item");
      }

      return {
        item,
        preview: payload?.data as InlinePreviewPayload | undefined,
      };
    })
  );

  return previewResults
    .filter(
      (
        result
      ): result is PromiseFulfilledResult<{
        item: CapturedVocabularyItem;
        preview: InlinePreviewPayload | undefined;
      }> => result.status === "fulfilled"
    )
    .map(({ value }, index) => {
      const meaning = value.preview?.plain_english_meaning?.trim();
      const translation = value.preview?.translation?.trim();
      const contextMeaning = value.preview?.context_meaning?.trim();

      if (!meaning || meaning === "Quick preview not ready yet.") {
        return null;
      }

      return {
        id: `preview-backfill:${params.lessonId}:${index}:${value.item.itemText.toLowerCase()}`,
        item_text: value.item.itemText,
        english_explanation: meaning,
        translated_explanation: translation || null,
        example_text: value.item.contextText ?? contextMeaning ?? null,
        context_sentence: value.item.contextText ?? contextMeaning ?? null,
        audio_url: null,
      } satisfies VocabItem;
    })
    .filter(Boolean) as VocabItem[];
}

export default function LessonStagePanel({
  accessCode,
  studentId,
  lessonId,
  lessonName,
  nextLessonId = null,
  passageId,
  passageText,
  state,
  questions,
  vocabItems,
}: Props) {
  const [stage, setStage] = useState(state.stage);
  const [capturedItems, setCapturedItems] = useState<CapturedVocabularyItem[]>([]);
  const [localVocabItems, setLocalVocabItems] = useState<VocabItem[]>(vocabItems ?? []);
  const [isVocabularyHydrating, setIsVocabularyHydrating] = useState(false);
  const [isVocabularyAudioLoading, setIsVocabularyAudioLoading] = useState(false);
  const [completionResult, setCompletionResult] = useState<LessonCompletionResult>(null);
  const hydratedVocabularyKeysRef = useRef<Set<string>>(new Set());
  const inflightVocabularyKeysRef = useRef<Set<string>>(new Set());
  const vocabularyAudioAutoloadedRef = useRef(false);
  const readingStageStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (stage === "first_read" || stage === "second_read") {
      readingStageStartedAtRef.current = Date.now();
      return;
    }

    readingStageStartedAtRef.current = null;
  }, [stage]);

  useEffect(() => {
    if (stage !== "vocab_review") {
      vocabularyAudioAutoloadedRef.current = false;
      return;
    }

    if (vocabularyAudioAutoloadedRef.current || isVocabularyAudioLoading) {
      return;
    }

    const hasReadyItems = localVocabItems.length > 0;
    const hasMissingAudio = localVocabItems.some((item) => !item.audio_url);

    if (!hasReadyItems || !hasMissingAudio) {
      return;
    }

    vocabularyAudioAutoloadedRef.current = true;
    void requestVocabularyAudio();
  }, [stage, localVocabItems, isVocabularyAudioLoading]);

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
    await flushPendingVocabularyItems();

    await fetch("/api/lesson/mark-second-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, lessonId }),
    });

    setStage("questions");
  }

  function handleCaptured(item: CapturedVocabularyItem) {
    setCapturedItems((prev) => {
      const existingIndex = prev.findIndex(
        (x) => getCapturedVocabularyKey(x.itemText) === getCapturedVocabularyKey(item.itemText)
      );

      if (existingIndex >= 0) {
        const existingItem = prev[existingIndex];
        const nextItem: CapturedVocabularyItem = {
          ...existingItem,
          contextText: existingItem.contextText ?? item.contextText ?? null,
          saveState: existingItem.saveState === "saved" ? "saved" : "pending",
          preview:
            existingItem.preview?.plainEnglishMeaning ||
            existingItem.preview?.translation ||
            existingItem.preview?.contextMeaning
              ? existingItem.preview
              : item.preview ?? null,
        };

        return prev.map((entry, index) => (index === existingIndex ? nextItem : entry));
      }

      return [...prev, { ...item, saveState: item.saveState ?? "pending" }];
    });
  }

  function removeCapturedItem(itemText: string) {
    setCapturedItems((prev) => prev.filter((item) => item.itemText !== itemText));
  }

  async function flushPendingVocabularyItems(itemsToSave = capturedItems) {
    const pendingItems = itemsToSave.filter((item) => item.saveState !== "saved");

    if (pendingItems.length === 0) {
      return;
    }

    try {
      const response = await fetch("/api/vocabulary/capture", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId,
          passageId,
          items: pendingItems.map((item) => ({
            itemText: item.itemText,
            itemType: item.itemType,
            contextText: item.contextText ?? null,
            sourceType: item.sourceType,
            preview: item.preview ?? null,
          })),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to save vocabulary tray");
      }

      const savedKeys = new Set(pendingItems.map((item) => getCapturedVocabularyKey(item.itemText)));
      setCapturedItems((current) =>
        current.map((item) =>
          savedKeys.has(getCapturedVocabularyKey(item.itemText))
            ? { ...item, saveState: "saved" as const }
            : item
        )
      );
    } catch (error) {
      console.error("flushPendingVocabularyItems error", error);
    }
  }

  function handleVocabularySubmitted(items: VocabItem[]) {
    void saveReadingMetricsIfNeeded();
    setLocalVocabItems((current) => mergeVocabularyItems(current, items));
    setCapturedItems((current) =>
      current.map((item) => ({ ...item, saveState: "saved" as const }))
    );
    setStage("vocab_review");
  }

  async function continueFromFirstRead(checkpointItems: CapturedVocabularyItem[]) {
    await saveReadingMetricsIfNeeded();
    await flushPendingVocabularyItems(checkpointItems);

    const stageResponse = await fetch("/api/lesson/submit-vocabulary", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        lessonId,
      }),
    });

    if (!stageResponse.ok) {
      const payload = await stageResponse.json().catch(() => null);
      throw new Error(payload?.error ?? "Failed to continue from first read");
    }

    if (checkpointItems.length > 0) {
      setLocalVocabItems(buildFallbackVocabularyItemsForReview(checkpointItems, lessonId));
      setIsVocabularyHydrating(true);
      hydratedVocabularyKeysRef.current.clear();
      inflightVocabularyKeysRef.current.clear();
    } else {
      setLocalVocabItems([]);
      setIsVocabularyHydrating(false);
    }
    setStage("vocab_review");

    if (checkpointItems.length === 0) {
      return;
    }

    void (async () => {
      try {
        const previewItems = await buildPreviewBackfilledVocabularyItems({
          studentId,
          lessonId,
          items: checkpointItems,
        });

        if (previewItems.length > 0) {
          setLocalVocabItems((current) => mergeVocabularyItems(current, previewItems));
          for (const item of previewItems) {
            hydratedVocabularyKeysRef.current.add(item.item_text.trim().toLowerCase());
          }
        }

        const itemTexts = checkpointItems
          .slice(0, VOCAB_REVIEW_PAGE_SIZE)
          .map((item) => item.itemText);
        const cardsResponse = await fetch("/api/vocabulary/generate-from-captures", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            lessonId,
            itemTexts,
            limit: itemTexts.length,
          }),
        });

        const payload = await cardsResponse.json().catch(() => null);

        if (!cardsResponse.ok) {
          throw new Error(payload?.error ?? "Failed to build vocabulary cards");
        }

        const generatedItems = Array.isArray(payload?.items) ? payload.items : [];

        if (generatedItems.length > 0) {
          setLocalVocabItems((current) => mergeVocabularyItems(current, generatedItems));
          for (const item of generatedItems) {
            const key = item.item_text.trim().toLowerCase();
            if (isFallbackVocabularyItem(item)) {
              hydratedVocabularyKeysRef.current.delete(key);
            } else {
              hydratedVocabularyKeysRef.current.add(key);
            }
          }
        }
      } catch (error) {
        console.error("continueFromFirstRead cards error", error);
      } finally {
        setIsVocabularyHydrating(false);
      }
    })();
  }

  async function hydrateVisibleVocabularyItems(visibleItems: VocabItem[]) {
    const itemsNeedingHydration = visibleItems.filter((item) => {
      const key = item.item_text.trim().toLowerCase();
      return (
        isFallbackVocabularyItem(item) &&
        !hydratedVocabularyKeysRef.current.has(key) &&
        !inflightVocabularyKeysRef.current.has(key)
      );
    });

    if (itemsNeedingHydration.length === 0) {
      return;
    }

    setIsVocabularyHydrating(true);

    const itemTexts = itemsNeedingHydration.map((item) => item.item_text);

    for (const itemText of itemTexts) {
      inflightVocabularyKeysRef.current.add(itemText.trim().toLowerCase());
    }

    try {
      const response = await fetch("/api/vocabulary/generate-from-captures", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId,
          itemTexts,
          limit: itemTexts.length,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to hydrate visible vocabulary cards");
      }

      const generatedItems = Array.isArray(payload?.items) ? payload.items : [];

      if (generatedItems.length > 0) {
        setLocalVocabItems((current) => mergeVocabularyItems(current, generatedItems));
        for (const item of generatedItems) {
          const key = item.item_text.trim().toLowerCase();
          if (isFallbackVocabularyItem(item)) {
            hydratedVocabularyKeysRef.current.delete(key);
          } else {
            hydratedVocabularyKeysRef.current.add(key);
          }
        }
      }

      const remainingItems = itemsNeedingHydration.filter((item) => {
        const generatedItem = generatedItems.find(
          (candidate) =>
            candidate.item_text.trim().toLowerCase() === item.item_text.trim().toLowerCase()
        );

        return !generatedItem || isFallbackVocabularyItem(generatedItem);
      });

      if (remainingItems.length > 0) {
        const previewResults = await Promise.allSettled(
          remainingItems.map(async (item) => {
            const previewResponse = await fetch("/api/vocabulary/preview-inline", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                studentId,
                lessonId,
                itemText: item.item_text,
                sourceText:
                  item.context_sentence?.trim() ||
                  item.example_text?.trim() ||
                  item.item_text,
              }),
            });

            const previewPayload = await previewResponse.json().catch(() => null);

            if (!previewResponse.ok) {
              throw new Error(previewPayload?.error ?? "Failed to preview vocabulary item");
            }

            return {
              item,
              preview: previewPayload?.data as InlinePreviewPayload | undefined,
            };
          })
        );

        const previewItems = previewResults
          .filter(
            (
              result
            ): result is PromiseFulfilledResult<{
              item: VocabItem;
              preview: InlinePreviewPayload | undefined;
            }> => result.status === "fulfilled"
          )
          .map(({ value }) => {
            if (!value.preview) {
              return null;
            }

            const meaning = value.preview.plain_english_meaning?.trim();
            const translation = value.preview.translation?.trim();
            const contextMeaning = value.preview.context_meaning?.trim();

            if (!meaning || meaning === "Quick preview not ready yet.") {
              return null;
            }

            return {
              ...value.item,
              english_explanation: meaning,
              translated_explanation: translation || value.item.translated_explanation || null,
              example_text: value.item.example_text || contextMeaning || null,
              context_sentence: value.item.context_sentence || contextMeaning || null,
            } satisfies VocabItem;
          })
          .filter(Boolean) as VocabItem[];

        if (previewItems.length > 0) {
          setLocalVocabItems((current) => mergeVocabularyItems(current, previewItems));
          for (const item of previewItems) {
            hydratedVocabularyKeysRef.current.add(item.item_text.trim().toLowerCase());
          }
        }
      }
    } catch (error) {
      console.error("hydrateVisibleVocabularyItems error", error);
    } finally {
      for (const itemText of itemTexts) {
        inflightVocabularyKeysRef.current.delete(itemText.trim().toLowerCase());
      }
      setIsVocabularyHydrating(false);
    }
  }

  async function requestVocabularyAudio() {
    if (isVocabularyAudioLoading) {
      return;
    }

    const hasMissingAudio = localVocabItems.some((item) => !item.audio_url);
    if (!hasMissingAudio) {
      return;
    }

    setIsVocabularyAudioLoading(true);

    try {
      const response = await fetch("/api/vocabulary/regenerate-audio", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load vocabulary audio");
      }

      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      if (nextItems.length > 0) {
        setLocalVocabItems((current) => mergeVocabularyItems(current, nextItems));
      }
    } catch (error) {
      console.error("requestVocabularyAudio error", error);
    } finally {
      setIsVocabularyAudioLoading(false);
    }
  }

  function renderStageProgress() {
    const stageKey = stage === "completed" ? "questions" : stage;
    const stageIndex = Math.max(STAGE_ORDER.indexOf(stageKey), 0);
    const progressPercent = ((stageIndex + 1) / STAGE_ORDER.length) * 100;

    return (
      <div className="reading-topbar">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
          <div className="token-text-muted mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em]">
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
    const primaryCompletionHref =
      nextLessonId ? studentLessonPath(nextLessonId) : studentLibraryPath();
    const primaryCompletionLabel = nextLessonId ? "Continue Reading" : "Back to Library";
    const vocabularyHref = studentVocabularyPath({
      mode: "learn_new_words",
      lesson: lessonId,
    });

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

            <div className="token-text-secondary flex flex-wrap gap-2 text-xs font-semibold">
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
                href={primaryCompletionHref}
                className="app-button app-button-primary"
              >
                {primaryCompletionLabel}
              </Link>
              <Link
                href={vocabularyHref}
                className="app-button app-button-secondary"
              >
                Go to Vocabulary
              </Link>
              <Link
                href={studentDashboardPath()}
                className="app-button app-button-muted"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "questions") {
    return (
      <>
        <div className="mx-auto flex min-h-[calc(100svh-12rem)] w-full max-w-3xl flex-col px-4 pb-6 sm:px-6">
          <LessonPlayer
            studentId={studentId}
            lessonId={lessonId}
            questions={questions}
            passageText={passageText}
            passageId={passageId}
            knownWords={localVocabItems}
            onVocabularyCaptured={handleCaptured}
            onBeforeComplete={flushPendingVocabularyItems}
            onFinished={(result) => {
              setCompletionResult(result);
              setStage("completed");
            }}
          />
        </div>
        <LessonVocabularyTray
          items={capturedItems}
          onRemove={removeCapturedItem}
          onClear={() =>
            setCapturedItems((current) =>
              current.filter((item) => item.saveState === "saved")
            )
          }
        />
      </>
    );
  }

  if (stage === "vocab_review") {
    return (
      <div className="space-y-4">
        {renderStageProgress()}
        <VocabularyReviewCards
          items={localVocabItems}
          isHydrating={isVocabularyHydrating}
          onRequestAudio={requestVocabularyAudio}
          isAudioLoading={isVocabularyAudioLoading}
          onBackToReading={() => setStage("first_read")}
          onDone={() => setStage("second_read")}
        />
      </div>
    );
  }

  if (stage === "second_read") {
    return (
      <>
        <div className="reading-stage-shell pb-28">
          {renderStageProgress()}

          <div className="mx-auto max-w-[42rem] px-3 pb-7 pt-2 sm:px-5">
            <div className="reading-surface px-4 py-6 sm:px-7 sm:py-8">
              <InteractivePassageReader
                studentId={studentId}
                lessonId={lessonId}
                passageId={passageId}
                passageText={passageText}
                knownWords={localVocabItems}
                onCaptured={handleCaptured}
                mode="review"
              />
            </div>
          </div>

          <div className="reading-action-bar">
            <div className="reading-action-bar__inner flex items-center gap-3">
              <div className="token-text-secondary min-w-0 flex-1 text-sm">
                Hover or tap a marked word to check meaning.
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
        <LessonVocabularyTray
          items={capturedItems}
          onRemove={removeCapturedItem}
          onClear={() =>
            setCapturedItems((current) =>
              current.filter((item) => item.saveState === "saved")
            )
          }
        />
      </>
    );
  }

  return (
    <div className="reading-stage-shell pb-32">
      {renderStageProgress()}

      <div className="mx-auto max-w-[42rem] px-3 pb-7 pt-2 sm:px-5">
        <div className="reading-surface px-4 py-6 sm:px-7 sm:py-8">
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
        onContinueCheckpoint={continueFromFirstRead}
        compact
        hideManualInput
        immersive
      />
      <LessonVocabularyTray
        items={capturedItems}
        onRemove={removeCapturedItem}
        onClear={() =>
          setCapturedItems((current) =>
            current.filter((item) => item.saveState === "saved")
          )
        }
      />
    </div>
  );
}
