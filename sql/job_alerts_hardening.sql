-- Run once in Supabase SQL Editor.
-- This hardens persistence for dedupe + incremental tracking.

alter table if exists public.job_alerts
  add column if not exists source_job_id text,
  add column if not exists first_seen_at timestamptz default now(),
  add column if not exists last_seen_at timestamptz default now();

create unique index if not exists job_alerts_job_hash_uidx
  on public.job_alerts (job_hash);

create index if not exists job_alerts_source_job_id_idx
  on public.job_alerts (source_job_id);

create index if not exists job_alerts_last_seen_at_idx
  on public.job_alerts (last_seen_at desc);

