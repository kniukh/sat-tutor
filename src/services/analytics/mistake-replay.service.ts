import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseVocabularyDrillAnswerSets } from "@/services/vocabulary/drill-answer-sets.service";
import type { SupportedVocabExerciseType } from "@/types/vocab-exercises";

type ReplayOptionKey = "A" | "B" | "C" | "D";

type ReplayOption = {
  key: ReplayOptionKey;
  text: string;
};

type ReadingQuestionRow = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: ReplayOptionKey | null;
  explanation: string | null;
  question_type: string | null;
};

type QuestionAttemptRow = {
  id: string;
  lesson_id: string;
  question_id: string;
  selected_option: string;
  is_correct: boolean;
  answered_at: string;
};

type ExerciseAttemptRow = {
  id: string;
  lesson_id: string | null;
  exercise_type: SupportedVocabExerciseType;
  target_word_id: string | null;
  target_word: string | null;
  user_answer: Record<string, unknown> | unknown[] | null;
  correct_answer: Record<string, unknown> | unknown[] | null;
  modality: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  response_time_ms: number | null;
};

type VocabularyDetailRow = {
  id: string;
  item_text: string;
  english_explanation: string | null;
  translated_explanation: string | null;
  context_sentence: string | null;
  example_text: string | null;
  translation_language: string | null;
  drill_answer_sets: Record<string, unknown> | null;
};

type WordProgressLiteRow = {
  id: string;
  word_id: string | null;
  word: string;
  lifecycle_state: string;
  mastery_score: number | null;
  consecutive_incorrect: number | null;
  source_lesson_id: string | null;
};

export type MistakeReplayReadingItem = {
  id: string;
  kind: "reading";
  patternLabel: string;
  priorityScore: number;
  lessonId: string;
  lessonName: string | null;
  snapshot: {
    questionText: string;
    selectedOptionKey: string | null;
    selectedOptionText: string | null;
    correctOptionKey: ReplayOptionKey;
    correctOptionText: string;
  };
  retry: {
    questionId: string;
    questionType: string | null;
    questionText: string;
    options: ReplayOption[];
    correctOption: ReplayOptionKey;
    passageText: string;
  };
  explanationSeed: string | null;
};

export type MistakeReplayVocabularyItem = {
  id: string;
  kind: "vocabulary";
  patternLabel: string;
  priorityScore: number;
  lessonId: string | null;
  lessonName: string | null;
  snapshot: {
    word: string;
    exerciseType: SupportedVocabExerciseType;
    selectedAnswer: string | null;
    correctAnswer: string;
    contextText: string | null;
  };
  explanation: {
    correctAnswer: string;
    whyCorrect: string;
    whyWrong: string;
    thinkingTip: string;
  };
  retry: {
    exerciseType: "meaning_match" | "translation_match";
    exerciseId: string;
    sessionId: string;
    questionText: string;
    prompt: string;
    options: ReplayOption[];
    correctOption: ReplayOptionKey;
    correctAnswerLabel: string;
    targetWord: string;
    targetWordId: string | null;
    wordProgressId: string | null;
    lessonId: string | null;
    lifecycleState: string | null;
    consecutiveIncorrect: number;
    masteryScore: number | null;
  };
};

export type MistakeReplayItem = MistakeReplayReadingItem | MistakeReplayVocabularyItem;

export type MistakeReplaySessionData = {
  student: {
    id: string;
    fullName: string;
    accessCode: string;
  };
  session: {
    id: string;
    itemCount: number;
    readingCount: number;
    vocabularyCount: number;
    availablePatterns: string[];
  };
  items: MistakeReplayItem[];
};

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "").replace(/_/g, " ").trim();
}

function readAnswerValue(value: Record<string, unknown> | unknown[] | null | undefined) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(" ");
  }

  const rawValue = value.value;
  return typeof rawValue === "string" ? rawValue : null;
}

function buildReadingOptions(question: ReadingQuestionRow): ReplayOption[] {
  return [
    { key: "A", text: question.option_a },
    { key: "B", text: question.option_b },
    { key: "C", text: question.option_c },
    { key: "D", text: question.option_d },
  ];
}

