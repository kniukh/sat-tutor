import { createClient } from "@/lib/supabase/server";

type EvaluatedAnswer = {
  questionId: string;
  selectedOption: string | null;
  correctOption: string;
  isCorrect: boolean;
  skill: string;
};

export async function updateSkillTrackingForAttempt(
  studentId: string,
  answers: EvaluatedAnswer[]
) {
  const supabase = await createClient();

  const grouped: Record<string, { total: number; correct: number }> = {};

  for (const answer of answers) {
    if (!grouped[answer.skill]) {
      grouped[answer.skill] = { total: 0, correct: 0 };
    }

    grouped[answer.skill].total += 1;
    if (answer.isCorrect) grouped[answer.skill].correct += 1;
  }

  for (const [skill, delta] of Object.entries(grouped)) {
    const { data: existing, error: existingError } = await supabase
      .from("skill_mastery")
      .select("*")
      .eq("student_id", studentId)
      .eq("skill", skill)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      const { error: insertError } = await supabase.from("skill_mastery").insert({
        student_id: studentId,
        skill,
        attempts_count: delta.total,
        correct_count: delta.correct,
        accuracy: delta.total ? delta.correct / delta.total : 0,
      });

      if (insertError) throw insertError;
      continue;
    }

    const attempts_count = existing.attempts_count + delta.total;
    const correct_count = existing.correct_count + delta.correct;
    const accuracy = attempts_count ? correct_count / attempts_count : 0;

    const { error: updateError } = await supabase
      .from("skill_mastery")
      .update({
        attempts_count,
        correct_count,
        accuracy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) throw updateError;
  }
}
