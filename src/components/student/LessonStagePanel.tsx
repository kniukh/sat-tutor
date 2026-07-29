"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  studentLessonPath,
  studentLibraryPath,
  studentDashboardPath,
  studentVocabularyDrillPath,
} from "@/lib/routes/student";
import PassageVocabularyCapture from "./PassageVocabularyCapture";
import type { CapturedVocabularyItem } from "./PassageVocabularyCapture";
import VocabularyReviewCards from "./VocabularyReviewCards";
import LessonPlayer from "./LessonPlayer";
import InteractivePassageReader from "./InteractivePassageReader";
import LessonVocabularyTray from "./LessonVocabularyTray";
import PassageAudioControls, {
  type PassageAudioSentenceTiming,
} from "./PassageAudioControls";
import { resolveVocabularyLemma } from "@/services/vocabulary/vocabulary-normalization.service";
import { hasPlaceholderVocabularyContent } from "@/services/vocabulary/vocabulary-placeholder-content";
import {
  deleteStudentVocabularyItem,
  regenerateStudentVocabularyMeaning,
} from "@/services/vocabulary/student-vocabulary-client.service";

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
  canonical_lemma?: string | null;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  core_meaning?: string | null;
  definition?: string | null;
  translation_word?: string | null;
  translation_meaning?: string | null;
  synonyms?: string[] | null;
  student_definition_override?: string | null;
  student_translation_override?: string | null;
  definition_override_generated_from_context?: boolean | null;
  definition_override_updated_at?: string | null;
  example_text?: string | null;
  context_sentence?: string | null;
  audio_url?: string | null;
  audio_status?: "ready" | "pending" | "failed" | "missing" | null;
  lifecycle_state?: string | null;
  review_bucket?:
    | "recently_failed"
    | "weak_again"
    | "overdue"
    | "reinforcement"
    | "scheduled"
    | null;
  review_ready?: boolean;
  is_removed?: boolean;
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
  passageAudioUrl?: string | null;
  passageAudioStartMs?: number | null;
  passageAudioEndMs?: number | null;
  passageAudioSentenceTimings?: PassageAudioSentenceTiming[];
  passageAudioAlignmentConfidence?: number | null;
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
    merged.set(getVocabularyItemMergeKey(item), item);
  }

  for (const item of nextItems) {
    const mergeKey = getVocabularyItemMergeKey(item);
    const existing = merged.get(mergeKey);
    merged.set(mergeKey, {
      ...existing,
      ...item,
      canonical_lemma: item.canonical_lemma ?? existing?.canonical_lemma ?? null,
      item_text: existing?.item_text ?? item.item_text,
      english_explanation:
        item.english_explanation ?? existing?.english_explanation ?? null,
      translated_explanation:
        item.translated_explanation ?? existing?.translated_explanation ?? null,
      core_meaning: item.core_meaning ?? existing?.core_meaning ?? null,
      definition: item.definition ?? existing?.definition ?? null,
      translation_word: item.translation_word ?? existing?.translation_word ?? null,
      translation_meaning: item.translation_meaning ?? existing?.translation_meaning ?? null,
      synonyms: item.synonyms ?? existing?.synonyms ?? null,
      student_definition_override:
        item.student_definition_override ?? existing?.student_definition_override ?? null,
      student_translation_override:
        item.student_translation_override ?? existing?.student_translation_override ?? null,
      definition_override_generated_from_context:
        item.definition_override_generated_from_context ??
        existing?.definition_override_generated_from_context ??
        false,
      definition_override_updated_at:
        item.definition_override_updated_at ??
        existing?.definition_override_updated_at ??
        null,
      example_text: item.example_text ?? existing?.example_text ?? null,
      context_sentence: item.context_sentence ?? existing?.context_sentence ?? null,
      audio_url: item.audio_url ?? existing?.audio_url ?? null,
      audio_status:
        item.audio_status === "ready"
          ? "ready"
          : item.audio_status ?? existing?.audio_status ?? null,
      lifecycle_state: item.lifecycle_state ?? existing?.lifecycle_state ?? null,
      review_bucket: item.review_bucket ?? existing?.review_bucket ?? null,
      review_ready: item.review_ready ?? existing?.review_ready ?? false,
      is_removed: item.is_removed ?? existing?.is_removed ?? false,
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
    canonical_lemma: resolveVocabularyLemma({
      itemText: item.itemText,
      itemType: item.itemType,
    }).canonicalLemma,
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

function buildCapturedVocabularyReviewItems(params: {
  items: CapturedVocabularyItem[];
  sourceItems: VocabItem[];
  lessonId: string;
}) {
  const sourceItemsByText = new Map(
    params.sourceItems.map((item) => [getVocabularyItemMergeKey(item), item])
  );
  const fallbackItems = buildFallbackVocabularyItemsForReview(params.items, params.lessonId);

  return fallbackItems.map((fallbackItem) => {
    const matchedSourceItem =
      sourceItemsByText.get(getVocabularyItemMergeKey(fallbackItem)) ?? null;

    return matchedSourceItem
      ? {
          ...fallbackItem,
          ...matchedSourceItem,
          item_text: fallbackItem.item_text,
          canonical_lemma:
            matchedSourceItem.canonical_lemma ?? fallbackItem.canonical_lemma ?? null,
        }
      : fallbackItem;
  });
}

function getVocabularyItemMergeKey(item: Pick<VocabItem, "item_text" | "canonical_lemma">) {
  return (
    item.canonical_lemma?.trim().toLowerCase() ||
    resolveVocabularyLemma({
      itemText: item.item_text,
      itemType: item.item_text.includes(" ") ? "phrase" : "word",
    }).canonicalLemma
  );
}

function getCapturedVocabularyMergeKey(item: Pick<CapturedVocabularyItem, "itemText" | "itemType">) {
  return resolveVocabularyLemma({
    itemText: item.itemText,
    itemType: item.itemType,
  }).canonicalLemma;
}

function isPersistedVocabularyItemId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

function isFallbackVocabularyItem(item: VocabItem) {
  return hasPlaceholderVocabularyContent({
    itemText: item.item_text,
    englishExplanation: item.english_explanation,
    translatedExplanation: item.translated_explanation,
  });
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
  passageAudioUrl,
  passageAudioStartMs,
  passageAudioEndMs,
  passageAudioSentenceTimings = [],
  passageAudioAlignmentConfidence,
  state,
  questions,
  vocabItems,
}: Props) {
  const [stage, setStage] = useState(state.stage);
  const [readingView, setReadingView] = useState<"text" | "words">("text");
  const [activeAudioSentenceText, setActiveAudioSentenceText] = useState<string | null>(null);
  const [capturedItems, setCapturedItems] = useState<CapturedVocabularyItem[]>([]);
  const [localVocabItems, setLocalVocabItems] = useState<VocabItem[]>(vocabItems ?? []);
  const [isVocabularyHydrating, setIsVocabularyHydrating] = useState(false);
  const [isVocabularyAudioLoading, setIsVocabularyAudioLoading] = useState(false);
  const [completionResult, setCompletionResult] = useState<LessonCompletionResult>(null);
  const hydratedVocabularyKeysRef = useRef<Set<string>>(new Set());
  const inflightVocabularyKeysRef = useRef<Set<string>>(new Set());
  const requestedAudioSignatureRef = useRef<string>("");
  const inflightVocabularyAudioRequestRef = useRef<Promise<VocabItem[] | void> | null>(null);
  const readingStageStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    setReadingView("text");
  }, [stage]);

  useEffect(() => {
    setActiveAudioSentenceText(null);
  }, [stage, readingView]);

  useEffect(() => {
    if (stage === "first_read" || stage === "second_read") {
      readingStageStartedAtRef.current = Date.now();
      return;
    }

    readingStageStartedAtRef.current = null;
  }, [stage]);

  useEffect(() => {
    if (stage !== "vocab_review") {
      requestedAudioSignatureRef.current = "";
      return;
    }

    if (isVocabularyHydrating || isVocabularyAudioLoading) {
      return;
    }

    const missingAudioSignature = localVocabItems
      .filter((item) => !item.audio_url)
      .map((item) => item.item_text.trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join("|");

    if (
      !missingAudioSignature ||
      requestedAudioSignatureRef.current === missingAudioSignature
    ) {
      return;
    }

    requestedAudioSignatureRef.current = missingAudioSignature;
    void requestVocabularyAudio();
  }, [stage, localVocabItems, isVocabularyHydrating, isVocabularyAudioLoading]);

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

    const response = await fetch("/api/lesson/mark-second-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, lessonId }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? "Failed to finish the second read");
    }

    setStage("questions");
  }

  async function startSecondRead() {
    const response = await fetch("/api/lesson/advance-stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        lessonId,
        action: "start_second_read",
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? "Failed to start the second read");
    }
    setStage("second_read");
  }

  function handleCaptured(item: CapturedVocabularyItem) {
    const isQuizVocabularyItem =
      item.sourceType === "question" || item.sourceType === "answer";

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

    if (isQuizVocabularyItem) {
      const fallbackItems = buildFallbackVocabularyItemsForReview([item], `${lessonId}:quiz`);
      requestedAudioSignatureRef.current = "";
      setLocalVocabItems((current) => mergeVocabularyItems(current, fallbackItems));
      void hydrateVisibleVocabularyItems(fallbackItems);
    }
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
          requestedAudioSignatureRef.current = "";
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
        requestedAudioSignatureRef.current = "";
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
          requestedAudioSignatureRef.current = "";
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

  async function requestVocabularyAudio(options?: {
    force?: boolean;
    itemTexts?: string[];
  }) {
    if (isVocabularyAudioLoading) {
      return inflightVocabularyAudioRequestRef.current ?? localVocabItems;
    }

    const requestedKeys = options?.itemTexts?.length
      ? new Set(options.itemTexts.map((itemText) => getCapturedVocabularyKey(itemText)))
      : null;
    const requestedLemmaKeys = options?.itemTexts?.length
      ? new Set(
          options.itemTexts.map((itemText) =>
            resolveVocabularyLemma({
              itemText,
              itemType: itemText.includes(" ") ? "phrase" : "word",
            }).canonicalLemma
          )
        )
      : null;
    const relevantItems = requestedKeys
      ? localVocabItems.filter((item) => {
          const itemTextKey = getCapturedVocabularyKey(item.item_text);
          const itemLemmaKey = getVocabularyItemMergeKey(item);
          return requestedKeys.has(itemTextKey) || Boolean(requestedLemmaKeys?.has(itemLemmaKey));
        })
      : localVocabItems;
    const hasMissingAudio =
      options?.force || relevantItems.some((item) => !item.audio_url);
    if (!hasMissingAudio) {
      return relevantItems;
    }

    setIsVocabularyAudioLoading(true);

    const audioRequestPromise = (async () => {
      try {
        const targetedItemTexts = options?.itemTexts
          ?.map((itemText) => itemText.trim())
          .filter(Boolean);

        if (targetedItemTexts?.length) {
          try {
            const materializeResponse = await fetch("/api/vocabulary/generate-from-captures", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                studentId,
                lessonId,
                itemTexts: targetedItemTexts,
                limit: targetedItemTexts.length,
              }),
            });

            const materializePayload = await materializeResponse.json().catch(() => null);

            if (materializeResponse.ok) {
              const materializedItems = Array.isArray(materializePayload?.items)
                ? materializePayload.items
                : [];

              if (materializedItems.length > 0) {
                requestedAudioSignatureRef.current = "";
                setLocalVocabItems((current) => mergeVocabularyItems(current, materializedItems));
              }
            } else {
              console.error(
                "requestVocabularyAudio materialize error",
                materializePayload?.error ?? "Failed to prepare vocabulary item for audio"
              );
            }
          } catch (materializeError) {
            console.error("requestVocabularyAudio materialize error", materializeError);
          }
        }

        const response = await fetch("/api/vocabulary/regenerate-audio", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            lessonId,
            itemTexts: options?.itemTexts ?? null,
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
        return nextItems;
      } catch (error) {
        console.error("requestVocabularyAudio error", error);
        requestedAudioSignatureRef.current = "";
        return;
      } finally {
        setIsVocabularyAudioLoading(false);
        inflightVocabularyAudioRequestRef.current = null;
      }
    })();

    inflightVocabularyAudioRequestRef.current = audioRequestPromise;
    return audioRequestPromise;
  }

  async function prepareQuizVocabularyReview() {
    const quizCapturedItems = capturedItems.filter(
      (item) => item.sourceType === "question" || item.sourceType === "answer"
    );

    if (quizCapturedItems.length === 0) {
      return;
    }

    await flushPendingVocabularyItems(quizCapturedItems);

    const fallbackItems = buildCapturedVocabularyReviewItems({
      items: quizCapturedItems,
      sourceItems: localVocabItems,
      lessonId: `${lessonId}:quiz`,
    });

    if (fallbackItems.length === 0) {
      return;
    }

    requestedAudioSignatureRef.current = "";
    setLocalVocabItems((current) => mergeVocabularyItems(current, fallbackItems));
    const relevantMergeKeys = new Set(fallbackItems.map((item) => getVocabularyItemMergeKey(item)));
    try {
      const itemTexts = fallbackItems.map((item) => item.item_text);
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
        throw new Error(payload?.error ?? "Failed to prepare quiz vocabulary cards");
      }

      const generatedItems = Array.isArray(payload?.items) ? payload.items : [];

      if (generatedItems.length > 0) {
        const relevantGeneratedItems = generatedItems.filter((item) =>
          relevantMergeKeys.has(getVocabularyItemMergeKey(item))
        );

        if (relevantGeneratedItems.length > 0) {
          setLocalVocabItems((current) => mergeVocabularyItems(current, relevantGeneratedItems));
        }

        for (const item of relevantGeneratedItems) {
          const key = item.item_text.trim().toLowerCase();
          if (isFallbackVocabularyItem(item)) {
            hydratedVocabularyKeysRef.current.delete(key);
          } else {
            hydratedVocabularyKeysRef.current.add(key);
          }
        }

        const remainingFallbackItems = relevantGeneratedItems.filter((item) =>
          isFallbackVocabularyItem(item)
        );

        if (remainingFallbackItems.length > 0) {
          await hydrateVisibleVocabularyItems(remainingFallbackItems);
        }
      } else {
        await hydrateVisibleVocabularyItems(fallbackItems);
      }
    } catch (error) {
      console.error("prepareQuizVocabularyReview generate error", error);
      await hydrateVisibleVocabularyItems(fallbackItems);
    }

    try {
      const prepareResponse = await fetch("/api/vocabulary/prepare-drills", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId,
        }),
      });

      const preparePayload = await prepareResponse.json().catch(() => null);

      if (!prepareResponse.ok) {
        throw new Error(preparePayload?.error ?? "Failed to prepare quiz vocabulary drills");
      }

      const preparedItems = Array.isArray(preparePayload?.items)
        ? preparePayload.items.filter((item: VocabItem) =>
            relevantMergeKeys.has(getVocabularyItemMergeKey(item))
          )
        : [];

      if (preparedItems.length > 0) {
        requestedAudioSignatureRef.current = "";
        setLocalVocabItems((current) => mergeVocabularyItems(current, preparedItems));
        for (const item of preparedItems) {
          const key = item.item_text.trim().toLowerCase();
          if (isFallbackVocabularyItem(item)) {
            hydratedVocabularyKeysRef.current.delete(key);
          } else {
            hydratedVocabularyKeysRef.current.add(key);
          }
        }
      }
    } catch (error) {
      console.error("prepareQuizVocabularyReview drill prep error", error);
    }

    await requestVocabularyAudio({
      force: true,
      itemTexts: fallbackItems.map((item) => item.item_text),
    });
  }

  async function openReadingWordsView() {
    setReadingView("words");

    if (capturedItems.length === 0) {
      return;
    }

    await flushPendingVocabularyItems();

    const fallbackItems = buildCapturedVocabularyReviewItems({
      items: capturedItems,
      sourceItems: localVocabItems,
      lessonId: `${lessonId}:reading`,
    });

    if (fallbackItems.length > 0) {
      requestedAudioSignatureRef.current = "";
      setLocalVocabItems((current) => mergeVocabularyItems(current, fallbackItems));
    }
  }

  async function handleDeleteVocabularyItem(item: VocabItem) {
    const mergeKey = getVocabularyItemMergeKey(item);

    if (isPersistedVocabularyItemId(item.id)) {
      await deleteStudentVocabularyItem({
        studentId,
        vocabularyItemId: item.id,
      });
    }

    requestedAudioSignatureRef.current = "";
    setLocalVocabItems((current) =>
      current.filter((candidate) => getVocabularyItemMergeKey(candidate) !== mergeKey)
    );
    setCapturedItems((current) =>
      current.filter((candidate) => getCapturedVocabularyMergeKey(candidate) !== mergeKey)
    );
  }

  async function handleRegenerateVocabularyItem(item: VocabItem) {
    if (!isPersistedVocabularyItemId(item.id)) {
      throw new Error("Save this word first, then regenerate its meaning.");
    }

    const updatedItem = await regenerateStudentVocabularyMeaning({
      studentId,
      vocabularyItemId: item.id,
      contextText: item.context_sentence ?? item.example_text ?? null,
    });

    setLocalVocabItems((current) => mergeVocabularyItems(current, [updatedItem]));
    return updatedItem;
  }

  function renderReadingViewToggle() {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1">
        <button
          type="button"
          onClick={() => setReadingView("text")}
          className={`min-h-10 flex-1 rounded-full px-4 text-sm font-semibold transition ${
            readingView === "text"
              ? "bg-[var(--color-surface)] token-text-primary shadow-sm"
              : "token-text-secondary"
          }`}
        >
          Text
        </button>
        <button
          type="button"
          onClick={() => void openReadingWordsView()}
          className={`min-h-10 flex-1 rounded-full px-4 text-sm font-semibold transition ${
            readingView === "words"
              ? "bg-[var(--color-surface)] token-text-primary shadow-sm"
              : "token-text-secondary"
          }`}
        >
          {capturedLessonWordCount > 0 ? `Words (${capturedLessonWordCount})` : "Words"}
        </button>
      </div>
    );
  }

  function renderReadingAudioPlayer() {
    const showAudioControls =
      Boolean(passageAudioUrl) &&
      (stage === "first_read" || stage === "second_read");

    if (!showAudioControls) {
      return null;
    }

    return (
      <div className="mb-4">
        <PassageAudioControls
          audioUrl={passageAudioUrl}
          startMs={passageAudioStartMs}
          endMs={passageAudioEndMs}
          passageText={passageText}
          sentenceTimings={passageAudioSentenceTimings}
          alignmentConfidence={passageAudioAlignmentConfidence}
          onActiveSentenceChange={setActiveAudioSentenceText}
          compact
        />
      </div>
    );
  }

  const uniqueCapturedLessonWords = Array.from(
    new Map(
      capturedItems.map((item) => [getCapturedVocabularyKey(item.itemText), item.itemText.trim()])
    ).values()
  );
  const capturedLessonWordCount = uniqueCapturedLessonWords.length;
  const quizVocabularyItems = buildCapturedVocabularyReviewItems({
    items: capturedItems.filter(
      (item) => item.sourceType === "question" || item.sourceType === "answer"
    ),
    sourceItems: localVocabItems,
    lessonId: `${lessonId}:quiz`,
  });
  const lessonVocabularyItems = buildCapturedVocabularyReviewItems({
    items: capturedItems,
    sourceItems: localVocabItems,
    lessonId: `${lessonId}:reading`,
  });

  if (stage === "completed") {
    const skipCompletionHref =
      nextLessonId ? studentLessonPath(nextLessonId) : studentLibraryPath();
    const guidedPracticeHref = studentVocabularyDrillPath({
      mode: "learn_new_words",
      lesson: lessonId,
      guided: "lesson_intro",
      guidedWords:
        capturedLessonWordCount > 0 ? JSON.stringify(uniqueCapturedLessonWords) : undefined,
      nextLesson: nextLessonId ?? undefined,
    });
    const shouldPromptPractice = capturedLessonWordCount > 0;

    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="app-card px-5 py-6 sm:px-6">
          <div className="space-y-4">
            <div>
              <h2 className="app-heading-lg">
                Lesson Complete
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              {shouldPromptPractice ? (
                <>
                  <Link
                    href={guidedPracticeHref}
                    className="app-button app-button-primary"
                  >
                    Start Practice
                  </Link>
                  <Link
                    href={skipCompletionHref}
                    className="app-button app-button-secondary"
                  >
                    Skip for now
                  </Link>
                </>
              ) : (
                <Link
                  href={skipCompletionHref}
                  className="app-button app-button-primary"
                >
                  {nextLessonId ? "Continue Reading" : "Back to Library"}
                </Link>
              )}
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
            nextLessonId={nextLessonId}
            questions={questions}
            passageText={passageText}
            passageAudioUrl={passageAudioUrl}
            passageAudioStartMs={passageAudioStartMs}
            passageAudioEndMs={passageAudioEndMs}
            passageAudioSentenceTimings={passageAudioSentenceTimings}
            passageAudioAlignmentConfidence={passageAudioAlignmentConfidence}
            passageId={passageId}
            knownWords={localVocabItems}
            quizVocabularyItems={quizVocabularyItems}
            isQuizVocabularyHydrating={isVocabularyHydrating}
            onQuizVocabularyVisibleItemsChange={hydrateVisibleVocabularyItems}
            onRequestQuizVocabularyAudio={requestVocabularyAudio}
            isQuizVocabularyAudioLoading={isVocabularyAudioLoading}
            onPrepareQuizVocabularyReview={prepareQuizVocabularyReview}
            onVocabularyCaptured={handleCaptured}
            onDeleteQuizVocabularyItem={handleDeleteVocabularyItem}
            onRegenerateQuizVocabularyItem={handleRegenerateVocabularyItem}
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
        <VocabularyReviewCards
          items={localVocabItems}
          isHydrating={isVocabularyHydrating}
          onVisibleItemsChange={hydrateVisibleVocabularyItems}
          onRequestAudio={requestVocabularyAudio}
          onDeleteItem={handleDeleteVocabularyItem}
          onRegenerateItem={handleRegenerateVocabularyItem}
          isAudioLoading={isVocabularyAudioLoading}
          onBackToReading={() => setStage("first_read")}
          onDone={() => void startSecondRead()}
        />
      </div>
    );
  }

  if (stage === "second_read") {
    return (
      <>
        <div className="reading-stage-shell pb-28">
          <div className="mx-auto max-w-[42rem] px-3 pb-7 pt-2 sm:px-5">
            <div className="reading-surface px-4 py-6 sm:px-7 sm:py-8">
              {renderReadingAudioPlayer()}
              {renderReadingViewToggle()}
              {readingView === "words" ? (
                <VocabularyReviewCards
                  items={lessonVocabularyItems}
                  embedded
                  title="Words from this lesson"
                  emptyTitle="No lesson words yet"
                  emptyCopy="Capture a few words first, then switch back here to review them."
                  isHydrating={isVocabularyHydrating}
                  onVisibleItemsChange={hydrateVisibleVocabularyItems}
                  onRequestAudio={requestVocabularyAudio}
                  onDeleteItem={handleDeleteVocabularyItem}
                  onRegenerateItem={handleRegenerateVocabularyItem}
                  isAudioLoading={isVocabularyAudioLoading}
                />
              ) : (
                <InteractivePassageReader
                  studentId={studentId}
                  lessonId={lessonId}
                  passageId={passageId}
                  passageText={passageText}
                  audioHighlightText={activeAudioSentenceText}
                  knownWords={localVocabItems}
                  onCaptured={handleCaptured}
                  mode="review"
                />
              )}
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
      <div className="mx-auto max-w-[42rem] px-3 pb-7 pt-2 sm:px-5">
        <div className="reading-surface px-4 py-6 sm:px-7 sm:py-8">
          {renderReadingAudioPlayer()}
          {renderReadingViewToggle()}
          {readingView === "words" ? (
            <VocabularyReviewCards
              items={lessonVocabularyItems}
              embedded
              title="Words from this lesson"
              emptyTitle="No words captured yet"
              emptyCopy="Long press any word in the passage and it will appear here."
              isHydrating={isVocabularyHydrating}
              onVisibleItemsChange={hydrateVisibleVocabularyItems}
              onRequestAudio={requestVocabularyAudio}
              onDeleteItem={handleDeleteVocabularyItem}
              onRegenerateItem={handleRegenerateVocabularyItem}
              isAudioLoading={isVocabularyAudioLoading}
            />
          ) : (
            <InteractivePassageReader
              studentId={studentId}
              lessonId={lessonId}
              passageId={passageId}
              passageText={passageText}
              audioHighlightText={activeAudioSentenceText}
              knownWords={localVocabItems}
              onCaptured={handleCaptured}
              mode="capture"
            />
          )}
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
