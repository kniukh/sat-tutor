-- Keep the reading mode available on the passage row used by the lesson player.
alter table if exists public.lesson_passages
  add column if not exists content_mode text not null default 'sat';

update public.lesson_passages lp
set content_mode = coalesce(l.content_mode, 'sat')
from public.lessons l
where l.id = lp.lesson_id;

alter table public.lesson_passages
  drop constraint if exists lesson_passages_content_mode_check;

alter table public.lesson_passages
  add constraint lesson_passages_content_mode_check
  check (content_mode in ('sat', 'det'));

create index if not exists idx_lesson_passages_content_mode
  on public.lesson_passages(content_mode, lesson_id);

comment on column public.lesson_passages.content_mode is
  'Reading mode inherited from the lesson: sat or det.';
