"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import InteractivePassageReader from "./InteractivePassageReader";
import MascotCat from "./MascotCat";
import FeedbackSettingsButton from "./FeedbackSettingsButton";
import InlineVocabularyCaptureText from "./InlineVocabularyCaptureText";
import VocabularyReviewCards from "./VocabularyReviewCards";
import type { CapturedVocabularyItem } from "./PassageVocabularyCapture";
import {
  getAnswerFeedbackCue,
  primeFeedbackAudio,
  triggerFeedbackCue,
} from "@/services/feedback/feedback-effects.client";
import { useFeedbackSettings } from "@/services/feedback/use-feedback-settings";
import {
  studentDashboardPath,
  studentLessonPath,
  studentVocabularyPath,
} from "@/lib/routes/student";

type OptionKey = "A" | "B" | "C" | "D";

type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option?: OptionKey;
  explanation?: string | null;
  question_type: string;
};

type KnownWord = {
  id: string;
  item_text: string;
  lifecycle_state?: string | null;
  review_bucket?: "recently_failed" | "weak_again" | "overdue" | "reinforcement" | "scheduled" | null;
  review_ready?: boolean;
};

type QuizVocabularyItem = {
  id: string;
  item_text: string;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  example_text?: string | null;
  context_sentence?: string | null;
  audio_url?: string | null;
};

type LessonCompletionPayload = {
  vocabularyPreparation?: {
    generatedCount?: number;
    preparedCount?: number;
    totalItems?: number;
  } | null;
  xpReward?: {
    xpAwarded?: number;
    progress?: {
      previousLevel?: number;
      currentLevel?: number;
      leveledUp?: boolean;
      previousStreakDays?: number;
      currentStreakDays?: number;
    } | null;
    gamification?: {
      xp?: number;
      level?: number;
      streak_days?: number;
      longest_streak_days?: number;
    } | null;
  } | null;
} | null;

type FloatingReward = {
  id: string;
  xp: number;
  comboCount: number;
  comboMultiplier: number;
  leveledUp: boolean;
};

type QuestionReasoningExplanation = {
  correct_answer: {
    option: OptionKey;
    text: string;
  };
  why_correct: string;
  why_others_wrong: Array<{
    option: OptionKey;
    text: string;
    reason: string;
  }>;
  thinking_tip: string;
};

type RepairMode = "scope" | "inference" | "detail" | "context_word" | "evidence";

type RepairMicroTask = {
  mode: RepairMode;
  strategyLabel: string;
  reviewTitle: string;
  reviewCopy: string;
  actionLabel: string;
  prompt: string;
  supportText: string | null;
  hint: string;
  successMessage: string;
  options: Array<{
    key: OptionKey;
    text: string;
  }>;
  correctOption: OptionKey;
};

type RepairItem = {
  question: Question;
  selectedOption: OptionKey;
  selectedText: string;
  correctOption: OptionKey;
  correctText: string;
  relevantSentence: string | null;
  microTask: RepairMicroTask;
};

type QuizPhase = "quiz" | "results" | "quiz_words" | "repair" | "repair_complete";

type Props = {
  studentId: string;
  lessonId: string;
  nextLessonId?: string | null;
  passageId?: string;
  questions: Question[];
  passageText?: string;
  knownWords?: KnownWord[];
  quizVocabularyItems?: QuizVocabularyItem[];
  isQuizVocabularyHydrating?: boolean;
  onQuizVocabularyVisibleItemsChange?: (items: QuizVocabularyItem[]) => void;
  onRequestQuizVocabularyAudio?: (options?: {
    force?: boolean;
    itemTexts?: string[];
  }) => Promise<void> | void;
  isQuizVocabularyAudioLoading?: boolean;
  onPrepareQuizVocabularyReview?: () => Promise<void> | void;
  onVocabularyCaptured?: (item: CapturedVocabularyItem) => void;
  onBeforeComplete?: () => Promise<void>;
  onFinished?: (result: LessonCompletionPayload) => void;
  onProgressChange?: Dispatch<
    SetStateAction<{
      totalQuestions: number;
      answeredQuestions: number;
    }>
  >;
  initialAnswers?: Record<string, OptionKey>;
  initialQuestionIndex?: number;
};

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];
const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "because",
  "being",
  "between",
  "could",
  "does",
  "from",
  "have",
  "into",
  "just",
  "more",
  "most",
  "only",
  "over",
  "some",
  "than",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "under",
  "very",
  "what",
  "which",
  "while",
  "with",
  "would",
]);

function getQuizVocabularyAudioSignature(items: QuizVocabularyItem[]) {
  return items
    .filter((item) => !item.audio_url)
    .map((item) => item.item_text.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}

function getQuestionOptions(question: Question) {
  return [
    { key: "A" as const, text: question.option_a },
    { key: "B" as const, text: question.option_b },
    { key: "C" as const, text: question.option_c },
    { key: "D" as const, text: question.option_d },
  ];
}

const SENTENCE_END_ABBREVIATIONS = new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "prof.",
  "sr.",
  "jr.",
  "st.",
  "mt.",
  "vs.",
  "etc.",
  "e.g.",
  "i.e.",
  "u.s.",
  "u.k.",
]);

function shouldMergeSentenceBoundary(current: string, next: string) {
  const tail = current.trim().toLowerCase();
  if (!tail || !next.trim()) {
    return false;
  }

  const lastToken = tail.split(/\s+/).pop() ?? "";
  if (SENTENCE_END_ABBREVIATIONS.has(lastToken)) {
    return true;
  }

  if (/^[a-z]\.$/i.test(lastToken)) {
    return true;
  }

  return false;
}

