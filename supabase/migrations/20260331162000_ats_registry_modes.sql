alter table if exists public.ats_board_registry
  add column if not exists mode text not null default 'shadow';

create index if not exists ats_board_registry_mode_idx
  on public.ats_board_registry (mode);
