-- Local suppression list so we stop retrying addresses that bounce via
-- Cloudflare Email Sending (protects sender reputation / bounce rate).

create table if not exists public.email_suppressions (
  email text primary key,
  reason text not null default 'bounce',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_suppressions_updated_at_idx
  on public.email_suppressions (updated_at desc);

alter table public.email_suppressions enable row level security;

-- Service role only; no authenticated client access.
revoke all on table public.email_suppressions from public, anon, authenticated;
grant select, insert, update, delete on table public.email_suppressions to service_role;
