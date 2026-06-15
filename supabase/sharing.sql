-- Falu Mängelprotokoll — report sharing
-- Run once in the Supabase SQL editor (project xasehavpvasplrhvwyuu).
-- Adds report sharing: a report can be shared with other members by e-mail.
-- Shared members get VIEW + EDIT access (not delete). Anyone with access may re-share.
-- All policies are additive (permissive, OR'd with existing ones) — safe to re-run.

-- 1) Column holding the e-mails a report is shared with.
alter table public.falu_reports
  add column if not exists shared_with text[] not null default '{}';

-- 2) Reports table: shared members can SELECT (see it in their overview / open it)
--    and UPDATE (edit + re-share). DELETE stays owner/admin only (unchanged).
drop policy if exists "falu_reports shared select" on public.falu_reports;
create policy "falu_reports shared select" on public.falu_reports
  for select to authenticated
  using ( (auth.jwt() ->> 'email') = any(shared_with) );

drop policy if exists "falu_reports shared update" on public.falu_reports;
create policy "falu_reports shared update" on public.falu_reports
  for update to authenticated
  using      ( (auth.jwt() ->> 'email') = any(shared_with) )
  with check ( (auth.jwt() ->> 'email') = any(shared_with) );

-- 3) Storage: anyone who can see a report can read its photos.
--    Photo paths are {userId}/{reportId}/file.jpg, so segment [2] is the report id.
--    (Uploads stay under each editor's own folder, covered by the existing
--     "own folder" insert policy — no extra write policy needed.)
drop policy if exists "falu photos shared select" on storage.objects;
create policy "falu photos shared select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'falu-report-photos'
    and exists (
      select 1 from public.falu_reports r
      where r.id::text = (storage.foldername(name))[2]
        and (
          r.created_by = auth.uid()
          or (auth.jwt() ->> 'email') = any(r.shared_with)
          or public.is_admin()
        )
    )
  );
