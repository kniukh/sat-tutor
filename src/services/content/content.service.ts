import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getPublishedLessons() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("lessons")
    .select(`
      *,
      lesson_passages (*),
      question_bank (
        id,
        lesson_id,
        question_type,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        explanation,
        difficulty,
        display_order,
        review_status,
        generation_source,
        generation_version,
        created_at
      ),
      lesson_writing_prompts (*)
    `)
    .eq("is_active", true)
    .eq("status", "published")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("getPublishedLessons error", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getPublishedLessonById(lessonId: string) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("lessons")
    .select(`
      *,
      lesson_passages (*),
      question_bank (
        id,
        lesson_id,
        question_type,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        explanation,
        difficulty,
        display_order,
        review_status,
        generation_source,
        generation_version,
        created_at
      ),
      lesson_writing_prompts (*)
    `)
    .eq("id", lessonId)
    .eq("is_active", true)
    .eq("status", "published")
    .single();

  if (error) {
    console.error("getPublishedLessonById error", error);
    throw new Error(error.message);
  }

  return data;
}

// Backward-compatible alias used by legacy test pages.
export async function getContentTree() {
  return getPublishedLessons();
}
