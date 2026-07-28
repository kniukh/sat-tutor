alter table public.generated_passages
  add column if not exists audio_sentence_timings jsonb;

alter table public.lesson_passages
  add column if not exists audio_sentence_timings jsonb;

comment on column public.generated_passages.audio_sentence_timings is
  'Sentence-level audio offsets for the generated passage chunk, used for read-and-listen highlighting.';

comment on column public.lesson_passages.audio_sentence_timings is
  'Sentence-level audio offsets for the student-facing lesson passage, used for read-and-listen highlighting.';
