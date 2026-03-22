type VocabularyItem = {
  id: string;
  item_text: string;
  item_type: 'word' | 'phrase';
  english_explanation: string | null;
  translated_explanation: string | null;
  translation_language: string;
  is_understood?: boolean;
  created_at: string;
};

export default function StudentVocabularyHistory({
  items,
}: {
  items: VocabularyItem[];
}) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Vocabulary History</h2>

      {items.length === 0 ? (
        <p className="text-slate-600">No vocabulary items yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">{item.item_text}</div>
                  <div className="text-sm text-slate-500">
                    {item.item_type} · {item.translation_language}
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  {new Date(item.created_at).toLocaleString()}
                </div>
              </div>

              <div className="mt-3 text-sm text-slate-700">
                English meaning: {item.english_explanation || '-'}
              </div>

              <div className="mt-1 text-sm text-slate-700">
                Translation: {item.translated_explanation || '-'}
              </div>

              <div className="mt-1 text-sm text-slate-600">
                Status: {item.is_understood ? 'understood' : 'review needed'}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}