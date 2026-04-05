create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  cache_hit boolean not null default false,
  retry_count integer not null default 0 check (retry_count >= 0),
  status text not null default 'success',
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_log_route_created_at
  on public.ai_usage_log (route, created_at desc);

create index if not exists idx_ai_usage_log_model_created_at
  on public.ai_usage_log (model, created_at desc);

create index if not exists idx_ai_usage_log_cache_hit_created_at
  on public.ai_usage_log (cache_hit, created_at desc);

alter table public.ai_usage_log enable row level security;

comment on table public.ai_usage_log is
  'Best-effort AI usage telemetry for tokens, latency, cache hits, and retry cost analysis.';
