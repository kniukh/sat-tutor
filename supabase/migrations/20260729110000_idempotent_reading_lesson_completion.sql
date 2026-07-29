alter table public.lesson_attempts
  add column if not exists completion_key text;

create unique index if not exists lesson_attempts_student_lesson_completion_key_uidx
  on public.lesson_attempts (student_id, lesson_id, completion_key)
  where completion_key is not null;
