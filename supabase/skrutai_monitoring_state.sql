create table if not exists skrutai_monitoring_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists skrutai_monitoring_state_updated_at_idx
  on skrutai_monitoring_state (updated_at desc);
