-- Keep existing content as SAT while allowing DET books to use the same pipeline.
alter table if exists public.source_documents
  add column if not exists content_mode text not null default 'sat';

alter table if exists public.generated_passages
  add column if not exists content_mode text not null default 'sat';

alter table if exists public.lessons
  add column if not exists content_mode text not null default 'sat';

update public.source_documents
set content_mode = 'sat'
where content_mode is null;

update public.generated_passages
set content_mode = 'sat'
where content_mode is null;

update public.lessons
set content_mode = 'sat'
where content_mode is null;

alter table public.source_documents
  drop constraint if exists source_documents_content_mode_check;
alter table public.source_documents
  add constraint source_documents_content_mode_check
  check (content_mode in ('sat', 'det'));

alter table public.generated_passages
  drop constraint if exists generated_passages_content_mode_check;
alter table public.generated_passages
  add constraint generated_passages_content_mode_check
  check (content_mode in ('sat', 'det'));

alter table public.lessons
  drop constraint if exists lessons_content_mode_check;
alter table public.lessons
  add constraint lessons_content_mode_check
  check (content_mode in ('sat', 'det'));

create index if not exists idx_source_documents_content_mode
  on public.source_documents(content_mode, created_at desc);

create index if not exists idx_generated_passages_content_mode
  on public.generated_passages(content_mode, source_document_id, chunk_index);

create index if not exists idx_lessons_content_mode
  on public.lessons(content_mode, status, created_at desc);

comment on column public.source_documents.content_mode is
  'Reading mode for the source: sat or det.';
comment on column public.generated_passages.content_mode is
  'Reading mode inherited from the source document: sat or det.';
comment on column public.lessons.content_mode is
  'Reading mode for the lesson: sat or det.';
