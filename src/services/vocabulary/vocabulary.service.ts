import { createServerSupabaseClient } from '@/lib/supabase/server';
import { resolveVocabularyLemma } from "@/services/vocabulary/vocabulary-normalization.service";

type UpdateWordProgressInput = {
  studentId: string;
  lessonId: string;
  weakWords: string[];
};

function getNextReviewDate(daysToAdd: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

export async function updateWordProgress(input: UpdateWordProgressInput) {
  const supabase = await createServerSupabaseClient();

  const uniqueWords = Array.from(
    new Set(
      input.weakWords.map((word) => resolveVocabularyLemma({ itemText: word, itemType: "word" }).canonicalLemma).filter(Boolean),
    ),
  );

  for (const canonicalLemma of uniqueWords) {
    const { data: existing, error: existingError } = await supabase
      .from('word_progress')
      .select('*')
      .eq('student_id', input.studentId)
      .eq('canonical_lemma', canonicalLemma)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existing) {
      const { error: insertError } = await supabase
        .from('word_progress')
        .insert({
          student_id: input.studentId,
          word: canonicalLemma,
          canonical_lemma: canonicalLemma,
          status: 'learning',
          times_seen: 1,
          times_correct: 0,
          times_wrong: 1,
          next_review_date: getNextReviewDate(1),
          source_lesson_id: input.lessonId,
          metadata: {},
        });

      if (insertError) {
        throw insertError;
      }

      continue;
    }

    const timesSeen = Number(existing.times_seen ?? 0) + 1;
    const timesWrong = Number(existing.times_wrong ?? 0) + 1;

    let status = existing.status ?? 'learning';
    if (status === 'mastered') {
      status = 'review';
    }

    const { error: updateError } = await supabase
      .from('word_progress')
      .update({
        status,
        canonical_lemma: canonicalLemma,
        times_seen: timesSeen,
        times_wrong: timesWrong,
        next_review_date: getNextReviewDate(1),
        source_lesson_id: input.lessonId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) {
      throw updateError;
    }
  }
}