function splitIntoSentences(text: string) {
  const rawSentences = (text.match(/[^.!?]+[.!?]+["'”’)\]]*|[^.!?]+$/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (rawSentences.length <= 1) {
    return rawSentences;
  }

  const merged: string[] = [];

  for (const sentence of rawSentences) {
    const previous = merged[merged.length - 1];
    if (previous && shouldMergeSentenceBoundary(previous, sentence)) {
      merged[merged.length - 1] = `${previous} ${sentence}`.replace(/\s+/g, " ").trim();
      continue;
    }

    merged.push(sentence);
  }

  return merged;
}

function extractSearchTokens(...values: Array<string | null | undefined>) {
  return values
    .flatMap((value) =>
      (value ?? "")
        .toLowerCase()
        .split(/[^a-z]+/g)
        .filter((token) => token.length >= 4 && !STOP_WORDS.has(token))
    );
}

function findRelevantSentence(params: {
  passageText: string;
  questionText: string;
  correctText: string;
  selectedText: string;
}) {
  const sentences = splitIntoSentences(params.passageText);

  if (sentences.length === 0) {
    return null;
  }

  const queryTokens = extractSearchTokens(
    params.questionText,
    params.correctText,
    params.selectedText
  );

  const ranked = sentences
    .map((sentence) => {
      const sentenceLower = sentence.toLowerCase();
      const overlap = queryTokens.reduce((score, token) => {
        return sentenceLower.includes(token) ? score + 1 : score;
      }, 0);
      const exactCorrectBoost = params.correctText
        ? Number(sentenceLower.includes(params.correctText.toLowerCase())) * 2
        : 0;

      return {
        sentence,
        score: overlap + exactCorrectBoost,
      };
    })
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.sentence ?? sentences[0] ?? null;
}

function getRepairHint(questionType: string) {
  switch (questionType) {
    case "vocabulary_in_context":
      return "Swap the word into the sentence and keep the tone of the line intact.";
    case "detail":
      return "Stay with what the text actually says, not what feels generally true.";
    case "main_idea":
      return "Pick the choice that fits the purpose of the line without stretching wider.";
    case "inference":
      return "Choose the idea the text supports, not the one that goes furthest.";
    default:
      return "Anchor your choice in the sentence, not in an isolated keyword.";
  }
}

function getRepairMode(questionType: string): RepairMode {
  switch (questionType) {
    case "vocabulary_in_context":
    case "meaning_in_context":
    case "definition":
    case "translation":
      return "context_word";
    case "detail":
      return "detail";
    case "main_idea":
      return "scope";
    case "inference":
      return "inference";
    default:
      return "evidence";
  }
}

function getRepairConfig(questionType: string, hasSentence: boolean) {
  const mode = getRepairMode(questionType);

  switch (mode) {
    case "context_word":
      return {
        mode,
        strategyLabel: "Context Word Repair",
        reviewTitle: "Meaning slipped off the line.",
        reviewCopy:
          "Read the local sentence again and choose the meaning that keeps both the sense and the tone intact.",
        successMessage: "Good repair. You matched the word to the local meaning, not just the familiar definition.",
      };
    case "detail":
      return {
        mode,
        strategyLabel: "Detail Trap Repair",
        reviewTitle: "This one needed tighter evidence.",
        reviewCopy:
          "Stay with what the text directly gives you. The best answer should be supported, not loosely related.",
        successMessage: "Good repair. You stayed with the line instead of reaching past it.",
      };
    case "scope":
      return {
        mode,
        strategyLabel: "Scope Repair",
        reviewTitle: "The trap was about scope.",
        reviewCopy:
          hasSentence
            ? "Match the point of this part of the passage without going broader or narrower than the text allows."
            : "Match the passage's real point without stretching wider or shrinking to one detail.",
        successMessage: "Good repair. You found the answer that fits the passage's real scope.",
      };
    case "inference":
      return {
        mode,
        strategyLabel: "Inference Repair",
        reviewTitle: "This one asked for a supported conclusion.",
        reviewCopy:
          "Pick the idea the passage strongly suggests. The repair is about support, not the boldest sounding claim.",
        successMessage: "Good repair. You chose the conclusion the passage supports without overreaching.",
      };
    default:
      return {
        mode,
        strategyLabel: "Evidence Repair",
        reviewTitle: "Go back to the text anchor.",
        reviewCopy:
          "Reopen the relevant line, drop the keyword trap, and choose the answer the passage actually supports.",
        successMessage: "Good repair. You re-anchored the choice in the passage.",
      };
  }
}

function buildRepairMicroTask(question: Question, relevantSentence: string | null): RepairMicroTask {
  const originalOptions = getQuestionOptions(question);
  const config = getRepairConfig(question.question_type, Boolean(relevantSentence));
  const options = originalOptions.map((option) => ({
    key: option.key,
    text: option.text,
  }));

  return {
    mode: config.mode,
    strategyLabel: config.strategyLabel,
    reviewTitle: config.reviewTitle,
    reviewCopy: config.reviewCopy,
    actionLabel: "Retry the Question",
    prompt: question.question_text,
    supportText: relevantSentence,
    hint: getRepairHint(question.question_type),
    successMessage: config.successMessage,
    options,
    correctOption: question.correct_option ?? "A",
  };
}

export default function LessonPlayer({
  studentId,
  lessonId,
  nextLessonId = null,
  passageId,
  questions,
  passageText,
  knownWords = [],
  quizVocabularyItems = [],
  isQuizVocabularyHydrating = false,
  onQuizVocabularyVisibleItemsChange,
  onRequestQuizVocabularyAudio,
  isQuizVocabularyAudioLoading = false,
  onPrepareQuizVocabularyReview,
  onVocabularyCaptured,
  onBeforeComplete,
  onFinished,
  onProgressChange,
  initialAnswers,
  initialQuestionIndex = 0,
}: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(initialQuestionIndex);
  const [answerMap, setAnswerMap] = useState<Record<string, OptionKey>>(initialAnswers ?? {});
  const [selected, setSelected] = useState<string | null>(
    questions[initialQuestionIndex]
      ? initialAnswers?.[questions[initialQuestionIndex].id] ?? null
      : null
  );
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(
    questions[initialQuestionIndex]
      ? Boolean(initialAnswers?.[questions[initialQuestionIndex].id])
      : false
  );
  const [quizPhase, setQuizPhase] = useState<QuizPhase>("quiz");
  const [showPassage, setShowPassage] = useState(false);
  const [passageHighlightText, setPassageHighlightText] = useState<string | null>(null);
  const [explanationQuestionId, setExplanationQuestionId] = useState<string | null>(null);
  const [explanationCache, setExplanationCache] = useState<
    Record<string, QuestionReasoningExplanation | undefined>
  >({});
  const [explanationLoadingFor, setExplanationLoadingFor] = useState<string | null>(null);
  const [explanationErrorFor, setExplanationErrorFor] = useState<Record<string, string | undefined>>(
    {}
  );
  const [repairIndex, setRepairIndex] = useState(0);
  const [repairStep, setRepairStep] = useState<"review" | "microtask">("microtask");
  const [repairChoice, setRepairChoice] = useState<OptionKey | null>(null);
  const [repairFeedback, setRepairFeedback] = useState<{
    status: "correct" | "incorrect";
    message: string;
  } | null>(null);
  const [quizContinueReady, setQuizContinueReady] = useState(false);
  const [sessionXpEarned, setSessionXpEarned] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [floatingReward, setFloatingReward] = useState<FloatingReward | null>(null);
  const [levelProgress, setLevelProgress] = useState<{
    previousLevel: number | null;
    currentLevel: number | null;
    leveledUp: boolean;
    streakDays: number | null;
  }>({
    previousLevel: null,
    currentLevel: null,
    leveledUp: false,
    streakDays: null,
  });
  const questionStartedAtRef = useRef<number>(Date.now());
  const completionCuePlayedRef = useRef<string | null>(null);
  const requestedQuizAudioSignatureRef = useRef<string>("");
  const { settings: feedbackSettings } = useFeedbackSettings();

  const question = questions[index];

  const questionLookup = useMemo(() => {
    return new Map(questions.map((item) => [item.id, item]));
  }, [questions]);

  const answeredQuestions = useMemo(() => {
    return questions.flatMap((item) => {
      const selectedOption = answerMap[item.id];
      const correctOption = item.correct_option;

      if (!selectedOption || !correctOption) {
        return [];
      }

      const options = getQuestionOptions(item);
      const selectedText =
        options.find((option) => option.key === selectedOption)?.text ?? "";
      const correctText =
        options.find((option) => option.key === correctOption)?.text ?? "";

      return [
        {
          question: item,
          selectedOption,
          selectedText,
          correctOption,
          correctText,
          isCorrect: selectedOption === correctOption,
        },
      ];
    });
  }, [answerMap, questions]);

  const correctCount = answeredQuestions.filter((item) => item.isCorrect).length;
  const currentCorrectStreak = useMemo(() => {
    let streak = 0;

    for (let currentIndex = answeredQuestions.length - 1; currentIndex >= 0; currentIndex -= 1) {
      if (!answeredQuestions[currentIndex]?.isCorrect) {
        break;
      }

      streak += 1;
    }

    return streak;
  }, [answeredQuestions]);
  const mistakeItems = useMemo<RepairItem[]>(() => {
    return answeredQuestions
      .filter((item) => !item.isCorrect)
      .map((item) => {
        const relevantSentence = passageText
          ? findRelevantSentence({
              passageText,
              questionText: item.question.question_text,
              correctText: item.correctText,
              selectedText: item.selectedText,
            })
          : null;

        return {
          question: item.question,
          selectedOption: item.selectedOption,
          selectedText: item.selectedText,
          correctOption: item.correctOption,
          correctText: item.correctText,
          relevantSentence,
          microTask: buildRepairMicroTask(item.question, relevantSentence),
        };
      });
  }, [answeredQuestions, passageText]);

  const activeRepairItem = mistakeItems[repairIndex] ?? null;
  const repairProgressPercent =
    mistakeItems.length > 0 ? ((repairIndex + 1) / mistakeItems.length) * 100 : 0;

  useEffect(() => {
    questionStartedAtRef.current = Date.now();
  }, [index]);

  useEffect(() => {
    setQuizContinueReady(false);
  }, [index]);

  useEffect(() => {
    primeFeedbackAudio();
  }, []);

  useEffect(() => {
    if (!question) {
      return;
    }

    setSelected(answerMap[question.id] ?? null);
    setSubmitted(Boolean(answerMap[question.id]));
  }, [answerMap, question]);

  useEffect(() => {
    setShowPassage(false);
    setPassageHighlightText(null);
    setExplanationQuestionId(null);
  }, [index, quizPhase, repairIndex]);

  useEffect(() => {
    setRepairStep("microtask");
    setRepairChoice(null);
    setRepairFeedback(null);
  }, [repairIndex, quizPhase]);

  useEffect(() => {
    if (quizPhase !== "quiz_words") {
      requestedQuizAudioSignatureRef.current = "";
      return;
    }

    if (
      !onRequestQuizVocabularyAudio ||
      isQuizVocabularyHydrating ||
      isQuizVocabularyAudioLoading
    ) {
      return;
    }

    const missingAudioSignature = getQuizVocabularyAudioSignature(quizVocabularyItems);

    if (
      !missingAudioSignature ||
      requestedQuizAudioSignatureRef.current === missingAudioSignature
    ) {
      return;
    }

    requestedQuizAudioSignatureRef.current = missingAudioSignature;
    void onRequestQuizVocabularyAudio({
      force: true,
      itemTexts: quizVocabularyItems
        .filter((item) => !item.audio_url)
        .map((item) => item.item_text),
    });
  }, [
    isQuizVocabularyAudioLoading,
    isQuizVocabularyHydrating,
    onRequestQuizVocabularyAudio,
    quizPhase,
    quizVocabularyItems,
  ]);

  useEffect(() => {
    const completionState =
      quizPhase === "repair_complete"
        ? "repair_complete"
        : quizPhase === "results" && mistakeItems.length === 0
          ? "results_clean"
          : null;

    if (!completionState || completionCuePlayedRef.current === completionState) {
      return;
    }

    completionCuePlayedRef.current = completionState;
    triggerFeedbackCue("completion", feedbackSettings);
  }, [feedbackSettings, mistakeItems.length, quizPhase]);

  async function ensureExplanation(questionToExplain: Question) {
    if (explanationCache[questionToExplain.id] || explanationLoadingFor === questionToExplain.id) {
      return;
    }

    const options = getQuestionOptions(questionToExplain);

    setExplanationLoadingFor(questionToExplain.id);
    setExplanationErrorFor((current) => ({ ...current, [questionToExplain.id]: undefined }));

    try {
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passageText: passageText || "",
          questionText: questionToExplain.question_text,
          correctOption: questionToExplain.correct_option,
          questionExplanation: questionToExplain.explanation ?? null,
          options: options.map((option) => ({
            option: option.key,
            text: option.text,
          })),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Explanation unavailable");
      }

      setExplanationCache((current) => ({
        ...current,
        [questionToExplain.id]: payload?.data,
      }));
    } catch (error) {
      setExplanationErrorFor((current) => ({
        ...current,
        [questionToExplain.id]:
          error instanceof Error ? error.message : "Explanation unavailable right now.",
      }));
    } finally {
      setExplanationLoadingFor((current) => (current === questionToExplain.id ? null : current));
    }
  }

  async function openExplanation(questionToExplain: Question) {
    setExplanationQuestionId(questionToExplain.id);
    await ensureExplanation(questionToExplain);
  }

  function triggerFloatingReward(params: {
    xp: number;
    comboCount: number;
    comboMultiplier: number;
    leveledUp?: boolean;
  }) {
    if (params.xp <= 0) {
      return;
    }

    const rewardId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setFloatingReward({
      id: rewardId,
      xp: params.xp,
      comboCount: params.comboCount,
      comboMultiplier: params.comboMultiplier,
      leveledUp: Boolean(params.leveledUp),
    });

    window.setTimeout(() => {
      setFloatingReward((current) => (current?.id === rewardId ? null : current));
    }, 1700);
  }

  async function completeLesson(redirectHref?: string) {
    setSaving(true);

    try {
      if (onBeforeComplete) {
        await onBeforeComplete();
      }

      const response = await fetch("/api/lesson/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, lessonId }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to complete lesson");
      }

      const completionXpReward = payload?.result?.xpReward ?? null;
      const awardedXp = Math.max(0, Number(completionXpReward?.xpAwarded ?? 0));

      if (awardedXp > 0) {
        setSessionXpEarned((prev) => prev + awardedXp);
        setLevelProgress((current) => ({
          previousLevel: completionXpReward?.progress?.previousLevel ?? current.previousLevel,
          currentLevel:
            completionXpReward?.progress?.currentLevel ??
            completionXpReward?.gamification?.level ??
            current.currentLevel,
          leveledUp: Boolean(completionXpReward?.progress?.leveledUp) || current.leveledUp,
          streakDays:
            completionXpReward?.progress?.currentStreakDays ??
            completionXpReward?.gamification?.streak_days ??
            current.streakDays,
        }));
        triggerFloatingReward({
          xp: awardedXp,
          comboCount,
          comboMultiplier: 1,
          leveledUp: Boolean(completionXpReward?.progress?.leveledUp),
        });
      }

      if (redirectHref) {
        router.push(redirectHref);
      } else {
        onFinished?.(payload?.result ?? null);
      }
    } catch (error) {
      console.error("complete lesson error", error);
      alert("Failed to complete lesson");
    } finally {
      setSaving(false);
    }
  }

  async function submitAnswer() {
    if (!selected || !question) {
      return;
    }

    setSaving(true);

    try {
      const durationSec = Math.max(
        1,
        Math.round((Date.now() - questionStartedAtRef.current) / 1000)
      );
      const localIsCorrect = selected === question.correct_option;
      const localComboAfter = localIsCorrect ? comboCount + 1 : 0;

      setAnswerMap((current) => ({
        ...current,
        [question.id]: selected as OptionKey,
      }));
      setSubmitted(true);
      setQuizContinueReady(false);
      window.setTimeout(() => {
        setQuizContinueReady(true);
      }, 380);
      triggerFeedbackCue(
        getAnswerFeedbackCue({
          isCorrect: localIsCorrect,
          comboCountAfter: localComboAfter,
        }),
        feedbackSettings
      );

      await fetch("/api/lesson/save-question-progress", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId,
          questionId: question.id,
          selectedOption: selected,
          skill: question.question_type,
        }),
      });

      const attemptResponse = await fetch("/api/question-attempt", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId,
          questionId: question.id,
          selectedOption: selected,
          durationSec,
        }),
      });

      const attemptPayload = await attemptResponse.json().catch(() => null);

      if (!attemptResponse.ok) {
        throw new Error(attemptPayload?.error ?? "Failed to save answer");
      }

      const xpReward = attemptPayload?.result?.xpReward ?? null;
      const awardedXp = Math.max(0, Number(xpReward?.xpAwarded ?? 0));
      const comboAfter = Math.max(
        0,
        Number(
          xpReward?.breakdown?.comboCountAfter ??
            ((selected === question.correct_option ? comboCount + 1 : 0) as number)
        )
      );
      const comboMultiplier = Number(xpReward?.breakdown?.comboMultiplier ?? 1);
      setSessionXpEarned((prev) => prev + awardedXp);
      setComboCount(selected === question.correct_option ? comboAfter : 0);
      setMaxCombo((prev) => Math.max(prev, selected === question.correct_option ? comboAfter : prev));
      setLevelProgress((current) => ({
        previousLevel: xpReward?.progress?.previousLevel ?? current.previousLevel,
        currentLevel: xpReward?.progress?.currentLevel ?? xpReward?.gamification?.level ?? current.currentLevel,
        leveledUp: Boolean(xpReward?.progress?.leveledUp) || current.leveledUp,
        streakDays:
          xpReward?.progress?.currentStreakDays ??
          xpReward?.gamification?.streak_days ??
          current.streakDays,
      }));
      triggerFloatingReward({
        xp: awardedXp,
        comboCount: selected === question.correct_option ? comboAfter : 0,
        comboMultiplier,
        leveledUp: Boolean(xpReward?.progress?.leveledUp),
      });
      onProgressChange?.((prev) => ({
        totalQuestions: prev.totalQuestions,
        answeredQuestions: Math.max(prev.answeredQuestions, index + 1),
      }));
    } catch (error) {
      console.error("submit answer error", error);
      alert("Failed to save answer");
    } finally {
      setSaving(false);
    }
  }

  async function continueQuiz() {
    if (index >= questions.length - 1) {
      await openQuizWordsOrRepair();
      return;
    }

    setIndex((current) => current + 1);
  }

  function startQuizRepair() {
    setRepairIndex(0);
    setRepairStep("microtask");
    setRepairChoice(null);
    setRepairFeedback(null);
    setQuizPhase("repair");
  }

  async function openQuizWordsOrRepair() {
    if (quizVocabularyItems.length > 0) {
      setSaving(true);
      try {
        await onPrepareQuizVocabularyReview?.();
        setQuizPhase("quiz_words");
      } catch (error) {
        console.error("prepare quiz vocabulary review error", error);
        setQuizPhase("quiz_words");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (mistakeItems.length > 0) {
      startQuizRepair();
      return;
    }

    void completeLesson();
  }

  function continueAfterQuizWords() {
    if (mistakeItems.length > 0) {
      startQuizRepair();
      return;
    }

    setQuizPhase("results");
  }

  async function submitRepairChoice() {
    if (!activeRepairItem || !repairChoice) {
      return;
    }

    const explanation = explanationCache[activeRepairItem.question.id];
    if (repairChoice === activeRepairItem.microTask.correctOption) {
      const nextCombo = comboCount + 1;
      triggerFeedbackCue(
        getAnswerFeedbackCue({
          isCorrect: true,
          comboCountAfter: nextCombo,
        }),
        feedbackSettings
      );

      try {
        const response = await fetch("/api/lesson/repair-credit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            lessonId,
            questionId: activeRepairItem.question.id,
            comboCountAfter: nextCombo,
          }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to award repair credit");
        }

        const xpReward = payload?.data ?? null;
        const awardedXp = Math.max(0, Number(xpReward?.xpAwarded ?? 0));
        const comboAfter = Math.max(1, Number(xpReward?.breakdown?.comboCountAfter ?? nextCombo));
        const comboMultiplier = Number(xpReward?.breakdown?.comboMultiplier ?? 1);

        setSessionXpEarned((prev) => prev + awardedXp);
        setComboCount(comboAfter);
        setMaxCombo((prev) => Math.max(prev, comboAfter));
        setLevelProgress((current) => ({
          previousLevel: xpReward?.progress?.previousLevel ?? current.previousLevel,
          currentLevel: xpReward?.progress?.currentLevel ?? xpReward?.gamification?.level ?? current.currentLevel,
          leveledUp: Boolean(xpReward?.progress?.leveledUp) || current.leveledUp,
          streakDays:
            xpReward?.progress?.currentStreakDays ??
            xpReward?.gamification?.streak_days ??
            current.streakDays,
        }));
        triggerFloatingReward({
          xp: awardedXp,
          comboCount: comboAfter,
          comboMultiplier,
          leveledUp: Boolean(xpReward?.progress?.leveledUp),
        });
      } catch (error) {
        console.error("repair credit error", error);
      }

      setRepairFeedback({
        status: "correct",
        message: activeRepairItem.microTask.successMessage,
      });
      return;
    }

    triggerFeedbackCue(
      getAnswerFeedbackCue({
        isCorrect: false,
        comboCountAfter: 0,
      }),
      feedbackSettings
    );
    setComboCount(0);

    const wrongReason =
      explanation?.why_others_wrong.find((item) => item.option === repairChoice)?.reason ??
      activeRepairItem.microTask.hint;

    setRepairFeedback({
      status: "incorrect",
      message: wrongReason,
    });
  }

  function continueRepair() {
    if (repairIndex >= mistakeItems.length - 1) {
      setQuizPhase("repair_complete");
      return;
    }

    setRepairIndex((current) => current + 1);
  }

  function selectRepairChoice(nextChoice: OptionKey) {
    setRepairChoice(nextChoice);

    if (repairFeedback?.status === "incorrect") {
      setRepairFeedback(null);
    }
  }

  const explanationQuestion = explanationQuestionId
    ? questionLookup.get(explanationQuestionId) ?? null
    : null;
  const currentExplanation = explanationQuestion
    ? explanationCache[explanationQuestion.id]
    : undefined;
  const currentExplanationError = explanationQuestion
    ? explanationErrorFor[explanationQuestion.id]
    : undefined;
  const explanationSelectedOption =
    explanationQuestion && activeRepairItem?.question.id === explanationQuestion.id
      ? activeRepairItem.selectedOption
      : explanationQuestion
        ? answerMap[explanationQuestion.id] ?? null
        : null;
  const selectedWrongReason =
    explanationSelectedOption && currentExplanation
      ? currentExplanation.why_others_wrong.find(
          (item) => item.option === explanationSelectedOption
        ) ?? null
      : null;

  if (!question) {
    return <div className="text-sm token-text-secondary">No questions available.</div>;
  }

  const options = getQuestionOptions(question);
  const isCorrect =
    submitted && question.correct_option
      ? selected === question.correct_option
      : null;
  const selectedText =
    selected ? options.find((option) => option.key === selected)?.text ?? null : null;
  const correctText =
    question.correct_option
      ? options.find((option) => option.key === question.correct_option)?.text ?? null
      : null;
  const hasQuizHotStreak = isCorrect && currentCorrectStreak >= 3;
  const activeComboCount = submitted
    ? isCorrect
      ? Math.max(comboCount, currentCorrectStreak)
      : 0
    : comboCount;
  const activeComboBonus =
    activeComboCount >= 8
      ? 100
      : activeComboCount >= 5
        ? 50
        : activeComboCount >= 3
          ? 20
          : 0;
  const quizFeedbackTitle =
    isCorrect === null
      ? null
      : isCorrect
        ? hasQuizHotStreak
          ? "Sharp streak."
          : "Nice read."
        : "Trap spotted.";
  const quizFeedbackHint =
    isCorrect === null
      ? null
      : isCorrect
        ? hasQuizHotStreak
          ? `${currentCorrectStreak} correct in a row. Keep reading the passage this tightly.`
          : "You matched the text without overreaching."
        : question.question_type === "vocabulary_in_context" ||
            question.question_type === "meaning_in_context" ||
            question.question_type === "definition" ||
            question.question_type === "translation"
          ? "That meaning doesn't fit the word closely enough in this context."
          : question.question_type === "main_idea"
            ? "This choice misses the real scope of the passage."
            : question.question_type === "inference"
              ? "This choice goes further than the passage clearly supports."
              : question.question_type === "detail"
                ? "This choice is not supported directly enough by the text."
                : "This choice doesn't stay close enough to what the passage supports.";
  const quizFeedbackToneClass =
    isCorrect === null
      ? null
      : isCorrect
        ? "repair-feedback-card repair-feedback-card--correct"
        : "repair-feedback-card repair-feedback-card--incorrect";
  const quizPrimaryButtonClass = submitted
    ? isCorrect
      ? "primary-button min-h-14 flex-1 bg-emerald-600 hover:bg-emerald-500"
      : "primary-button min-h-14 flex-1"
    : "primary-button min-h-14 flex-1";
  const finalQuizActionLabel =
    quizVocabularyItems.length > 0
      ? "Review Quiz Words"
      : mistakeItems.length > 0
        ? "Start Repair"
        : "See Results";
  const continueReadingHref = nextLessonId
    ? studentLessonPath(nextLessonId)
    : studentDashboardPath();
  const startWordPracticeHref = studentVocabularyPath({
    mode: "learn_new_words",
    lesson: lessonId,
  });
  const quizCompleteHeading =
    mistakeItems.length > 0
      ? "Mistakes turned into practice."
      : "Clean run. Keep the momentum.";
  const quizCompleteCopy =
    mistakeItems.length > 0
      ? `You repaired ${mistakeItems.length} ${
          mistakeItems.length === 1 ? "miss" : "misses"
        } while the passage was still in view.`
      : "You stayed close to the text and finished this quiz with no repair needed.";

  return (
    <div className="relative flex min-h-full flex-1 flex-col pb-32">
      {showPassage ? (
        <div className="fixed inset-0 z-40 bg-[var(--color-surface)]/96 backdrop-blur-sm">
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
            <div className="reading-topbar">
              <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="text-sm font-medium token-text-secondary">
                  {passageHighlightText ? "Relevant passage" : "Passage"}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassage(false)}
                  className="secondary-button"
                >
                  {quizPhase === "repair" ? "Back to Question" : "Back"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              <div className="reading-surface px-5 py-7 sm:px-8 sm:py-9">
                <InteractivePassageReader
                  studentId={studentId}
                  lessonId={lessonId}
                  passageId={passageId}
                  passageText={passageText || "Passage unavailable for this question."}
                  highlightText={passageHighlightText}
                  knownWords={knownWords}
                  mode="capture"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {explanationQuestion ? (
        <div className="fixed inset-0 z-50 bg-slate-950/22 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Close explanation"
            onClick={() => setExplanationQuestionId(null)}
            className="absolute inset-0 h-full w-full"
          />

          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto w-full max-w-3xl rounded-t-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4 shadow-2xl sm:px-6">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--color-surface-muted)]" />

              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold token-text-primary">Why this answer works</div>
                <button
                  type="button"
                  onClick={() => setExplanationQuestionId(null)}
                  className="secondary-button min-h-10 px-4 text-sm"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm leading-[1.5] token-text-secondary">
                {explanationLoadingFor === explanationQuestion.id ? (
                  <div className="surface-soft-panel px-4 py-4">
                    Building a quick reasoning guide...
                  </div>
                ) : currentExplanation ? (
                  <>
                    <section className="surface-soft-panel px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] token-text-muted">
                        Correct answer
                      </div>
                      <div className="mt-2 text-sm font-semibold token-text-primary">
                        {currentExplanation.correct_answer.option}. {currentExplanation.correct_answer.text}
                      </div>
                    </section>

                    <section className="surface-soft-panel px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] token-text-muted">
                        Why it is correct
                      </div>
                      <div className="mt-2">{currentExplanation.why_correct}</div>
                    </section>

                    {selectedWrongReason ? (
                      <section className="surface-soft-panel px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] token-text-muted">
                          Why your answer missed
                        </div>
                        <div className="mt-2">
                          <span className="font-semibold token-text-primary">
                            {selectedWrongReason.option}. {selectedWrongReason.text}
                          </span>
                          <div className="mt-1 token-text-secondary">{selectedWrongReason.reason}</div>
                        </div>
                      </section>
                    ) : (
                      <section className="surface-soft-panel px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] token-text-muted">
                          Why the other answers are wrong
                        </div>
                        <div className="mt-3 space-y-3">
                          {currentExplanation.why_others_wrong.map((item) => (
                            <div key={item.option} className="rounded-2xl bg-[var(--color-surface)] px-3 py-3">
                              <div className="font-semibold token-text-primary">
                                {item.option}. {item.text}
                              </div>
                              <div className="mt-1 token-text-secondary">{item.reason}</div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    <section className="surface-soft-panel px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] token-text-muted">
                        Thinking tip
                      </div>
                      <div className="mt-2">{currentExplanation.thinking_tip}</div>
                    </section>
                  </>
                ) : (
                  <div className="rounded-[1.35rem] border border-rose-200 bg-rose-50 px-4 py-4 text-rose-800">
                    {currentExplanationError || "Explanation unavailable right now."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {quizPhase === "quiz" ? (
        <div className="space-y-4">
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-3 text-sm font-medium token-text-secondary">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tracking-[-0.01em]">{`Question ${index + 1} of ${questions.length}`}</span>
                {activeComboCount >= 2 ? (
                  <span
                    className="combo-chip"
                    data-active={
                      submitted &&
                      isCorrect &&
                      floatingReward &&
                      floatingReward.comboCount === activeComboCount
                        ? "true"
                        : "false"
                    }
                  >
                    <span>{`🔥 Combo x${activeComboCount}`}</span>
                    {activeComboBonus > 0 ? (
                      <span className="text-current/75">{`+${activeComboBonus}% XP`}</span>
                    ) : null}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPassageHighlightText(null);
                  setShowPassage(true);
                }}
                className="secondary-button min-h-11 px-4 text-sm"
              >
                See Passage
              </button>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(
                    100,
                    ((submitted ? index + 2 : index + 1) / Math.max(questions.length, 1)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5 px-1">
            <div className="drill-question">
              <InlineVocabularyCaptureText
                as="div"
                studentId={studentId}
                lessonId={lessonId}
                passageId={passageId}
                text={question.question_text}
                sourceType="question"
                sourceText={question.question_text}
                knownWords={knownWords}
                onCaptured={onVocabularyCaptured}
                className="select-text"
              />
            </div>
          </div>

          <div className="grid gap-3">
            {options.map((option) => {
              const isPicked = selected === option.key;
              const showCorrect =
                submitted && isCorrect === true && question.correct_option === option.key;
              const showWrong = submitted && isPicked && question.correct_option !== option.key;
              const optionState = showCorrect
                ? "correct"
                : showWrong
                  ? "incorrect"
                  : isPicked
                    ? "selected"
                    : "idle";

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    if (submitted) {
                      return;
                    }
                    setSelected(option.key);
                  }}
                  data-state={optionState}
                  className="drill-option relative min-h-16 overflow-visible"
                >
                  {submitted && isPicked && floatingReward && floatingReward.xp > 0 ? (
                    <div className="drill-option-reward reward-float reward-float--inline">
                      <span>{`+${floatingReward.xp} XP`}</span>
                      {floatingReward.comboCount >= 3 ? (
                        <span className="drill-option-reward__combo">{`🔥 x${floatingReward.comboCount}`}</span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex items-start gap-3">
                    <div className="drill-option-indicator mt-0.5">
                      {option.key}
                    </div>
                    <div className="flex-1 text-[0.98rem] leading-6 text-inherit sm:text-[1.02rem] sm:leading-7">
                          <InlineVocabularyCaptureText
                            as="div"
                            studentId={studentId}
                            lessonId={lessonId}
                            passageId={passageId}
                            text={option.text}
                            sourceType="answer"
                            sourceText={`${question.question_text} ${option.text}`}
                            knownWords={knownWords}
                            onCaptured={onVocabularyCaptured}
                            className="select-text"
                          />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {submitted && quizFeedbackToneClass && quizFeedbackTitle && quizFeedbackHint ? (
            <div
              aria-live="polite"
              className={`rounded-[1.5rem] border px-4 py-4 shadow-sm ${quizFeedbackToneClass}`}
            >
              <div className="flex items-start gap-3">
                <MascotCat
                  mood={isCorrect ? (hasQuizHotStreak ? "celebrate" : "correct") : "incorrect"}
                  size="sm"
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-current">{quizFeedbackTitle}</div>
                      <div className="text-xs text-current/75">
                        {isCorrect ? "Correct answer locked in." : "The passage wanted a tighter read."}
                      </div>
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-current/70">
                      {isCorrect ? "Correct" : "Incorrect"}
                    </div>
                  </div>

                  <div className="text-sm leading-5 text-current/80">{quizFeedbackHint}</div>

                  {isCorrect && activeComboCount >= 2 ? (
                    <div
                      className="combo-chip inline-flex"
                      data-active={
                        floatingReward && floatingReward.comboCount === activeComboCount
                          ? "true"
                          : "false"
                      }
                    >
                      <span>{`🔥 Combo x${activeComboCount}`}</span>
                      {activeComboBonus > 0 ? (
                        <span className="text-current/75">{`+${activeComboBonus}% XP`}</span>
                      ) : null}
                    </div>
                  ) : null}

                  {!isCorrect && selectedText ? (
                    <div className="rounded-[1.1rem] border border-current/12 bg-[var(--color-surface)]/70 px-3 py-3 text-sm leading-5 token-text-secondary">
                      <span className="font-semibold token-text-primary">Your answer:</span> {selectedText}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {quizPhase === "results" ? (
        <div className="mx-auto flex min-h-[calc(100svh-12rem)] w-full max-w-xl flex-col justify-center gap-6 text-center">
          <div className="app-hero-panel p-5 text-left sm:p-6">
            <div className="flex items-start gap-4">
              <MascotCat
                mood={mistakeItems.length === 0 ? "celebrate" : correctCount >= Math.ceil(questions.length * 0.7) ? "correct" : "incorrect"}
                size="md"
                className="shrink-0 bg-white/10"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="app-kicker token-text-inverse-muted">Quiz Complete</div>
                <h2 className="text-[1.7rem] font-semibold tracking-[-0.03em] token-text-inverse sm:text-[1.9rem]">
                  {quizCompleteHeading}
                </h2>
                <p className="text-sm leading-5 token-text-inverse-muted">
                  {quizCompleteCopy}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="app-card p-4 text-left">
              <div className="app-kicker token-text-muted">Score</div>
              <div className="mt-2 text-3xl font-semibold tracking-[-0.03em] token-text-primary">
                {correctCount}/{questions.length}
              </div>
              <div className="mt-1 text-sm token-text-muted">
                {Math.round((correctCount / Math.max(questions.length, 1)) * 100)}% correct
              </div>
            </div>
            <div className="app-card p-4 text-left">
              <div className="app-kicker token-text-muted">XP</div>
              <div className="mt-2 text-3xl font-semibold tracking-[-0.03em] token-text-primary">+{sessionXpEarned}</div>
              <div className="mt-1 text-sm token-text-muted">Quiz finished</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="app-card-soft p-4 text-left">
              <div className="app-kicker token-text-muted">Max combo</div>
              <div className="mt-2 text-2xl font-semibold token-text-primary">
                {maxCombo > 0 ? `x${maxCombo}` : "x0"}
              </div>
            </div>
            <div className="app-card-soft p-4 text-left">
              <div className="app-kicker token-text-muted">Streak</div>
              <div className="mt-2 text-2xl font-semibold token-text-primary">
                {levelProgress.streakDays ?? 0}
              </div>
            </div>
          </div>

          {levelProgress.leveledUp ? (
            <div className="rounded-[1.5rem] border border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] px-4 py-4 text-left">
              <div className="text-sm font-semibold token-text-primary">Level up</div>
              <div className="mt-1 text-sm leading-6 token-text-secondary">
                You reached level {levelProgress.currentLevel ?? levelProgress.previousLevel ?? 1}.
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void completeLesson(continueReadingHref)}
              disabled={saving}
              className="primary-button min-h-14 w-full"
            >
              {saving ? "Saving..." : "Continue Reading"}
            </button>
            <button
              type="button"
              onClick={() => void completeLesson(startWordPracticeHref)}
              disabled={saving}
              className="secondary-button min-h-14 w-full"
            >
              {saving ? "Saving..." : "Start Word Practice"}
            </button>
            <button
              type="button"
              onClick={() => void completeLesson(studentDashboardPath())}
              disabled={saving}
              className="secondary-button min-h-14 w-full"
            >
              {saving ? "Saving..." : "Return to Dashboard"}
            </button>
            <div className="flex justify-center">
              <FeedbackSettingsButton label="Feedback settings" />
            </div>
          </div>
        </div>
      ) : null}
      {quizPhase === "quiz_words" ? (
        <VocabularyReviewCards
          items={quizVocabularyItems}
          isHydrating={isQuizVocabularyHydrating}
          onVisibleItemsChange={onQuizVocabularyVisibleItemsChange}
          onRequestAudio={onRequestQuizVocabularyAudio}
          isAudioLoading={isQuizVocabularyAudioLoading}
          title="Words Picked Up from Quiz"
          emptyTitle="No quiz words this time"
          emptyCopy="Continue to repair, or finish the lesson if there are no mistakes to fix."
          continueLabel={mistakeItems.length > 0 ? "Continue to Quiz Repair" : "Finish Lesson"}
          onDone={continueAfterQuizWords}
        />
      ) : null}
      {quizPhase === "repair" && activeRepairItem ? (
        <div className="space-y-4">
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-3 text-sm font-medium token-text-secondary">
              <div className="flex flex-wrap items-center gap-2">
                <span>{`Fix ${repairIndex + 1} of ${mistakeItems.length}`}</span>
                {comboCount >= 2 ? (
                  <span className="combo-chip">
                    <span>{`🔥 Combo x${comboCount}`}</span>
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPassageHighlightText(activeRepairItem.relevantSentence);
                  setShowPassage(true);
                }}
                className="secondary-button min-h-11 px-4 text-sm"
              >
                See Passage
              </button>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${repairProgressPercent}%` }}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="app-chip app-chip-secondary">
              {activeRepairItem.microTask.strategyLabel}
            </div>
            <div className="drill-question">{activeRepairItem.microTask.prompt}</div>
            {activeRepairItem.microTask.supportText ? (
              <div className="drill-context-surface">
                <div className="drill-context-inline">
                  {activeRepairItem.microTask.supportText}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3">
            {activeRepairItem.microTask.options.map((option) => {
              const isPicked = repairChoice === option.key;
              const showCorrect =
                repairFeedback?.status === "correct" &&
                activeRepairItem.microTask.correctOption === option.key;
              const showWrong =
                repairFeedback?.status === "incorrect" && isPicked;
              const optionState = showCorrect
                ? "correct"
                : showWrong
                  ? "incorrect"
                  : isPicked
                    ? "selected"
                    : "idle";

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => selectRepairChoice(option.key)}
                  data-state={optionState}
                  className="drill-option relative min-h-16 overflow-visible"
                >
                  {repairFeedback?.status === "correct" && isPicked && floatingReward && floatingReward.xp > 0 ? (
                    <div className="drill-option-reward reward-float reward-float--inline">
                      <span>{`+${floatingReward.xp} XP`}</span>
                      {floatingReward.comboCount >= 3 ? (
                        <span className="drill-option-reward__combo">{`🔥 x${floatingReward.comboCount}`}</span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex items-start gap-3">
                    <div className="drill-option-indicator mt-0.5">{option.key}</div>
                    <div className="flex-1 text-left text-[0.98rem] leading-6 text-inherit sm:text-[1.02rem] sm:leading-7">
                      <InlineVocabularyCaptureText
                        as="div"
                        studentId={studentId}
                        lessonId={lessonId}
                        passageId={passageId}
                        text={option.text}
                        sourceType="answer"
                        sourceText={`${activeRepairItem.microTask.prompt} ${option.text}`}
                        knownWords={knownWords}
                        onCaptured={onVocabularyCaptured}
                        className="select-text"
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {repairFeedback ? (
            <div
              className={
                repairFeedback.status === "correct"
                  ? "repair-feedback-card repair-feedback-card--correct"
                  : "repair-feedback-card repair-feedback-card--incorrect"
              }
            >
              <div className="flex items-start gap-3">
                <MascotCat
                  mood={repairFeedback.status === "correct" ? "correct" : "incorrect"}
                  size="sm"
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold token-text-primary">
                    {repairFeedback.status === "correct" ? "Fixed" : "Try again"}
                  </div>
                  <div className="mt-1 text-sm leading-5 token-text-secondary">
                    {repairFeedback.message}
                  </div>
                  {repairFeedback.status === "correct" ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {floatingReward && floatingReward.xp > 0 ? (
                        <span className="repair-status-chip repair-status-chip--correct">
                          {`+${floatingReward.xp} XP`}
                        </span>
                      ) : null}
                      {comboCount >= 2 ? (
                        <span
                          className="combo-chip"
                          data-active={
                            floatingReward && floatingReward.comboCount === comboCount
                              ? "true"
                              : "false"
                          }
                        >
                          <span>{`🔥 Combo x${comboCount}`}</span>
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 repair-status-chip repair-status-chip--hint">
                      Hint active
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="fixed-action-bar">
            <div className="fixed-action-bar__inner flex items-center gap-3">
              <button
                type="button"
                onClick={() => void openExplanation(activeRepairItem.question)}
                className="secondary-button min-h-14 px-5"
              >
                Explain
              </button>
              {repairFeedback?.status === "correct" ? (
                <button
                  type="button"
                  onClick={continueRepair}
                  className="primary-button min-h-14 flex-1"
                >
                  {repairIndex >= mistakeItems.length - 1 ? "Finish Repair" : "Next Mistake"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitRepairChoice}
                  disabled={!repairChoice}
                  className="primary-button min-h-14 flex-1"
                >
                  {repairFeedback?.status === "incorrect" ? "Try Again" : "Continue"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {quizPhase === "repair_complete" ? (
        <div className="mx-auto flex min-h-[calc(100svh-12rem)] w-full max-w-xl flex-col justify-center gap-6 text-center">
          <div className="app-hero-panel p-5 text-left sm:p-6">
            <div className="flex items-start gap-4">
              <MascotCat mood="celebrate" size="md" className="shrink-0 bg-white/10" />
              <div className="min-w-0 space-y-2">
                  <div className="app-kicker token-text-inverse-muted">Quiz Complete</div>
                <h2 className="text-[1.7rem] font-semibold tracking-[-0.03em] token-text-inverse sm:text-[1.9rem]">
                  {quizCompleteHeading}
                </h2>
                <p className="text-sm leading-5 token-text-inverse-muted">
                  {quizCompleteCopy}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="app-card-soft p-4">
              <div className="app-kicker token-text-muted">XP earned</div>
              <div className="mt-2 text-3xl font-semibold token-text-primary">+{sessionXpEarned}</div>
            </div>
            <div className="app-card-soft p-4">
              <div className="app-kicker token-text-muted">Max combo</div>
              <div className="mt-2 text-3xl font-semibold token-text-primary">
                {maxCombo > 0 ? `x${maxCombo}` : "x0"}
              </div>
            </div>
          </div>

          {levelProgress.leveledUp ? (
            <div className="rounded-[1.5rem] border border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] px-4 py-4 text-left">
              <div className="text-sm font-semibold token-text-primary">Level up</div>
              <div className="mt-1 text-sm leading-6 token-text-secondary">
                You reached level {levelProgress.currentLevel ?? levelProgress.previousLevel ?? 1}.
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void completeLesson(continueReadingHref)}
              disabled={saving}
              className="primary-button min-h-14 w-full"
            >
              {saving ? "Saving..." : "Continue Reading"}
            </button>
            <button
              type="button"
              onClick={() => void completeLesson(startWordPracticeHref)}
              disabled={saving}
              className="secondary-button min-h-14 w-full"
            >
              {saving ? "Saving..." : "Start Word Practice"}
            </button>
            <button
              type="button"
              onClick={() => void completeLesson(studentDashboardPath())}
              disabled={saving}
              className="secondary-button min-h-14 w-full"
            >
              {saving ? "Saving..." : "Return to Dashboard"}
            </button>
          </div>
          <div className="flex justify-center">
            <FeedbackSettingsButton label="Feedback settings" />
          </div>
        </div>
      ) : null}

      {quizPhase === "quiz" ? (
        <div className="fixed-action-bar">
          <div className="fixed-action-bar__inner flex items-center gap-3">
            {submitted ? (
              <button
                type="button"
                onClick={() => void openExplanation(question)}
                className="secondary-button min-h-14 px-5"
              >
                Why?
              </button>
            ) : null}
            <button
              type="button"
              onClick={submitted ? () => void continueQuiz() : submitAnswer}
              disabled={submitted ? saving || !quizContinueReady : !selected || saving}
              className={quizPrimaryButtonClass}
            >
              {saving
                ? "Saving..."
                : submitted
                  ? index >= questions.length - 1
                    ? finalQuizActionLabel
                    : "Continue"
                  : "Submit"}
            </button>
          </div>
        </div>
      ) : null}

      {floatingReward && quizPhase !== "quiz" ? (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4 sm:top-24">
          <div key={floatingReward.id} className="reward-float rounded-full border border-emerald-200 bg-[var(--color-surface)]/96 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-[var(--shadow-button)] backdrop-blur">
            <span>{`+${floatingReward.xp} XP`}</span>
            {floatingReward.comboCount >= 3 ? (
              <span className="ml-2 token-text-muted">{`Combo x${floatingReward.comboCount}`}</span>
            ) : null}
            {floatingReward.leveledUp ? (
              <span className="ml-2 text-[var(--color-secondary)]">Level up</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
