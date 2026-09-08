-- Align RLS with app-layer roles for secret-bearing tables.
-- Viewers/alert_only remain household members for readings, but must not
-- read/write device rows, puck secrets, share tokens, claims packs, or invites.

create or replace function public.is_household_editor(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role in ('owner', 'member', 'property_manager')
  );
$$;

create or replace function public.is_household_manager(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role in ('owner', 'member')
  );
$$;

revoke all on function public.is_household_editor(uuid) from public, anon;
revoke all on function public.is_household_manager(uuid) from public, anon;
grant execute on function public.is_household_editor(uuid) to authenticated, service_role;
grant execute on function public.is_household_manager(uuid) to authenticated, service_role;

-- devices: editors only (meta may contain ingest_key_enc). Viewers use service-role APIs.
drop policy if exists devices_member_all on public.devices;
drop policy if exists devices_member_select on public.devices;
drop policy if exists devices_editor_write on public.devices;
drop policy if exists devices_editor_all on public.devices;

create policy devices_editor_all on public.devices
  for all to authenticated
  using (public.is_household_editor(household_id))
  with check (public.is_household_editor(household_id));

-- share_links: managers only (tokens must not leak to viewers)
drop policy if exists share_links_member_all on public.share_links;
drop policy if exists share_links_manager_all on public.share_links;

create policy share_links_manager_all on public.share_links
  for all to authenticated
  using (public.is_household_manager(household_id))
  with check (public.is_household_manager(household_id));

-- claim pucks: editor select only (secret_hex is on the row)
drop policy if exists pucks_member_select on public.pucks;
drop policy if exists pucks_editor_select on public.pucks;

create policy pucks_editor_select on public.pucks
  for select to authenticated
  using (public.is_household_editor(household_id));

-- claims pack exports: managers only (token + pack_data)
drop policy if exists claims_pack_exports_member_select on public.claims_pack_exports;
drop policy if exists claims_pack_exports_manager_select on public.claims_pack_exports;

create policy claims_pack_exports_manager_select on public.claims_pack_exports
  for select to authenticated
  using (public.is_household_manager(household_id));

-- household invites: managers only (invite tokens)
drop policy if exists household_invites_member_select on public.household_invites;
drop policy if exists household_invites_manager_select on public.household_invites;

create policy household_invites_manager_select on public.household_invites
  for select to authenticated
  using (public.is_household_manager(household_id));
