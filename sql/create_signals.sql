-- create_signals.sql
create table public.signals (
  id bigserial primary key,
  source text not null,
  symbol text,
  action text,
  signal text,
  interval text,
  price text,
  time text,
  raw jsonb,
  created_at timestamptz default now()
);

create index on public.signals (symbol);
