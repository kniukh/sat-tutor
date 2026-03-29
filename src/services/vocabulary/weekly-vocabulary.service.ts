import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getWeeklyVocabularyForAllStudents() {
  const supabase = await createServerSupabaseClient();

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data, error } = await supabase
    .from("vocabulary_capture_events")
    .select(`
      id,
      item_text,
      item_type,
      created_at,
      lesson_id,
      student_id,
      students (
        id,
        full_name,
        access_code
      )
    `)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("weekly vocab error", error);
    throw new Error(error.message);
  }

  return data ?? [];
}