function stableShuffle(values: string[], seed: string) {
  const items = [...values];
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  for (let index = items.length - 1; index > 0; index -= 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const swapIndex = hash % (index + 1);
    const next = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = next;
  }

  return items;
}

function toReplayOptions(values: string[], correctAnswer: string): { options: ReplayOption[]; correctKey: ReplayOptionKey } {
  const labels: ReplayOptionKey[] = ["A", "B", "C", "D"];
  const options = values.slice(0, 4).map((text, index) => ({
    key: labels[index],
    text,
  }));
  const correct = options.find((item) => item.text === correctAnswer)?.key ?? "A";

  return {
    options,
    correctKey: correct,
  };
}

function getQuestionTypeWeakSet(attempts: QuestionAttemptRow[], questions: Map<string, ReadingQuestionRow>) {
  const grouped = new Map<string, { attempts: number; correct: number }>();

  for (const attempt of attempts) {
    const type = questions.get(attempt.question_id)?.question_type ?? "reading";
    const current = grouped.get(type) ?? { attempts: 0, correct: 0 };
    current.attempts += 1;
    if (attempt.is_correct) {
      current.correct += 1;
    }
    grouped.set(type, current);
  }

  return new Set(
    Array.from(grouped.entries())
      .map(([type, stats]) => ({
        type,
        accuracy: stats.attempts > 0 ? stats.correct / stats.attempts : 1,
        attempts: stats.attempts,
      }))
      .filter((item) => item.attempts >= 2)
      .sort((left, right) => left.accuracy - right.accuracy)
      .slice(0, 3)
      .map((item) => item.type)
  );
}

function getReplayVocabularyPromptType(exerciseType: SupportedVocabExerciseType) {
  if (exerciseType === "translation_match") {
    return "translation_match" as const;
  }

  return "meaning_match" as const;
}

function buildVocabularyExplanation(params: {
  word: string;
  correctAnswer: string;
  selectedAnswer: string | null;
  exerciseType: SupportedVocabExerciseType;
  contextText: string | null;
}) {
  const contextLead = params.contextText
    ? "In this context, "
    : "";

  return {
    correctAnswer: params.correctAnswer,
    whyCorrect: `${contextLead}"${params.word}" fits best as ${params.correctAnswer}.`,
    whyWrong: params.selectedAnswer
      ? `"${params.selectedAnswer}" does not match the meaning or usage needed here.`
      : "The original choice missed the meaning needed here.",
    thinkingTip:
      params.exerciseType === "translation_match"
        ? "Match the meaning first, then check which translation says the same thing most precisely."
        : "Use the sentence clue first, then choose the meaning that fits the context exactly.",
  };
}

