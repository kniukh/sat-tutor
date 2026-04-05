alter table public.ai_usage_log
  add column if not exists student_id uuid null references public.students(id) on delete set null;

alter table public.ai_usage_log
  add column if not exists actor_type text not null default 'system'
  check (actor_type in ('student', 'admin', 'system'));

create index if not exists idx_ai_usage_log_student_created_at
  on public.ai_usage_log (student_id, created_at desc)
  where student_id is not null;

create index if not exists idx_ai_usage_log_actor_type_created_at
  on public.ai_usage_log (actor_type, created_at desc);

comment on column public.ai_usage_log.student_id is
  'Optional student owner for student-facing AI requests, enabling per-student usage reporting.';

comment on column public.ai_usage_log.actor_type is
  'High-level request owner: student, admin, or system.';
