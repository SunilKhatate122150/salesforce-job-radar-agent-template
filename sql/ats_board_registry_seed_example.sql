-- Example ATS board seeds for shadow-mode rollout.
-- Start with mode='shadow', review coverage, then promote high-signal boards to mode='live'.

insert into public.ats_board_registry (
  provider,
  company,
  board_key,
  careers_url,
  geo_scope,
  priority,
  mode,
  active,
  metadata
) values
  (
    'greenhouse',
    'Example Company',
    'examplecompany',
    'https://boards.greenhouse.io/examplecompany',
    'india_remote',
    80,
    'shadow',
    true,
    jsonb_build_object('notes', 'Promote to live after shadow validation')
  ),
  (
    'lever',
    'Example Startup',
    'examplestartup',
    'https://jobs.lever.co/examplestartup',
    'india_remote',
    75,
    'shadow',
    true,
    jsonb_build_object('notes', 'Good remote startup target')
  ),
  (
    'ashby',
    'Example AI',
    'exampleai',
    'https://jobs.ashbyhq.com/exampleai',
    'india_remote',
    70,
    'shadow',
    true,
    jsonb_build_object('notes', 'Promote when stable')
  )
on conflict (provider, board_key) do update
set
  company = excluded.company,
  careers_url = excluded.careers_url,
  geo_scope = excluded.geo_scope,
  priority = excluded.priority,
  mode = excluded.mode,
  active = excluded.active,
  metadata = excluded.metadata,
  updated_at = now();
