import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function saveLessonReadingMetrics(params: {
  studentId: string;
  lessonId: string;
  readingDurationSec: number;
  wordsCount: number;
  wordsPerMinute: number;
}) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("lesson_reading_metrics")
    .insert({
      student_id: params.studentId,
      lesson_id: params.lessonId,
      reading_duration_sec: params.readingDurationSec,
      words_count: params.wordsCount,
      words_per_minute: params.wordsPerMinute,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
