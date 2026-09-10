-- Dashboard QoL: structured alert context + history saved views + chart share tokens + household digest opt-in
alter table public.alert_events
  add column if not exists meta jsonb not null default '{}'::jsonb;

create table if not exists public.history_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  name text not null,
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists history_saved_views_user_idx
  on public.history_saved_views (user_id, created_at desc);

alter table public.history_saved_views enable row level security;

create policy "Users manage own history saved views"
  on public.history_saved_views
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.chart_share_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  r2_key text not null,
  title text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists chart_share_tokens_expires_idx
  on public.chart_share_tokens (expires_at);

alter table public.chart_share_tokens enable row level security;

-- Public token lookup uses service role; owners can manage their rows.
create policy "Users manage own chart share tokens"
  on public.chart_share_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.household_members
  add column if not exists digest_opt_in boolean not null default false;

comment on column public.alert_events.meta is 'Structured why-alerted context and ack feedback';
comment on column public.household_members.digest_opt_in is 'Receive weekly digest fan-out when owner digest is enabled';
