import { requireAdmin } from '@/lib/auth/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import GeneratedPassageActions from '@/components/admin/GeneratedPassageActions';
import AnalyzePassageButton from '@/components/admin/AnalyzePassageButton';
import { AdminShell } from '@/components/admin/AdminShell';
import DetectStructureButton from '@/components/admin/DetectStructureButton';
import BuildCleanTextButton from '@/components/admin/BuildCleanTextButton';
import GeneratePassagesFromCleanTextButton from '@/components/admin/GeneratePassagesFromCleanTextButton';
import AnalyzePassageV2Button from '@/components/admin/AnalyzePassageV2Button';
import GenerateLessonsFromSourceButton from '@/components/admin/GenerateLessonsFromSourceButton';

export default async function AdminSourceDetailPage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  await requireAdmin();

  const { sourceId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: source, error: sourceError } = await supabase
    .from('source_documents')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (sourceError || !source) {
    throw new Error('Source not found');
  }

  const { data: pages, error: pagesError } = await supabase
    .from('source_document_pages')
    .select('*')
    .eq('source_document_id', sourceId)
    .order('page_number', { ascending: true });

  if (pagesError) {
    throw new Error(pagesError.message);
  }

  const { data: structure } = await supabase
    .from('source_document_structure')
    .select('*')
    .eq('source_document_id', sourceId)
    .maybeSingle();

  const { data: cleanTextRows } = await supabase
    .from('source_document_clean_text')
    .select('*')
    .eq('source_document_id', sourceId)
    .order('chapter_index', { ascending: true });

  const { data: passages, error: passagesError } = await supabase
    .from('generated_passages')
    .select('*')
    .eq('source_document_id', sourceId)
    .order('chunk_index', { ascending: true });

  if (passagesError) {
    throw new Error(passagesError.message);
  }

  const metadata = source.metadata && typeof source.metadata === 'object' ? source.metadata : {};
  const coverImagePath =
    typeof metadata.cover_image_path === 'string' ? metadata.cover_image_path : null;
  const hasCleanRows = Boolean(cleanTextRows && cleanTextRows.length > 0);
  const hasUnlinkedPassages = Boolean((passages ?? []).some((passage: any) => !passage.lesson_id));
  const linkedLessonsCount = (passages ?? []).filter((passage: any) => Boolean(passage.lesson_id)).length;

  return (
    <AdminShell
      title={source.title}
      subtitle={`${source.author || 'Unknown author'} · ${source.source_type}`}
    >
      <section className="card-surface p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            {coverImagePath ? (
              <div className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                <img src={coverImagePath} alt={source.title} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex min-h-[16rem] items-center justify-center rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-sm font-semibold text-slate-500">
                No cover
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <div className="app-kicker">Content Pipeline</div>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-slate-950">
                Create, chunk, review, publish
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This source feeds the existing lesson review flow. Generate chunks first, then create AI lessons and review them inline.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="app-card-soft p-4">
                <div className="app-kicker text-slate-500">Type</div>
                <div className="mt-2 text-xl font-semibold text-slate-950">{source.source_type}</div>
              </div>
              <div className="app-card-soft p-4">
                <div className="app-kicker text-slate-500">Clean Sections</div>
                <div className="mt-2 text-xl font-semibold text-slate-950">{cleanTextRows?.length ?? 0}</div>
              </div>
              <div className="app-card-soft p-4">
                <div className="app-kicker text-slate-500">Chunks</div>
                <div className="mt-2 text-xl font-semibold text-slate-950">{passages?.length ?? 0}</div>
              </div>
              <div className="app-card-soft p-4">
                <div className="app-kicker text-slate-500">Lessons</div>
                <div className="mt-2 text-xl font-semibold text-slate-950">{linkedLessonsCount}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {!hasCleanRows && source.upload_kind === 'pdf' ? (
                <>
                  <DetectStructureButton sourceDocumentId={source.id} />
                  <BuildCleanTextButton sourceDocumentId={source.id} />
                </>
              ) : null}

              {hasCleanRows ? (
                <GeneratePassagesFromCleanTextButton sourceDocumentId={source.id} />
              ) : null}

              {passages && passages.length > 0 ? (
                <GenerateLessonsFromSourceButton
                  sourceDocumentId={source.id}
                  disabled={!hasUnlinkedPassages}
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Upload kind</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {source.upload_kind ?? 'raw_text'}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">PDF status</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {source.pdf_processing_status ?? 'uploaded'}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Extracted pages</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {pages?.length ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Generated passages</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {passages?.length ?? 0}
          </div>
        </div>
      </div>

      {source.pdf_file_path ? (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">PDF File</h2>
          <a
            href={source.pdf_file_path}
            target="_blank"
            rel="noreferrer"
            className="text-slate-900 underline"
          >
            Open uploaded PDF
          </a>
        </section>
      ) : null}

      {structure ? (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Detected Structure</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Front matter ends</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {structure.front_matter_end_page ?? '-'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Body starts</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {structure.body_start_page ?? '-'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Body ends</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {structure.body_end_page ?? '-'}
              </div>
            </div>
          </div>

          {Array.isArray(structure.detected_chapters_json) &&
          structure.detected_chapters_json.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-3 font-semibold text-slate-900">Detected Chapters</h3>
              <div className="space-y-3">
                {structure.detected_chapters_json.map((chapter: any) => (
                  <div key={`${chapter.chapter_index}-${chapter.start_page}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="font-medium text-slate-900">
                      {chapter.chapter_title || `Chapter ${chapter.chapter_index}`}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Pages {chapter.start_page}–{chapter.end_page ?? '?'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {Array.isArray(structure.excluded_sections_json) &&
          structure.excluded_sections_json.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-3 font-semibold text-slate-900">Excluded Sections</h3>
              <div className="space-y-3">
                {structure.excluded_sections_json.map((section: any, i: number) => (
                  <div key={`${section.label}-${i}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="font-medium text-slate-900">{section.label}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Pages {section.start_page}–{section.end_page ?? '?'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {structure.cleaning_notes ? (
            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              {structure.cleaning_notes}
            </div>
          ) : null}
        </section>
      ) : null}

      {cleanTextRows && cleanTextRows.length > 0 ? (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Clean Book Text</h2>

          <div className="space-y-4">
            {cleanTextRows.map((row: any) => (
              <div key={row.id} className="rounded-xl border border-slate-200 p-4">
                <div className="font-medium text-slate-900">
                  {row.chapter_title || `Chapter ${row.chapter_index}`}
                </div>
                <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                  {(row.clean_text || '').slice(0, 1800)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Raw text preview</h2>
        <p className="whitespace-pre-wrap text-slate-700">
          {(source.raw_text || '').slice(0, 8000)}
        </p>
      </section>

      {pages && pages.length > 0 ? (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Extracted Pages</h2>

          <div className="space-y-4">
            {pages.slice(0, 10).map((page: any) => (
              <div key={page.id} className="rounded-xl border border-slate-200 p-4">
                <div className="font-medium text-slate-900">Page {page.page_number}</div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {(page.raw_text || '').slice(0, 1500)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Generated chunks</h2>

        {!passages || passages.length === 0 ? (
          <p className="text-slate-600">No generated chunks yet.</p>
        ) : (
          <div className="space-y-4">
            {passages.map((passage: any) => (
              <div key={passage.id} className="rounded-xl border border-slate-200 p-4">
                <div className="font-semibold text-slate-900">
                  Chunk #{passage.chunk_index + 1}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  {passage.word_count ?? 0} words · {passage.status}
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  Role: {passage.passage_role ?? 'not analyzed'} · Strategy:{' '}
                  {passage.question_strategy ?? 'not analyzed'} · Recommended count:{' '}
                  {passage.recommended_question_count ?? '-'}
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  Chapter: {passage.chapter_title ?? `Chapter ${passage.chapter_index ?? '-'}`} ·
                  Difficulty: {passage.difficulty_level ?? '-'} · Mode: {passage.text_mode ?? '-'}
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  Vocab density: {passage.vocab_density ?? '-'} · Phrase density:{' '}
                  {passage.phrase_density ?? '-'} · Vocab questions:{' '}
                  {passage.recommended_vocab_questions_count ?? 0}
                </div>

                {Array.isArray(passage.recommended_vocab_target_words) &&
                passage.recommended_vocab_target_words.length > 0 ? (
                  <div className="mt-1 text-sm text-slate-600">
                    Target words: {passage.recommended_vocab_target_words.join(', ')}
                  </div>
                ) : null}

                {Array.isArray(passage.recommended_vocab_target_phrases) &&
                passage.recommended_vocab_target_phrases.length > 0 ? (
                  <div className="mt-1 text-sm text-slate-600">
                    Target phrases: {passage.recommended_vocab_target_phrases.join(', ')}
                  </div>
                ) : null}

                <p className="mt-3 whitespace-pre-wrap text-slate-700">
                  {passage.passage_text}
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <AnalyzePassageV2Button generatedPassageId={passage.id} />
                  <GeneratedPassageActions
                    generatedPassageId={passage.id}
                    status={passage.status}
                    lessonId={passage.lesson_id}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
