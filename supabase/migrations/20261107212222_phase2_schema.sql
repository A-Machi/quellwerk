-- Quellwerk Phase 2: Zusammenfassungen, Notizen und Studio-Ausgaben, Verbrauchsprotokoll,
-- Volltextsuche für die Hybrid-Suche.
-- Wie in der ersten Migration: ausdrückliche GRANTs, RLS auf jeder Tabelle.

-- ---------------------------------------------------------------------------
-- US-14: Zusammenfassung pro Quelle
-- ---------------------------------------------------------------------------

alter table public.sources
  add column summary text,
  add column key_topics text[] not null default '{}',
  add column summary_status text not null default 'none'
    check (summary_status in ('none', 'pending', 'ready', 'failed'));

-- ---------------------------------------------------------------------------
-- US-15 bis US-19: Notizen und Studio-Ausgaben in einer Tabelle
-- ---------------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('note', 'study_guide', 'faq', 'briefing', 'timeline')),
  title text not null check (char_length(title) between 1 and 300),
  content text not null check (char_length(content) <= 100000),
  citations jsonb not null default '[]'::jsonb,
  source_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_notebook_id_created_at_idx on public.notes (notebook_id, created_at);
create index notes_user_id_idx on public.notes (user_id);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

create policy "notes_select_own" on public.notes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notes_insert_own" on public.notes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.notebooks n
      where n.id = notebook_id and n.user_id = (select auth.uid())
    )
  );

create policy "notes_update_own" on public.notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notes_delete_own" on public.notes
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;

-- ---------------------------------------------------------------------------
-- V-09 / US-21: Verbrauch von Workers AI protokollieren
-- ---------------------------------------------------------------------------

create table public.usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('chat', 'rewrite', 'embedding', 'summary', 'studio')),
  neurons numeric(12, 4) not null check (neurons >= 0),
  -- true, wenn Cloudflare keinen Verbrauch meldet und er aus Token und Preis geschätzt wurde
  estimated boolean not null default false,
  created_at timestamptz not null default now()
);

create index usage_log_user_id_created_at_idx on public.usage_log (user_id, created_at);

alter table public.usage_log enable row level security;

create policy "usage_log_select_own" on public.usage_log
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "usage_log_insert_own" on public.usage_log
  for insert to authenticated
  with check (user_id = (select auth.uid()));

grant select, insert on public.usage_log to authenticated;
grant all on public.usage_log to service_role;

-- Verbrauch des eingeloggten Nutzers seit 0:00 UTC (dann setzt Cloudflare das Kontingent zurück)
create function public.usage_today()
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(u.neurons), 0)
  from public.usage_log u
  where u.user_id = (select auth.uid())
    and u.created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
$$;

revoke execute on function public.usage_today() from public, anon;
grant execute on function public.usage_today() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- US-20: Hybrid-Suche (Vektor + Volltext, zusammengeführt per Reciprocal Rank Fusion)
-- 'simple' statt 'german': viele Quellen sind englisch oder gemischt. Stoppwörter
-- entfernt die App, bevor sie die Suchbegriffe übergibt.
-- ---------------------------------------------------------------------------

alter table public.chunks
  add column fts tsvector generated always as (to_tsvector('simple', content)) stored;

create index chunks_fts_idx on public.chunks using gin (fts);

create function public.match_chunks_hybrid(
  query_embedding extensions.vector(1024),
  query_terms text[],
  source_ids uuid[],
  match_count integer default 10
)
returns table (
  id uuid,
  source_id uuid,
  chunk_index integer,
  page_number integer,
  content text,
  similarity double precision,
  score double precision
)
language sql
stable
security invoker
set search_path = ''
set hnsw.iterative_scan = strict_order
as $$
  with params as (
    select least(greatest(match_count, 1), 50) as k
  ),
  query as (
    -- Suchbegriffe mit ODER verknüpfen: ein Treffer auf einen seltenen Begriff reicht
    select to_tsquery('simple', string_agg(quote_literal(lower(term)), ' | ')) as q
    from unnest(query_terms) as term
    where length(trim(term)) > 0
  ),
  semantic as (
    select c.id, row_number() over (order by c.embedding operator(extensions.<=>) query_embedding) as rank
    from public.chunks c
    where c.source_id = any (source_ids)
    order by c.embedding operator(extensions.<=>) query_embedding
    limit (select k * 2 from params)
  ),
  keyword as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, query.q) desc) as rank
    from public.chunks c, query
    where c.source_id = any (source_ids) and c.fts @@ query.q
    order by ts_rank_cd(c.fts, query.q) desc
    limit (select k * 2 from params)
  ),
  fused as (
    select coalesce(s.id, kw.id) as id,
           coalesce(1.0 / (60 + s.rank), 0) + coalesce(1.0 / (60 + kw.rank), 0) as score
    from semantic s
    full outer join keyword kw on kw.id = s.id
  )
  select
    c.id,
    c.source_id,
    c.chunk_index,
    c.page_number,
    c.content,
    1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity,
    f.score
  from fused f
  join public.chunks c on c.id = f.id
  order by f.score desc
  limit (select k from params);
$$;

revoke execute on function public.match_chunks_hybrid(extensions.vector, text[], uuid[], integer) from public, anon;
grant execute on function public.match_chunks_hybrid(extensions.vector, text[], uuid[], integer) to authenticated, service_role;
