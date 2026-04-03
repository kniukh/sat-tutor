import { requireAdmin } from '@/lib/auth/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AdminShell } from '@/components/admin/AdminShell';
import DetectStructureButton from '@/components/admin/DetectStructureButton';
import BuildCleanTextButton from '@/components/admin/BuildCleanTextButton';
import GeneratePassagesFromCleanTextButton from '@/components/admin/GeneratePassagesFromCleanTextButton';
import GenerateLessonsFromSourceButton from '@/components/admin/GenerateLessonsFromSourceButton';
import RefreshCoverButton from '@/components/admin/RefreshCoverButton';
import ContentPipelineBatchActions from '@/components/admin/ContentPipelineBatchActions';
import SourceChunkReview from '@/components/admin/SourceChunkReview';

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

  const linkedLessonIds = Array.from(
    new Set(
      (passages ?? [])
        .map((passage: any) => passage.lesson_id)
        .filter((lessonId: string | null): lessonId is string => Boolean(lessonId))
    )
  );

  const [{ data: linkedLessons }, { data: linkedQuestions }] = await Promise.all([
    linkedLessonIds.length > 0
      ? supabase
          .from('lessons')
          .select('id, status, lesson_type')
          .in('id', linkedLessonIds)
      : Promise.resolve({ data: [] as any[] }),
    linkedLessonIds.length > 0
      ? supabase
          .from('question_bank')
          .select(
            'id, lesson_id, question_type, question_text, option_a, option_b, option_c, option_d, correct_option, review_status, display_order'
          )
          .in('lesson_id', linkedLessonIds)
          .order('display_order', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const lessonMetaMap = new Map((linkedLessons ?? []).map((lesson: any) => [lesson.id, lesson]));
  const questionMap = new Map<string, any[]>();

  for (const question of linkedQuestions ?? []) {
    const existing = questionMap.get(question.lesson_id) ?? [];
    existing.push(question);
    questionMap.set(question.lesson_id, existing);
  }

  const reviewChunks = (passages ?? []).map((passage: any) => {
    const lessonMeta = passage.lesson_id ? lessonMetaMap.get(passage.lesson_id) ?? null : null;

    return {
      id: passage.id,
      title: passage.title,
      chunkIndex: passage.chunk_index ?? 0,
      wordCount: passage.word_count ?? null,
      status: passage.status ?? null,
      chapterTitle: passage.chapter_title ?? null,
      passageText: passage.passage_text,
      lessonId: passage.lesson_id ?? null,
      lessonStatus: lessonMeta?.status ?? null,
      questions: passage.lesson_id ? questionMap.get(passage.lesson_id) ?? [] : [],
    };
  });

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
              <div className="flex min-h-[16rem] items-center justify-center rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-sm font-semibold token-text-muted">
                No cover
              </div>
            )}

            {source.source_type === 'book' ? (
              <RefreshCoverButton sourceId={source.id} />
            ) : null}
          </div>

          <div className="space-y-5">
            <div>
              <div className="app-kicker">Content Pipeline</div>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] token-text-primary">
                Create, chunk, review, publish
              </h2>
              <p className="mt-2 text-sm leading-6 token-text-secondary">
                This source feeds the existing lesson review flow. Each chunk now goes through one AI pass for analysis, 2 SAT questions, 2 vocab questions, and short explanations before inline review.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="app-card-soft p-4">
                <div className="app-kicker token-text-muted">Type</div>
                <div className="mt-2 text-xl font-semibold token-text-primary">{source.source_type}</div>
              </div>
              <div className="app-card-soft p-4">
                <div className="app-kicker token-text-muted">Sections</div>
                <div className="mt-2 text-xl font-semibold token-text-primary">{cleanTextRows?.length ?? 0}</div>
              </div>
              <div className="app-card-soft p-4">
                <div className="app-kicker token-text-muted">Chunks</div>
                <div className="mt-2 text-xl font-semibold token-text-primary">{passages?.length ?? 0}</div>
              </div>
              <div className="app-card-soft p-4">
                <div className="app-kicker token-text-muted">Lessons</div>
                <div className="mt-2 text-xl font-semibold token-text-primary">{linkedLessonsCount}</div>
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
                <GeneratePassagesFromCleanTextButton
                  sourceDocumentId={source.id}
                  hasExistingChunks={Boolean(passages && passages.length > 0)}
                />
              ) : null}

              {passages && passages.length > 0 ? (
                <GenerateLessonsFromSourceButton
                  sourceDocumentId={source.id}
                  disabled={!hasUnlinkedPassages}
                />
              ) : null}
            </div>

            {reviewChunks.length > 0 ? (
              <ContentPipelineBatchActions chunks={reviewChunks} />
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="surface-panel p-5">
          <div className="text-sm token-text-muted">Upload kind</div>
          <div className="mt-2 text-xl font-semibold token-text-primary">
            {source.upload_kind ?? 'raw_text'}
          </div>
        </div>

        <div className="surface-panel p-5">
          <div className="text-sm token-text-muted">PDF status</div>
          <div className="mt-2 text-xl font-semibold token-text-primary">
            {source.pdf_processing_status ?? 'uploaded'}
          </div>
        </div>

        <div className="surface-panel p-5">
          <div className="text-sm token-text-muted">Extracted pages</div>
          <div className="mt-2 text-xl font-semibold token-text-primary">
            {pages?.length ?? 0}
          </div>
        </div>

        <div className="surface-panel p-5">
          <div className="text-sm token-text-muted">Chunks</div>
          <div className="mt-2 text-xl font-semibold token-text-primary">
            {passages?.length ?? 0}
          </div>
        </div>
      </div>

      {source.pdf_file_path ? (
        <section className="surface-panel p-6">
          <h2 className="mb-4 text-xl font-semibold token-text-primary">PDF File</h2>
          <a
            href={source.pdf_file_path}
            target="_blank"
            rel="noreferrer"
            className="token-text-primary underline"
          >
            Open uploaded PDF
          </a>
        </section>
      ) : null}

      {structure ? (
        <section className="surface-panel p-6">
          <h2 className="mb-4 text-xl font-semibold token-text-primary">Detected Structure</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="surface-soft-panel p-4">
              <div className="text-sm token-text-muted">Front matter ends</div>
              <div className="mt-2 text-lg font-semibold token-text-primary">
                {structure.front_matter_end_page ?? '-'}
              </div>
            </div>

            <div className="surface-soft-panel p-4">
              <div className="text-sm token-text-muted">Body starts</div>
              <div className="mt-2 text-lg font-semibold token-text-primary">
                {structure.body_start_page ?? '-'}
              </div>
            </div>

            <div className="surface-soft-panel p-4">
              <div className="text-sm token-text-muted">Body ends</div>
              <div className="mt-2 text-lg font-semibold token-text-primary">
                {structure.body_end_page ?? '-'}
              </div>
            </div>
          </div>

          {Array.isArray(structure.detected_chapters_json) &&
          structure.detected_chapters_json.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-3 font-semibold token-text-primary">Detected Chapters</h3>
              <div className="space-y-3">
                {structure.detected_chapters_json.map((chapter: any) => (
                  <div key={`${chapter.chapter_index}-${chapter.start_page}`} className="surface-soft-panel p-4">
                    <div className="font-medium token-text-primary">
                      {chapter.chapter_title || `Chapter ${chapter.chapter_index}`}
                    </div>
                    <div className="mt-1 text-sm token-text-secondary">
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
              <h3 className="mb-3 font-semibold token-text-primary">Excluded Sections</h3>
              <div className="space-y-3">
                {structure.excluded_sections_json.map((section: any, i: number) => (
                  <div key={`${section.label}-${i}`} className="surface-soft-panel p-4">
                    <div className="font-medium token-text-primary">{section.label}</div>
                    <div className="mt-1 text-sm token-text-secondary">
                      Pages {section.start_page}–{section.end_page ?? '?'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {structure.cleaning_notes ? (
            <div className="mt-6 surface-soft-panel p-4 text-sm token-text-secondary">
              {structure.cleaning_notes}
            </div>
          ) : null}
        </section>
      ) : null}

      {pages && pages.length > 0 ? (
        <section className="surface-panel p-6">
          <h2 className="mb-4 text-xl font-semibold token-text-primary">Extracted Pages</h2>

          <div className="space-y-4">
            {pages.slice(0, 10).map((page: any) => (
              <div key={page.id} className="surface-soft-panel p-4">
                <div className="font-medium token-text-primary">Page {page.page_number}</div>
                <p className="mt-2 whitespace-pre-wrap text-sm token-text-secondary">
                  {(page.raw_text || '').slice(0, 1500)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="card-surface p-5 sm:p-6">
          <div className="space-y-2">
            <div className="app-kicker">Lesson Review</div>
            <h2 className="text-2xl font-semibold tracking-[-0.02em] token-text-primary">
              Review generated chunks inline
            </h2>
            <p className="text-sm leading-6 token-text-secondary">
              Each chunk stays on this page. Generate once, scan the text, approve strong questions, and regenerate weak ones without opening another review screen.
            </p>
          </div>
        </div>

        {!reviewChunks || reviewChunks.length === 0 ? (
          <section className="card-surface p-6">
            <p className="token-text-secondary">No generated chunks yet.</p>
          </section>
        ) : (
          <SourceChunkReview chunks={reviewChunks} />
        )}
      </section>
    </AdminShell>
  );
}
