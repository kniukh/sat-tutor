with ranked_rows as (
  select
    id,
    student_id,
    row_number() over (
      partition by student_id
      order by coalesce(updated_at, now()) desc, id desc
    ) as row_rank
  from public.student_gamification
),
aggregated_rows as (
  select
    sg.student_id,
    max(greatest(coalesce(sg.total_xp, 0), coalesce(sg.xp, 0))) as merged_total_xp,
    max(coalesce(sg.weekly_xp, 0)) as merged_weekly_xp,
    min(coalesce(sg.weekly_xp_started_at, current_date)) as merged_weekly_xp_started_at,
    max(coalesce(sg.level, 1)) as merged_level,
    max(coalesce(sg.streak_days, 0)) as merged_streak_days,
    max(greatest(coalesce(sg.longest_streak_days, 0), coalesce(sg.streak_days, 0))) as merged_longest_streak_days,
    max(sg.last_activity_date) as merged_last_activity_date,
    (
      select coalesce(jsonb_agg(distinct achievement), '[]'::jsonb)
      from public.student_gamification sg2
      cross join lateral jsonb_array_elements_text(coalesce(sg2.achievements, '[]'::jsonb)) achievement
      where sg2.student_id = sg.student_id
    ) as merged_achievements
  from public.student_gamification sg
  group by sg.student_id
)
update public.student_gamification sg
set
  xp = aggregated_rows.merged_total_xp,
  total_xp = aggregated_rows.merged_total_xp,
  weekly_xp = aggregated_rows.merged_weekly_xp,
  weekly_xp_started_at = aggregated_rows.merged_weekly_xp_started_at,
  level = aggregated_rows.merged_level,
  streak_days = aggregated_rows.merged_streak_days,
  longest_streak_days = aggregated_rows.merged_longest_streak_days,
  last_activity_date = aggregated_rows.merged_last_activity_date,
  achievements = aggregated_rows.merged_achievements,
  updated_at = now()
from ranked_rows
join aggregated_rows
  on aggregated_rows.student_id = ranked_rows.student_id
where sg.id = ranked_rows.id
  and ranked_rows.row_rank = 1;

delete from public.student_gamification sg
using (
  select id
  from (
    select
      id,
      row_number() over (
        partition by student_id
        order by coalesce(updated_at, now()) desc, id desc
      ) as row_rank
    from public.student_gamification
  ) ranked
  where ranked.row_rank > 1
) duplicates
where sg.id = duplicates.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_gamification_student_id_key'
  ) then
    alter table public.student_gamification
      add constraint student_gamification_student_id_key unique (student_id);
  end if;
end $$;
