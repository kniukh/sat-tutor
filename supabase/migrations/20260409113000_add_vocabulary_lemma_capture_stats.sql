do $$
begin
  alter table public.vocabulary_capture_events
    add column if not exists captured_surface_form text,
    add column if not exists canonical_lemma text;

  alter table public.vocabulary_item_details
    add column if not exists canonical_lemma text,
    add column if not exists captured_surface_forms jsonb not null default '[]'::jsonb,
    add column if not exists capture_count integer not null default 0,
    add column if not exists first_captured_at timestamptz,
    add column if not exists last_captured_at timestamptz;

  alter table public.word_progress
    add column if not exists canonical_lemma text,
    add column if not exists captured_surface_forms jsonb not null default '[]'::jsonb,
    add column if not exists capture_count integer not null default 0,
    add column if not exists first_captured_at timestamptz,
    add column if not exists last_captured_at timestamptz;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_item_details_capture_count_check'
  ) then
    alter table public.vocabulary_item_details
      add constraint vocabulary_item_details_capture_count_check
      check (capture_count >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'word_progress_capture_count_check'
  ) then
    alter table public.word_progress
      add constraint word_progress_capture_count_check
      check (capture_count >= 0);
  end if;
end $$;

update public.vocabulary_capture_events
set captured_surface_form = coalesce(
  nullif(trim(captured_surface_form), ''),
  nullif(trim(item_text), '')
)
where captured_surface_form is null
   or trim(captured_surface_form) = '';

update public.vocabulary_capture_events
set canonical_lemma = coalesce(
  nullif(trim(canonical_lemma), ''),
  lower(regexp_replace(trim(item_text), '\s+', ' ', 'g'))
)
where canonical_lemma is null
   or trim(canonical_lemma) = '';

update public.vocabulary_item_details
set canonical_lemma = coalesce(
  nullif(trim(canonical_lemma), ''),
  lower(regexp_replace(trim(item_text), '\s+', ' ', 'g'))
)
where canonical_lemma is null
   or trim(canonical_lemma) = '';

update public.word_progress
set canonical_lemma = coalesce(
  nullif(trim(canonical_lemma), ''),
  lower(regexp_replace(trim(word), '\s+', ' ', 'g'))
)
where canonical_lemma is null
   or trim(canonical_lemma) = '';

update public.vocabulary_item_details
set captured_surface_forms = '[]'::jsonb
where jsonb_typeof(captured_surface_forms) is distinct from 'array';

update public.word_progress
set captured_surface_forms = '[]'::jsonb
where jsonb_typeof(captured_surface_forms) is distinct from 'array';

with item_capture_rollup as (
  select
    student_id,
    lesson_id,
    coalesce(nullif(trim(canonical_lemma), ''), lower(regexp_replace(trim(item_text), '\s+', ' ', 'g'))) as canonical_lemma,
    to_jsonb(
      array_remove(
        array_agg(
          distinct coalesce(
            nullif(trim(captured_surface_form), ''),
            nullif(trim(item_text), '')
          )
        ),
        null
      )
    ) as captured_surface_forms,
    count(*)::integer as capture_count,
    min(created_at) as first_captured_at,
    max(created_at) as last_captured_at
  from public.vocabulary_capture_events
  group by
    student_id,
    lesson_id,
    coalesce(nullif(trim(canonical_lemma), ''), lower(regexp_replace(trim(item_text), '\s+', ' ', 'g')))
)
update public.vocabulary_item_details as details
set
  captured_surface_forms = coalesce(rollup.captured_surface_forms, details.captured_surface_forms),
  capture_count = greatest(coalesce(details.capture_count, 0), coalesce(rollup.capture_count, 0)),
  first_captured_at = coalesce(rollup.first_captured_at, details.first_captured_at),
  last_captured_at = coalesce(rollup.last_captured_at, details.last_captured_at)
from item_capture_rollup as rollup
where details.student_id = rollup.student_id
  and details.lesson_id is not distinct from rollup.lesson_id
  and details.canonical_lemma = rollup.canonical_lemma;

with word_capture_rollup as (
  select
    student_id,
    coalesce(nullif(trim(canonical_lemma), ''), lower(regexp_replace(trim(item_text), '\s+', ' ', 'g'))) as canonical_lemma,
    to_jsonb(
      array_remove(
        array_agg(
          distinct coalesce(
            nullif(trim(captured_surface_form), ''),
            nullif(trim(item_text), '')
          )
        ),
        null
      )
    ) as captured_surface_forms,
    count(*)::integer as capture_count,
    min(created_at) as first_captured_at,
    max(created_at) as last_captured_at
  from public.vocabulary_capture_events
  group by
    student_id,
    coalesce(nullif(trim(canonical_lemma), ''), lower(regexp_replace(trim(item_text), '\s+', ' ', 'g')))
)
update public.word_progress as progress
set
  captured_surface_forms = coalesce(rollup.captured_surface_forms, progress.captured_surface_forms),
  capture_count = greatest(coalesce(progress.capture_count, 0), coalesce(rollup.capture_count, 0)),
  first_captured_at = coalesce(rollup.first_captured_at, progress.first_captured_at),
  last_captured_at = coalesce(rollup.last_captured_at, progress.last_captured_at)
from word_capture_rollup as rollup
where progress.student_id = rollup.student_id
  and progress.canonical_lemma = rollup.canonical_lemma;

create index if not exists idx_vocabulary_capture_events_student_canonical_lemma
  on public.vocabulary_capture_events (student_id, canonical_lemma, created_at desc);

create index if not exists idx_vocabulary_item_details_student_lesson_canonical_lemma
  on public.vocabulary_item_details (student_id, lesson_id, canonical_lemma);

create index if not exists idx_word_progress_student_canonical_lemma
  on public.word_progress (student_id, canonical_lemma);
