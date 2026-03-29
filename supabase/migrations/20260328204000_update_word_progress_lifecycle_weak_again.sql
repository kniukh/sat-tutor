alter table public.word_progress
  drop constraint if exists word_progress_lifecycle_state_check;

update public.word_progress
set lifecycle_state = 'weak_again'
where lifecycle_state = 'weak';

alter table public.word_progress
  add constraint word_progress_lifecycle_state_check
  check (lifecycle_state in ('new', 'learning', 'review', 'mastered', 'weak_again'));
