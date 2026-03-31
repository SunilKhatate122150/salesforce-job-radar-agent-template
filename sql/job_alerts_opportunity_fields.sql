alter table if exists public.job_alerts
  add column if not exists source_platform text,
  add column if not exists opportunity_kind text default 'listing',
  add column if not exists confidence_tier text,
  add column if not exists source_quality_tier text,
  add column if not exists canonical_apply_url text,
  add column if not exists canonical_company text,
  add column if not exists canonical_role text,
  add column if not exists ats_provider text,
  add column if not exists ats_board_key text,
  add column if not exists post_author text,
  add column if not exists post_url text,
  add column if not exists source_evidence jsonb default '{}'::jsonb,
  add column if not exists source_urls jsonb default '[]'::jsonb;

create index if not exists job_alerts_opportunity_kind_idx
  on public.job_alerts (opportunity_kind);

create index if not exists job_alerts_confidence_tier_idx
  on public.job_alerts (confidence_tier);

create index if not exists job_alerts_source_quality_tier_idx
  on public.job_alerts (source_quality_tier);

create index if not exists job_alerts_canonical_apply_url_idx
  on public.job_alerts (canonical_apply_url);

create index if not exists job_alerts_ats_provider_idx
  on public.job_alerts (ats_provider);

create index if not exists job_alerts_ats_board_key_idx
  on public.job_alerts (ats_board_key);
