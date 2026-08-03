-- Bucket pubblico per i loghi delle squadre fantasy.
-- Esegui questo SQL nella SQL Editor di Supabase (Dashboard → SQL)
-- dopo aver creato il progetto / insieme al deploy della migration Prisma.
--
-- Alternativa Dashboard:
--   Storage → New bucket → name: team-logos → Public bucket: ON
-- poi esegui solo le policy sotto (se non usi insert bucket via SQL).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-logos',
  'team-logos',
  true,
  5242880,
  array['image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Gli upload avvengono server-side con SUPABASE_SERVICE_ROLE_KEY
-- (bypass RLS). Le policy sotto consentono lettura pubblica e
-- bloccano write/delete da client anon/authenticated.

drop policy if exists "team_logos_public_read" on storage.objects;
create policy "team_logos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'team-logos');

drop policy if exists "team_logos_no_client_insert" on storage.objects;
create policy "team_logos_no_client_insert"
on storage.objects
for insert
to authenticated, anon
with check (false);

drop policy if exists "team_logos_no_client_update" on storage.objects;
create policy "team_logos_no_client_update"
on storage.objects
for update
to authenticated, anon
using (false)
with check (false);

drop policy if exists "team_logos_no_client_delete" on storage.objects;
create policy "team_logos_no_client_delete"
on storage.objects
for delete
to authenticated, anon
using (false);
