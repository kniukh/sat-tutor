alter table public.reading_assignments
  add column if not exists chapter_index integer,
  add column if not exists vocabulary_checkpoints_completed integer not null default 0;

alter table public.reading_assignments
  drop constraint if exists reading_assignments_status_check;

alter table public.reading_assignments
  add constraint reading_assignments_status_check
  check (status in ('assigned', 'in_progress', 'completed', 'archived'));

alter table public.reading_assignments
  drop constraint if exists reading_assignments_vocabulary_checkpoints_check;

alter table public.reading_assignments
  add constraint reading_assignments_vocabulary_checkpoints_check
  check (vocabulary_checkpoints_completed >= 0);

alter table public.reading_assignments
  drop constraint if exists reading_assignments_student_id_source_document_id_key;

create unique index if not exists idx_reading_assignments_student_book_chapter
  on public.reading_assignments(student_id, source_document_id, coalesce(chapter_index, -1));

create index if not exists idx_reading_assignments_student_chapter_status
  on public.reading_assignments(student_id, source_document_id, chapter_index, status);

comment on column public.reading_assignments.chapter_index is
  'Assigned chapter within the source document. Null preserves legacy whole-book assignments.';

comment on column public.reading_assignments.vocabulary_checkpoints_completed is
  'Number of guided vocabulary checkpoints completed for this chapter assignment.';
