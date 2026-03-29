import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  analyzeLessonMistakes,
  type MistakeAnalysisInput,
} from "@/services/ai/analyze-lesson-mistakes";

type LessonAttemptAnswer = {
  questionId: string;
  selectedOption: string | null;
  correctOption: string | null;
  isCorrect: boolean;
  skill?: string | null;
};

type QuestionRow = {
  id: string;
  question_type: string | null;
  question_text: string;
  correct_option: string | null;
  explanation: string | null;
};

type LessonPassageRow = {
  passage_text: string | null;
  display_order: number | null;
};

type QuestionAttemptRow = {
  question_id: string;
  duration_sec: number | null;
  answered_at: string | null;
};

export async function runMistakeBrainForLesson(params: {
  studentId: string;
  lessonId: string;
}) {
  const supabase = await createServerSupabaseClient();

  const { data: latestAttempt, error: attemptError } = await supabase
    .from("lesson_attempts")
    .select("id, answers_json, completed_at")
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; answers_json: LessonAttemptAnswer[] | null; completed_at: string | null }>();

  if (attemptError) {
    throw attemptError;
  }

  if (!latestAttempt) {
    return [];
  }

  const answers = Array.isArray(latestAttempt.answers_json)
    ? latestAttempt.answers_json
    : [];

  const wrongAnswers = answers.filter(
    (answer) => answer.questionId && answer.selectedOption && !answer.isCorrect
  );

  if (wrongAnswers.length === 0) {
    await supabase
      .from("mistake_analysis")
      .delete()
      .eq("student_id", params.studentId)
      .eq("lesson_id", params.lessonId);

    return [];
  }

  const questionIds = wrongAnswers.map((answer) => answer.questionId);

  const [{ data: questions, error: questionsError }, { data: passages, error: passagesError }] =
    await Promise.all([
      supabase
        .from("question_bank")
        .select("id, question_type, question_text, correct_option, explanation")
        .in("id", questionIds)
        .returns<QuestionRow[]>(),
      supabase
        .from("lesson_passages")
        .select("passage_text, display_order")
        .eq("lesson_id", params.lessonId)
        .order("display_order", { ascending: true })
        .returns<LessonPassageRow[]>(),
    ]);

  if (questionsError) {
    throw questionsError;
  }

  if (passagesError) {
    throw passagesError;
  }

  const { data: questionAttempts, error: questionAttemptsError } = await supabase
    .from("question_attempts")
    .select("question_id, duration_sec, answered_at")
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId)
    .in("question_id", questionIds)
    .order("answered_at", { ascending: false })
    .returns<QuestionAttemptRow[]>();

  if (questionAttemptsError) {
    throw questionAttemptsError;
  }

  const questionMap = new Map((questions ?? []).map((question) => [question.id, question]));
  const latestQuestionAttemptMap = new Map<string, QuestionAttemptRow>();

  for (const item of questionAttempts ?? []) {
    if (!latestQuestionAttemptMap.has(item.question_id)) {
      latestQuestionAttemptMap.set(item.question_id, item);
    }
  }

  const passageText = (passages ?? [])
    .map((passage) => passage.passage_text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");

  const payload: MistakeAnalysisInput[] = wrongAnswers
    .map((answer) => {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        return null;
      }

      const latestQuestionAttempt = latestQuestionAttemptMap.get(answer.questionId);

      return {
        question_id: answer.questionId,
        question_type: question.question_type,
        question_text: question.question_text,
        selected_option: answer.selectedOption,
        correct_option: question.correct_option ?? answer.correctOption,
        explanation: question.explanation,
        passage_text: passageText,
        time_spent_ms: latestQuestionAttempt?.duration_sec
          ? latestQuestionAttempt.duration_sec * 1000
          : null,
      };
    })
    .filter((item): item is MistakeAnalysisInput => Boolean(item));

  if (payload.length === 0) {
    return [];
  }

  const analysis = await analyzeLessonMistakes({
    wrongAnswers: payload,
  });

  await supabase
    .from("mistake_analysis")
    .delete()
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId);

  const rows = analysis.map((item) => {
    const question = questionMap.get(item.question_id);

    return {
      student_id: params.studentId,
      lesson_id: params.lessonId,
      question_id: item.question_id,
      question_type: question?.question_type ?? null,
      mistake_type: item.mistake_type,
      confidence: item.confidence,
      short_reason: item.short_reason,
      coaching_tip: item.coaching_tip,
    };
  });

  const { data, error } = await supabase
    .from("mistake_analysis")
    .insert(rows)
    .select();

  if (error) {
    throw error;
  }

  return data ?? [];
}
