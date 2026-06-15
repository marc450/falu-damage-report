-- Falu Mängelprotokoll — admin-editable machine list
-- Run once in the Supabase SQL editor (project xasehavpvasplrhvwyuu).
-- Backs the "Machine type" dropdown with a table that admins manage via #/machines.
-- Any logged-in user can read it; only admins (is_admin()) can write. Safe to re-run.

-- 1) Table
create table if not exists public.falu_machines (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists falu_machines_name_key
  on public.falu_machines (lower(name));

alter table public.falu_machines enable row level security;

-- 2) RLS — read for all authenticated users, write for admins only
drop policy if exists "falu_machines select" on public.falu_machines;
create policy "falu_machines select" on public.falu_machines
  for select to authenticated using ( true );

drop policy if exists "falu_machines admin write" on public.falu_machines;
create policy "falu_machines admin write" on public.falu_machines
  for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

-- 3) Seed with the current list (keeps the existing curated order via sort).
--    Re-running is a no-op thanks to the unique name index.
insert into public.falu_machines (name, sort) values
  ('CB1',1),('CT-200',2),('CT-2000',3),('CT-3000',4),('SV-2X',5),('BV-2M',6),
  ('ABS-2',7),('RB-2',8),('RB-30A',9),('SQB-2A',10),('BL-12',11),('BL-16',12),
  ('WR-600',13),('VP-2',14),('WI',15),('WI-2000',16)
on conflict (lower(name)) do nothing;
