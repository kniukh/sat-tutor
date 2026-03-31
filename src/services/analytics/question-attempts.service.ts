import { createServerSupabaseClient } from "@/lib/supabase/server";
import { awardReadingQuestionXp } from "@/services/gamification/xp-awards.service";

export async function saveQuestionAttempt(params: {
  studentId: string;
  lessonId: string;
  questionId: string;
  selectedOption: string;
  durationSec: number;
}) {
  const supabase = await createServerSupabaseClient();

  const { data: question, error: questionError } = await supabase
    .from("question_bank")
    .select("id, correct_option, question_type")
    .eq("id", params.questionId)
    .single();

  if (questionError || !question) {
    throw questionError ?? new Error("Question not found");
  }

  const { data, error } = await supabase
    .from("question_attempts")
    .insert({
      student_id: params.studentId,
      lesson_id: params.lessonId,
      question_id: params.questionId,
      selected_option: params.selectedOption,
      is_correct: params.selectedOption === question.correct_option,
      duration_sec: params.durationSec,
      answered_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  const xpReward = await awardReadingQuestionXp({
    studentId: params.studentId,
    lessonId: params.lessonId,
    questionAttemptId: data.id,
    questionId: params.questionId,
    questionType: question.question_type ?? null,
    isCorrect: data.is_correct,
  });

  return {
    attempt: data,
    xpReward,
  };
}
