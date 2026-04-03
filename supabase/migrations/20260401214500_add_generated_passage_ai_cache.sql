alter table if exists public.generated_passages
  add column if not exists chunk_fingerprint text,
  add column if not exists ai_package_cache jsonb,
  add column if not exists ai_cache_version text,
  add column if not exists ai_cached_at timestamptz;

create index if not exists idx_generated_passages_chunk_fingerprint
  on public.generated_passages(chunk_fingerprint);
