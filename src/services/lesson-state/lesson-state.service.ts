import { createClient } from "@/lib/supabase/server";

export type LessonStage =
  | "first_read"
  | "vocab_review"
  | "second_read"
  | "questions"
  | "completed";

export type StudentAnswer = {
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D" | null;
  skill?: string | null;
  answeredAt: string;
};

export async function getOrCreateLessonState(studentId: string, lessonId: string) {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("student_lesson_state")
    .select("*")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("student_lesson_state")
    .insert({
      student_id: studentId,
      lesson_id: lessonId,
      stage: "first_read",
      vocab_submitted: false,
      second_read_done: false,
      question_answers_json: {},
      current_question_index: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOrCreateStudentLessonState(studentId: string, lessonId: string) {
  return getOrCreateLessonState(studentId, lessonId);
}

export async function submitVocabulary(studentId: string, lessonId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("student_lesson_state")
    .update({
      vocab_submitted: true,
      stage: "vocab_review",
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markSecondReadDone(studentId: string, lessonId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("student_lesson_state")
    .update({
      second_read_done: true,
      stage: "questions",
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveQuestionProgress(params: {
  studentId: string;
  lessonId: string;
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D";
  skill?: string;
}) {
  const supabase = await createClient();

  const state = await getOrCreateLessonState(params.studentId, params.lessonId);
  const answers = (state.question_answers_json ?? {}) as Record<string, StudentAnswer>;

  answers[params.questionId] = {
    questionId: params.questionId,
    selectedOption: params.selectedOption,
    skill: params.skill ?? null,
    answeredAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("student_lesson_state")
    .update({
      question_answers_json: answers,
      current_question_index: Object.keys(answers).length,
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStudentLessonStage(params: {
  studentId: string;
  lessonId: string;
  stage: LessonStage;
  vocabSubmitted?: boolean;
  secondReadDone?: boolean;
}) {
  const supabase = await createClient();

  await getOrCreateLessonState(params.studentId, params.lessonId);

  const updatePayload: {
    stage: LessonStage;
    updated_at: string;
    vocab_submitted?: boolean;
    second_read_done?: boolean;
  } = {
    stage: params.stage,
    updated_at: new Date().toISOString(),
  };

  if (typeof params.vocabSubmitted === "boolean") {
    updatePayload.vocab_submitted = params.vocabSubmitted;
  }

  if (typeof params.secondReadDone === "boolean") {
    updatePayload.second_read_done = params.secondReadDone;
  }

  const { data, error } = await supabase
    .from("student_lesson_state")
    .update(updatePayload)
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
