alter table if exists public.lesson_reading_metrics
  add column if not exists content_mode text not null default 'sat';

alter table if exists public.question_attempts
  add column if not exists content_mode text not null default 'sat';

alter table public.lesson_reading_metrics
  drop constraint if exists lesson_reading_metrics_content_mode_check;
alter table public.lesson_reading_metrics
  add constraint lesson_reading_metrics_content_mode_check
  check (content_mode in ('sat', 'det'));

alter table public.question_attempts
  drop constraint if exists question_attempts_content_mode_check;
alter table public.question_attempts
  add constraint question_attempts_content_mode_check
  check (content_mode in ('sat', 'det'));

create index if not exists idx_lesson_reading_metrics_mode_student
  on public.lesson_reading_metrics(student_id, content_mode, created_at desc);

create index if not exists idx_question_attempts_mode_student
  on public.question_attempts(student_id, content_mode, created_at desc);
