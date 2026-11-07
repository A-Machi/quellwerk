-- Quellwerk: Grundschema für das MVP
-- Notebooks, Quellen, Chunks mit Embeddings (bge-m3, 1024 Dimensionen), Chatverlauf,
-- Row Level Security, Storage-Bucket und Ähnlichkeitssuche.
--
-- "Automatically expose new tables" ist im Projekt aus. Darum bekommt jede Tabelle
-- unten ausdrückliche GRANTs, sonst ist sie über die Data API nicht erreichbar.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Hilfsfunktion: updated_at automatisch setzen
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Unbenanntes Notebook'
    check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('pdf', 'text')),
  title text not null check (char_length(title) between 1 and 300),
  -- Pfad im Bucket "sources": {user_id}/{notebook_id}/{source_id}.pdf bzw. .txt
  storage_path text not null,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed')),
  error text,
  page_count integer check (page_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  -- null bei Text-Quellen ohne Seiten
  page_number integer check (page_number >= 1),
  content text not null,
  token_count integer not null check (token_count >= 0),
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now(),
  unique (source_id, chunk_index)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- [{ "n": 1, "chunk_id": "...", "source_id": "...", "page_number": 3 }, ...]
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indizes
-- ---------------------------------------------------------------------------

create index notebooks_user_id_idx on public.notebooks (user_id);
create index sources_notebook_id_idx on public.sources (notebook_id);
create index sources_user_id_idx on public.sources (user_id);
create index chunks_user_id_idx on public.chunks (user_id);
create index messages_notebook_id_created_at_idx on public.messages (notebook_id, created_at);
create index messages_user_id_idx on public.messages (user_id);

-- Vektorsuche nach Kosinus-Ähnlichkeit
create index chunks_embedding_idx on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------

create trigger notebooks_set_updated_at
  before update on public.notebooks
  for each row execute function public.set_updated_at();

create trigger sources_set_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: jeder Nutzer sieht und ändert nur eigene Zeilen
-- ---------------------------------------------------------------------------

alter table public.notebooks enable row level security;
alter table public.sources enable row level security;
alter table public.chunks enable row level security;
alter table public.messages enable row level security;

-- notebooks
create policy "notebooks_select_own" on public.notebooks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notebooks_insert_own" on public.notebooks
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "notebooks_update_own" on public.notebooks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notebooks_delete_own" on public.notebooks
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- sources: beim Anlegen muss auch das Notebook dem Nutzer gehören
create policy "sources_select_own" on public.sources
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "sources_insert_own" on public.sources
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.notebooks n
      where n.id = notebook_id and n.user_id = (select auth.uid())
    )
  );

create policy "sources_update_own" on public.sources
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "sources_delete_own" on public.sources
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- chunks: werden nur angelegt und gelöscht, nie geändert
create policy "chunks_select_own" on public.chunks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "chunks_insert_own" on public.chunks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.sources s
      where s.id = source_id and s.user_id = (select auth.uid())
    )
  );

create policy "chunks_delete_own" on public.chunks
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- messages: werden nur angelegt und gelöscht ("Chat leeren")
create policy "messages_select_own" on public.messages
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "messages_insert_own" on public.messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.notebooks n
      where n.id = notebook_id and n.user_id = (select auth.uid())
    )
  );

create policy "messages_delete_own" on public.messages
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Rechte für die Data API (nur eingeloggte Nutzer, nie anonym)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.notebooks to authenticated;
grant select, insert, update, delete on public.sources to authenticated;
grant select, insert, delete on public.chunks to authenticated;
grant select, insert, delete on public.messages to authenticated;

grant all on public.notebooks, public.sources, public.chunks, public.messages to service_role;

-- ---------------------------------------------------------------------------
-- Ähnlichkeitssuche über die ausgewählten Quellen
-- security invoker: läuft mit den Rechten des Nutzers, RLS greift also auch hier.
-- iterative_scan sorgt dafür, dass trotz Filter auf source_ids genug Treffer kommen.
-- ---------------------------------------------------------------------------

create function public.match_chunks(
  query_embedding extensions.vector(1024),
  source_ids uuid[],
  match_count integer default 10
)
returns table (
  id uuid,
  source_id uuid,
  chunk_index integer,
  page_number integer,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
set hnsw.iterative_scan = strict_order
as $$
  select
    c.id,
    c.source_id,
    c.chunk_index,
    c.page_number,
    c.content,
    1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.chunks c
  where c.source_id = any (source_ids)
  order by c.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

revoke execute on function public.match_chunks(extensions.vector, uuid[], integer) from public, anon;
grant execute on function public.match_chunks(extensions.vector, uuid[], integer) to authenticated, service_role;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: privater Bucket für PDFs und Text-Quellen, max. 50 MB pro Datei
-- Ordnerstruktur: {user_id}/{notebook_id}/{source_id}.pdf
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sources', 'sources', false, 52428800, array['application/pdf', 'text/plain']);

create policy "sources_bucket_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "sources_bucket_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "sources_bucket_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
