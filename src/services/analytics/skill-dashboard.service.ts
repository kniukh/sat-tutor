import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getStudentSkillDashboard(studentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("skill_mastery")
    .select("*")
    .eq("student_id", studentId)
    .order("accuracy", { ascending: true });

  if (error) {
    console.error("getStudentSkillDashboard error", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getAllStudentsSkillDashboard() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("skill_mastery")
    .select(`
      id,
      student_id,
      skill,
      attempts_count,
      correct_count,
      accuracy,
      updated_at,
      students (
        id,
        full_name,
        access_code
      )
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("getAllStudentsSkillDashboard error", error);
    throw new Error(error.message);
  }

  return data ?? [];
}