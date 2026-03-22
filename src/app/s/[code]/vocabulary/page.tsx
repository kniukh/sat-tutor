import PrepareVocabularyDrillsButton from '@/components/student/PrepareVocabularyDrillsButton';
import VocabularyDrillPlayer from '@/components/student/VocabularyDrillPlayer';
import ClozeDrillPlayer from '@/components/student/ClozeDrillPlayer';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function StudentVocabularyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('access_code', code)
    .eq('is_active', true)
    .single();

  if (studentError || !student) {
    throw new Error('Student not found');
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: wordProgress, error: wordProgressError } = await supabase
    .from('word_progress')
    .select('*')
    .eq('student_id', student.id)
    .lte('next_review_date', today)
    .order('next_review_date', { ascending: true });

  if (wordProgressError) {
    throw wordProgressError;
  }

  const itemTexts = (wordProgress ?? []).map((item) => item.word);

  const { data: vocabDetails, error: vocabDetailsError } = await supabase
    .from('vocabulary_item_details')
    .select('*')
    .eq('student_id', student.id)
    .in('item_text', itemTexts.length > 0 ? itemTexts : ['___none___']);

  if (vocabDetailsError) {
    throw vocabDetailsError;
  }

  const detailMap = new Map(
    (vocabDetails ?? []).map((item) => [`${item.item_text}:${item.item_type}`, item]),
  );

  const drillItems = (wordProgress ?? [])
    .map((wp) => {
      const detail =
        detailMap.get(`${wp.word}:${wp.item_type ?? 'word'}`) ??
        detailMap.get(`${wp.word}:word`) ??
        null;

      if (
        !detail ||
        !detail.english_explanation ||
        !Array.isArray(detail.distractors) ||
        detail.distractors.length < 3
      ) {
        return null;
      }

      const correctAnswer =
        wp.item_type === 'phrase'
          ? detail.example_text || detail.english_explanation
          : detail.english_explanation;

      return {
        wordProgressId: wp.id,
        vocabularyItemId: detail.id,
        itemText: wp.word,
        itemType: (wp.item_type ?? 'word') as 'word' | 'phrase',
        correctAnswer,
        distractors: detail.distractors,
        contextSentence: detail.context_sentence || '',
      };
    })
    .filter(Boolean) as Array<{
      wordProgressId: string;
      vocabularyItemId: string;
      itemText: string;
      itemType: 'word' | 'phrase';
      correctAnswer: string;
      distractors: string[];
      contextSentence: string;
    }>;

  const wordDrills = drillItems.filter((item) => item.itemType === 'word');
  const phraseDrills = drillItems.filter((item) => item.itemType === 'phrase');
  const clozeDrills = drillItems.filter((item) => item.contextSentence);

  const totalDue = (wordProgress ?? []).length;
  const readyCount = drillItems.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Vocabulary Drills</h1>
        <p className="mt-2 text-slate-600">{student.full_name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Due items</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {totalDue}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Ready drills</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {readyCount}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Words</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {wordDrills.length}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Phrases</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {phraseDrills.length}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Cloze</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {clozeDrills.length}
          </div>
        </div>
      </div>

      {readyCount < totalDue ? (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Prepare drills
          </h2>
          <p className="mb-4 text-slate-600">
            Some vocabulary items still need answer choices.
          </p>
          <PrepareVocabularyDrillsButton studentId={student.id} />
        </section>
      ) : null}

      {wordDrills.length > 0 ? (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Word Meaning Drills
          </h2>
          <VocabularyDrillPlayer items={wordDrills} />
        </section>
      ) : null}

      {phraseDrills.length > 0 ? (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Phrase Paraphrase Drills
          </h2>
          <VocabularyDrillPlayer items={phraseDrills} />
        </section>
      ) : null}

      {clozeDrills.length > 0 ? (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Cloze Drills from Context
          </h2>
          <ClozeDrillPlayer items={clozeDrills} />
        </section>
      ) : null}

      {drillItems.length === 0 ? (
        <section className="rounded-2xl border bg-white p-6">
          <p className="text-slate-600">No drill items ready yet.</p>
        </section>
      ) : null}
    </div>
  );
}