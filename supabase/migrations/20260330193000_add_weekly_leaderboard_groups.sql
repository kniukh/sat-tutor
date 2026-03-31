create table if not exists public.weekly_leaderboard_groups (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  group_number integer not null,
  target_size integer not null default 15,
  member_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_leaderboard_groups_target_size_check
    check (target_size between 10 and 20),
  constraint weekly_leaderboard_groups_member_count_check
    check (member_count >= 0),
  constraint weekly_leaderboard_groups_week_group_unique
    unique (week_start_date, group_number)
);

create table if not exists public.weekly_leaderboard_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.weekly_leaderboard_groups(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  week_start_date date not null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint weekly_leaderboard_members_week_student_unique
    unique (week_start_date, student_id),
  constraint weekly_leaderboard_members_group_student_unique
    unique (group_id, student_id)
);

create index if not exists idx_weekly_leaderboard_groups_week_member_count
  on public.weekly_leaderboard_groups(week_start_date, member_count desc);

create index if not exists idx_weekly_leaderboard_members_group
  on public.weekly_leaderboard_members(group_id, joined_at);

create index if not exists idx_weekly_leaderboard_members_student_week
  on public.weekly_leaderboard_members(student_id, week_start_date desc);

drop trigger if exists trg_weekly_leaderboard_groups_set_updated_at on public.weekly_leaderboard_groups;
create trigger trg_weekly_leaderboard_groups_set_updated_at
before update on public.weekly_leaderboard_groups
for each row
execute function public.set_updated_at();

comment on table public.weekly_leaderboard_groups is
  'Small weekly competitive groups used for achievable leaderboard rankings instead of one global board.';

comment on table public.weekly_leaderboard_members is
  'Per-student weekly leaderboard group assignments. Stable for the week and recreated on the next weekly cycle.';
