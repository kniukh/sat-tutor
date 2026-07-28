alter table public.source_document_clean_text
  add column if not exists audio_url text,
  add column if not exists audio_status text default 'missing',
  add column if not exists audio_duration_ms integer,
  add column if not exists audio_alignment_method text,
  add column if not exists audio_aligned_at timestamptz;

alter table public.generated_passages
  add column if not exists audio_url text,
  add column if not exists audio_start_ms integer,
  add column if not exists audio_end_ms integer,
  add column if not exists audio_sentence_start_index integer,
  add column if not exists audio_sentence_end_index integer,
  add column if not exists audio_alignment_confidence numeric,
  add column if not exists audio_alignment_method text;

alter table public.lesson_passages
  add column if not exists audio_url text,
  add column if not exists audio_start_ms integer,
  add column if not exists audio_end_ms integer,
  add column if not exists audio_sentence_start_index integer,
  add column if not exists audio_sentence_end_index integer,
  add column if not exists audio_alignment_confidence numeric,
  add column if not exists audio_alignment_method text;

create table if not exists public.source_chapter_audio_sentences (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  chapter_index integer not null,
  sentence_index integer not null,
  sentence_text text not null,
  char_start integer not null,
  char_end integer not null,
  audio_start_ms integer,
  audio_end_ms integer,
  confidence numeric not null default 0.55,
  alignment_method text not null default 'estimated_by_word_count',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_document_id, chapter_index, sentence_index)
);

create index if not exists idx_source_chapter_audio_sentences_source_chapter
  on public.source_chapter_audio_sentences(source_document_id, chapter_index, sentence_index);

comment on table public.source_chapter_audio_sentences is
  'Sentence-level alignment for source chapter text and chapter audio. Estimated rows can later be replaced by STT-backed timings.';

comment on column public.generated_passages.audio_start_ms is
  'Start offset within the chapter audio for this generated chunk.';

comment on column public.lesson_passages.audio_start_ms is
  'Start offset within the chapter audio for this student-facing lesson passage.';