export async function getMistakeReplaySessionData(code: string): Promise<MistakeReplaySessionData> {
  const supabase = await createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, full_name, access_code")
    .eq("access_code", code)
    .eq("is_active", true)
    .single();

  if (studentError || !student) {
    throw studentError ?? new Error("Student not found");
  }

  const [recentQuestionAttemptsResult, allQuestionAttemptsResult, recentExerciseAttemptsResult] =
    await Promise.all([
      supabase
        .from("question_attempts")
        .select("id, lesson_id, question_id, selected_option, is_correct, answered_at")
        .eq("student_id", student.id)
        .eq("is_correct", false)
        .order("answered_at", { ascending: false })
        .limit(24),
      supabase
        .from("question_attempts")
        .select("id, lesson_id, question_id, selected_option, is_correct, answered_at")
        .eq("student_id", student.id)
        .order("answered_at", { ascending: false })
        .limit(80),
      supabase
        .from("exercise_attempts")
        .select(
          "id, lesson_id, exercise_type, target_word_id, target_word, user_answer, correct_answer, modality, metadata, created_at, response_time_ms"
        )
        .eq("student_id", student.id)
        .eq("is_correct", false)
        .order("created_at", { ascending: false })
        .limit(24),
    ]);

  if (recentQuestionAttemptsResult.error) {
    throw recentQuestionAttemptsResult.error;
  }

  if (allQuestionAttemptsResult.error) {
    throw allQuestionAttemptsResult.error;
  }

  if (recentExerciseAttemptsResult.error) {
    throw recentExerciseAttemptsResult.error;
  }

  const recentQuestionAttempts = (recentQuestionAttemptsResult.data ?? []) as QuestionAttemptRow[];
  const allQuestionAttempts = (allQuestionAttemptsResult.data ?? []) as QuestionAttemptRow[];
  const recentExerciseAttempts = (recentExerciseAttemptsResult.data ?? []) as ExerciseAttemptRow[];

  const questionIds = Array.from(new Set(allQuestionAttempts.map((item) => item.question_id)));
  const lessonIds = Array.from(
    new Set(
      [
        ...recentQuestionAttempts.map((item) => item.lesson_id),
        ...recentExerciseAttempts.map((item) => item.lesson_id).filter(Boolean),
      ].filter(Boolean)
    )
  );
  const vocabTargetIds = Array.from(
    new Set(recentExerciseAttempts.map((item) => item.target_word_id).filter(Boolean))
  );
  const wordProgressIds = Array.from(
    new Set(
      recentExerciseAttempts
        .map((item) =>
          item.metadata && typeof item.metadata === "object"
            ? (item.metadata.word_progress_id as string | undefined)
            : undefined
        )
        .filter(Boolean)
    )
  );

  const [
    questionRowsResult,
    lessonRowsResult,
    passageRowsResult,
    vocabDetailsResult,
    wordProgressRowsResult,
  ] = await Promise.all([
    questionIds.length > 0
      ? supabase
          .from("question_bank")
          .select(
            "id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, question_type"
          )
          .in("id", questionIds)
      : Promise.resolve({ data: [], error: null }),
    lessonIds.length > 0
      ? supabase.from("lessons").select("id, name").in("id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
    lessonIds.length > 0
      ? supabase
          .from("lesson_passages")
          .select("lesson_id, passage_text")
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
    vocabTargetIds.length > 0
      ? supabase
          .from("vocabulary_item_details")
          .select(
            "id, item_text, english_explanation, translated_explanation, context_sentence, example_text, translation_language, drill_answer_sets"
          )
          .in("id", vocabTargetIds)
      : Promise.resolve({ data: [], error: null }),
    wordProgressIds.length > 0
      ? supabase
          .from("word_progress")
          .select("id, word_id, word, lifecycle_state, mastery_score, consecutive_incorrect, source_lesson_id")
          .in("id", wordProgressIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (questionRowsResult.error) {
    throw questionRowsResult.error;
  }

  if (lessonRowsResult.error) {
    throw lessonRowsResult.error;
  }

  if (passageRowsResult.error) {
    throw passageRowsResult.error;
  }

  if (vocabDetailsResult.error) {
    throw vocabDetailsResult.error;
  }

  if (wordProgressRowsResult.error) {
    throw wordProgressRowsResult.error;
  }

  const questionMap = new Map(
    ((questionRowsResult.data ?? []) as ReadingQuestionRow[]).map((row) => [row.id, row])
  );
  const weakQuestionTypes = getQuestionTypeWeakSet(allQuestionAttempts, questionMap);
  const lessonNameMap = new Map(
    ((lessonRowsResult.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name])
  );
  const passageMap = new Map<string, string>();
  for (const row of (passageRowsResult.data ?? []) as Array<{ lesson_id: string; passage_text: string }>) {
    if (!passageMap.has(row.lesson_id)) {
      passageMap.set(row.lesson_id, row.passage_text);
    }
  }

  const vocabDetailsMap = new Map(
    ((vocabDetailsResult.data ?? []) as VocabularyDetailRow[]).map((row) => [row.id, row])
  );
  const wordProgressMap = new Map(
    ((wordProgressRowsResult.data ?? []) as WordProgressLiteRow[]).map((row) => [row.id, row])
  );

  const repeatedQuestionCounts = recentQuestionAttempts.reduce((map, attempt) => {
    map.set(attempt.question_id, (map.get(attempt.question_id) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  const repeatedVocabCounts = recentExerciseAttempts.reduce((map, attempt) => {
    const key = attempt.target_word_id ?? attempt.target_word ?? attempt.id;
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  const readingCandidates: MistakeReplayReadingItem[] = recentQuestionAttempts
    .map((attempt, recentIndex) => {
      const question = questionMap.get(attempt.question_id);
      if (!question?.correct_option) {
        return null;
      }

      const options = buildReadingOptions(question);
      const selectedOptionText =
        options.find((option) => option.key === attempt.selected_option)?.text ?? null;
      const correctOptionText =
        options.find((option) => option.key === question.correct_option)?.text ?? null;
      const passageText = passageMap.get(attempt.lesson_id);

      if (!correctOptionText || !passageText) {
        return null;
      }

      const repeatedCount = repeatedQuestionCounts.get(attempt.question_id) ?? 1;
      const isHighValueType = ["main_idea", "inference", "tone", "vocabulary_in_context"].includes(
        question.question_type ?? ""
      );
      const priorityScore =
        100 -
        recentIndex * 4 +
        repeatedCount * 18 +
        (weakQuestionTypes.has(question.question_type ?? "reading") ? 24 : 0) +
        (isHighValueType ? 12 : 0);

      return {
        id: `reading:${attempt.id}`,
        kind: "reading",
        patternLabel: normalizeLabel(question.question_type || "reading"),
        priorityScore,
        lessonId: attempt.lesson_id,
        lessonName: lessonNameMap.get(attempt.lesson_id) ?? null,
        snapshot: {
          questionText: question.question_text,
          selectedOptionKey: attempt.selected_option ?? null,
          selectedOptionText,
          correctOptionKey: question.correct_option,
          correctOptionText,
        },
        retry: {
          questionId: question.id,
          questionType: question.question_type,
          questionText: question.question_text,
          options,
          correctOption: question.correct_option,
          passageText,
        },
        explanationSeed: question.explanation ?? null,
      } satisfies MistakeReplayReadingItem;
    })
    .filter((item): item is MistakeReplayReadingItem => Boolean(item))
    .filter((item, index, list) => list.findIndex((candidate) => candidate.retry.questionId === item.retry.questionId) === index)
    .sort((left, right) => right.priorityScore - left.priorityScore);

  const replaySessionId = `mistake-replay:${student.id}:${new Date().toISOString().slice(0, 10)}`;
  const vocabularyCandidates: MistakeReplayVocabularyItem[] = recentExerciseAttempts
    .map((attempt, recentIndex) => {
      const detail = attempt.target_word_id ? vocabDetailsMap.get(attempt.target_word_id) : null;
      const wordProgressId =
        attempt.metadata && typeof attempt.metadata === "object"
          ? ((attempt.metadata.word_progress_id as string | undefined) ?? null)
          : null;
      const progress = wordProgressId ? wordProgressMap.get(wordProgressId) : null;
      const answerSets = detail ? parseVocabularyDrillAnswerSets(detail.drill_answer_sets) : {};
      const meaningSet = answerSets.context_meaning ?? answerSets.synonym;
      const translationSet = answerSets.translation_english_to_native;
      const chosenSet = meaningSet ?? translationSet;

      if (!detail || !chosenSet) {
        return null;
      }

      const correctLabel = chosenSet.drill_correct_answer;
      const distractors = chosenSet.distractors.slice(0, 3);
      if (distractors.length < 2) {
        return null;
      }

      const optionValues = stableShuffle(
        [correctLabel, ...distractors].slice(0, 4),
        `${attempt.id}:${detail.id}`
      );
      const { options, correctKey } = toReplayOptions(optionValues, correctLabel);
      const selectedAnswer = readAnswerValue(attempt.user_answer);
      const repeatedCount = repeatedVocabCounts.get(attempt.target_word_id ?? attempt.target_word ?? attempt.id) ?? 1;
      const consecutiveIncorrect = Number(progress?.consecutive_incorrect ?? 0);
      const masteryScore = typeof progress?.mastery_score === "number" ? progress.mastery_score : null;
      const lifecycleState = progress?.lifecycle_state ?? null;
      const isHighValueType = ["context_meaning", "listen_match", "synonym", "translation_match"].includes(
        attempt.exercise_type
      );
      const priorityScore =
        100 -
        recentIndex * 4 +
        repeatedCount * 14 +
        consecutiveIncorrect * 9 +
        (lifecycleState === "weak_again" ? 26 : lifecycleState === "learning" ? 12 : 0) +
        ((typeof masteryScore === "number" ? 1 - masteryScore : 0.4) * 20) +
        (isHighValueType ? 10 : 0);
      const promptType = getReplayVocabularyPromptType(attempt.exercise_type);
      const questionText =
        promptType === "translation_match"
          ? `Which translation best matches "${detail.item_text}" here?`
          : `Which meaning best matches "${detail.item_text}" here?`;
      const contextText = detail.context_sentence ?? detail.example_text ?? null;

      return {
        id: `vocabulary:${attempt.id}`,
        kind: "vocabulary",
        patternLabel: normalizeLabel(attempt.exercise_type),
        priorityScore,
        lessonId: attempt.lesson_id ?? progress?.source_lesson_id ?? null,
        lessonName:
          lessonNameMap.get(attempt.lesson_id ?? progress?.source_lesson_id ?? "") ?? null,
        snapshot: {
          word: detail.item_text,
          exerciseType: attempt.exercise_type,
          selectedAnswer,
          correctAnswer: correctLabel,
          contextText,
        },
        explanation: buildVocabularyExplanation({
          word: detail.item_text,
          correctAnswer: correctLabel,
          selectedAnswer,
          exerciseType: attempt.exercise_type,
          contextText,
        }),
        retry: {
          exerciseType: promptType,
          exerciseId: `mistake-replay:${attempt.id}`,
          sessionId: replaySessionId,
          questionText,
          prompt:
            promptType === "translation_match"
              ? "Choose the best translation."
              : "Choose the best meaning.",
          options,
          correctOption: correctKey,
          correctAnswerLabel: correctLabel,
          targetWord: detail.item_text,
          targetWordId: detail.id,
          wordProgressId,
          lessonId: attempt.lesson_id,
          lifecycleState,
          consecutiveIncorrect,
          masteryScore,
        },
      } satisfies MistakeReplayVocabularyItem;
    })
    .filter((item): item is MistakeReplayVocabularyItem => Boolean(item))
    .filter((item, index, list) => list.findIndex((candidate) => candidate.retry.targetWordId === item.retry.targetWordId) === index)
    .sort((left, right) => right.priorityScore - left.priorityScore);

  const merged: MistakeReplayItem[] = [];
  if (readingCandidates[0]) {
    merged.push(readingCandidates[0]);
  }
  if (vocabularyCandidates[0]) {
    merged.push(vocabularyCandidates[0]);
  }

  for (const item of [...readingCandidates.slice(1), ...vocabularyCandidates.slice(1)].sort(
    (left, right) => right.priorityScore - left.priorityScore
  )) {
    if (merged.length >= 6) {
      break;
    }
    merged.push(item);
  }

  const finalItems = merged.slice(0, 8);

  return {
    student: {
      id: student.id,
      fullName: student.full_name,
      accessCode: student.access_code,
    },
    session: {
      id: replaySessionId,
      itemCount: finalItems.length,
      readingCount: finalItems.filter((item) => item.kind === "reading").length,
      vocabularyCount: finalItems.filter((item) => item.kind === "vocabulary").length,
      availablePatterns: Array.from(
        new Set(finalItems.map((item) => item.patternLabel).filter(Boolean))
      ),
    },
    items: finalItems,
  } satisfies MistakeReplaySessionData;
}
