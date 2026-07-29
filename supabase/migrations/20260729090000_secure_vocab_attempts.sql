alter table public.exercise_attempts
  add column if not exists client_attempt_id text null;

create unique index if not exists exercise_attempts_student_client_attempt_unique
  on public.exercise_attempts(student_id, client_attempt_id)
  where client_attempt_id is not null;

create index if not exists exercise_attempts_student_session_exercise_idx
  on public.exercise_attempts(student_id, session_id, exercise_id);

comment on column public.exercise_attempts.client_attempt_id is
  'Client-generated idempotency key. Correctness is still recomputed from the server-side session snapshot.';
