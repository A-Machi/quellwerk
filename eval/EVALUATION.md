# NotebookLM-Klon – Evaluation

Ziel dieses Dokuments ist, vor dem ersten Code zu klären, **was** wir bauen (Scope), **womit** (Tech Stack) und **welche offenen Entscheidungen** es noch gibt. Ausgangspunkt ist der vorgeschlagene Stack; zu jedem Punkt steht eine Bewertung und, wo sinnvoll, eine Alternative.

Status: Entwurf · Stand: 2026-11-07

> **Teilweise überholt (2026-11-07).** Verbindlich ist [CLAUDE.md](../CLAUDE.md). Gemini fällt weg, weil es proprietär ist. Stattdessen laufen offene Modelle über Cloudflare Workers AI Free, und die Embeddings kommen von bge-m3 mit 1024 statt 768 Dimensionen. Vercel Hobby und Supabase Free bleiben, Docker wird nicht genutzt. Weiter gültig sind die Hinweise zum Upload-Limit (2.4), zum Chunking (2.5), zur RAG-Pipeline (3) und zur langen Verarbeitung (4).

---

## 1. Was ist NotebookLM eigentlich? (Feature-Inventar)

Bevor wir den Stack bewerten, müssen wir wissen, welche Features wir nachbauen wollen.

| Feature | Beschreibung | MVP? |
|---|---|---|
| Notebooks | Projekte, die mehrere Quellen bündeln | ✅ |
| Quellen hochladen | PDF, später Text, URL, Google Docs, Audio | ✅ (nur PDF + Text) |
| Quellen-Auswahl | Checkbox pro Quelle, welche in den Chat einfließen | ✅ |
| Chat mit Quellenangaben | Antwort mit klickbaren Zitaten `[1]`, die zur Textstelle springen | ✅ |
| Quellen-Zusammenfassung | Automatische Kurzfassung + Schlüsselthemen beim Upload | ✅ |
| Notizen | Antworten als Notiz speichern, eigene Notizen schreiben | ⚪ Phase 2 |
| Studio-Ausgaben | Study Guide, FAQ, Briefing, Timeline, Mind Map | ⚪ Phase 2 |
| Audio Overview | Podcast mit zwei Stimmen über die Quellen | ⚪ Phase 3 |
| Teilen / Kollaboration | Notebook mit anderen teilen | ⚪ Phase 3 |
| Mehrbenutzer / Login | Jeder sieht nur seine Notebooks | ✅ (wenn öffentlich deployed) |

**Entscheidung offen:** Ist das ein Lernprojekt für mich allein (kein Login nötig) oder soll es öffentlich laufen (Auth + Rate Limits + Kostenkontrolle Pflicht)?

---

## 2. Bewertung des vorgeschlagenen Stacks

### 2.1 Frontend

| Komponente | Bewertung | Anmerkung |
|---|---|---|
| Next.js 15 | ✅ passt | **Prüfen:** Next.js 16 ist bereits erschienen. Für ein neues Projekt die aktuelle Major-Version nehmen (`create-next-app@latest`). App Router verwenden. |
| TypeScript | ✅ passt | Strict Mode an. |
| Tailwind CSS | ✅ passt | Tailwind v4 (CSS-first Config). |
| shadcn/ui | ✅ passt | Gut für das 3-Spalten-Layout (Quellen · Chat · Studio). `Resizable`, `ScrollArea`, `Dialog`, `Sheet` sind direkt nützlich. |

**Fehlt noch:**
- **Vercel AI SDK** (`ai` + `@ai-sdk/google`) – Streaming-Chat, `useChat`-Hook, einheitliche API für Gemini. Spart viel Boilerplate.
- **PDF-Viewer** zum Springen an die zitierte Stelle: `react-pdf` (basiert auf pdfjs-dist).
- **Markdown-Rendering** der Antworten: `react-markdown` + `remark-gfm`.
- **State/Data-Fetching:** TanStack Query oder Server Components + Server Actions (reicht wahrscheinlich).

### 2.2 Backend

| Komponente | Bewertung | Anmerkung |
|---|---|---|
| Next.js API Routes | ✅ passt mit Einschränkung | Für Chat und kleine Uploads ideal. **Problem:** Lange Verarbeitung großer PDFs (Extrahieren + Embeddings für hunderte Chunks) kann an das Timeout von Vercel Functions stoßen. Siehe Abschnitt 4. |
| TypeScript | ✅ passt | Typen zwischen Frontend, API und DB teilen (`supabase gen types`). |

**Fehlt noch:**
- **Validierung:** `zod` für Request-Bodies und LLM-Structured-Output.
- **Hintergrund-Jobs** für die Ingestion (Optionen in Abschnitt 4).

### 2.3 KI / LLM

| Komponente | Bewertung | Anmerkung |
|---|---|---|
| Gemini 2.5 Flash | ✅ passt, aber prüfen | Günstig, schnell, 1M Token Kontext. **Prüfen:** Es gibt neuere Flash-Modelle (Gemini 3 Flash). Beim Start aktuelle Modellliste und Preise auf ai.google.dev checken. Modellname als Env-Variable, damit ein Wechsel nur Config ist. |
| Gemini Embeddings | ✅ passt | `gemini-embedding-001` liefert standardmäßig 3072 Dimensionen, lässt sich aber auf **768 oder 1536** kürzen (Matryoshka). Wichtig wegen pgvector-Indexlimit, siehe 2.4. `taskType` setzen: `RETRIEVAL_DOCUMENT` beim Speichern, `RETRIEVAL_QUERY` bei der Suche. |

**Wichtige Alternative, die wir bewerten sollten:**
- **Gemini File Search API** – Google bietet inzwischen managed RAG an (Upload, Chunking, Embeddings, Suche, Zitate). Würde Schritte 2–6 der Pipeline komplett ersetzen. Vorteil: viel weniger Code. Nachteil: weniger Kontrolle, Lock-in, man lernt RAG nicht selbst.
- **Long Context statt RAG** – Bei kleinen Notebooks (< ca. 200k Token) kann man die Quellen einfach komplett in den Prompt geben (mit Context Caching). Bessere Antworten, kein Retrieval-Fehler. Hybrid denkbar: klein → Full Context, groß → RAG.

**Entscheidung offen:** Eigene RAG-Pipeline (Lerneffekt, Kontrolle) vs. File Search API (Tempo)?

### 2.4 Datenbank & Storage

| Komponente | Bewertung | Anmerkung |
|---|---|---|
| Supabase PostgreSQL | ✅ passt | Eine DB für Daten + Vektoren + Auth. |
| pgvector | ✅ passt | **Achtung:** HNSW-Index unterstützt beim Typ `vector` max. 2000 Dimensionen. Also Embeddings auf 768 oder 1536 kürzen, oder `halfvec` (bis 4000) nutzen. |
| Supabase Storage | ✅ passt | **Achtung:** Vercel Functions haben ein Body-Limit von ca. 4,5 MB. PDFs deshalb **direkt aus dem Browser** zu Supabase Storage hochladen (Signed Upload URL), nicht durch die API Route schleusen. |

**Fehlt noch:**
- **Supabase Auth** (falls Login, siehe 1).
- **Row Level Security (RLS)** auf allen Tabellen, damit Nutzer nur ihre Notebooks sehen.
- **Volltextsuche** (`tsvector`) für **Hybrid Search** (Vektor + Keyword). Hilft enorm bei Eigennamen, Zahlen, Fachbegriffen, die Embeddings schlecht treffen.

### 2.5 Dokumentenverarbeitung

| Option | Pro | Contra |
|---|---|---|
| `pdf-parse` | Einfach, ein Aufruf | Wenig gepflegt, keine Seiteninfos ohne Tricks |
| `pdfjs-dist` / `unpdf` | Text **pro Seite** → Seitenzahl für Zitate | Etwas mehr Code. `unpdf` ist ein serverless-freundlicher Wrapper. |
| Gemini direkt (PDF als Input) | Kann auch **gescannte PDFs**, Tabellen, Bilder | Kostet Tokens, langsamer |

**Empfehlung:** `unpdf` (oder `pdfjs-dist`) für normale PDFs, Fallback auf Gemini, wenn kaum Text extrahiert wird (Scan erkannt).

**Chunking-Logik – zu entscheiden:**
- Chunk-Größe: Startwert ca. 800–1000 Token, 10–15 % Overlap
- An Absatz- und Satzgrenzen schneiden, nicht mitten im Wort
- Pro Chunk speichern: `source_id`, `page_number`, `chunk_index`, `content`, `token_count`, `embedding`
- Optional später: Überschriften als Kontext voranstellen

---

## 3. RAG-Pipeline – Bewertung der Schritte

| # | Schritt | Bewertung / Ergänzung |
|---|---|---|
| 1 | PDF hochladen | Direkt zu Supabase Storage (siehe 2.4). Danach Eintrag in `sources` mit Status `uploaded`. |
| 2 | Text extrahieren | Seitenweise, damit Zitate Seitenzahlen haben. |
| 3 | In Chunks aufteilen | Siehe 2.5. |
| 4 | Embeddings erzeugen | **Batch-Calls** (mehrere Chunks pro Request), Rate Limits beachten, Retry mit Backoff. |
| 5 | In pgvector speichern | Status der Quelle auf `ready` setzen. Fehler → `failed` + Meldung im UI. |
| 6 | Ähnliche Chunks suchen | Als Postgres-Funktion (`match_chunks`) via RPC. **Filter auf ausgewählte Quellen** des Notebooks. Top-k ca. 8–15. Hybrid Search ergänzen. |
| 7 | Kontext an Gemini senden | Chunks nummeriert in den Prompt (`[1] … [2] …`). System-Prompt: nur aus Quellen antworten, sonst sagen „steht nicht in den Quellen“. |
| 8 | Antwort mit Quellen zurückgeben | Gestreamt. Zitat-Marker `[n]` im Frontend auf Chunk → Quelle + Seite mappen und klickbar machen. |

**Fehlende Schritte:**
- **0. Quellen-Zusammenfassung** nach der Ingestion (für die Quellen-Übersicht wie in NotebookLM).
- **Chat-Verlauf** speichern und bei Folgefragen die Frage umformulieren (Query Rewriting), damit „und was sagt er dazu?“ sinnvoll gesucht wird.
- **Optional: Re-Ranking** der gefundenen Chunks (später, wenn Qualität nicht reicht).

---

## 4. Kritischer Punkt: Lange Verarbeitung auf Vercel

Ein 300-Seiten-PDF bedeutet hunderte Chunks und viele Embedding-Calls. Das kann länger dauern als eine Function laufen darf (Limits hängen vom Vercel-Plan ab, **beim Start prüfen**).

| Option | Aufwand | Anmerkung |
|---|---|---|
| Alles in einer API Route | gering | Reicht für kleine PDFs im MVP. Status-Polling im UI. |
| `after()` aus Next.js | gering | Antwort sofort zurück, Verarbeitung läuft danach weiter – unterliegt aber trotzdem dem Function-Timeout. |
| Supabase Edge Function + DB-Trigger | mittel | Bleibt im Supabase-Ökosystem. |
| Job-Queue (Inngest, Trigger.dev, QStash) | mittel | Robust, Retries, Schritte einzeln. Beste Lösung für große Dateien. |

**Empfehlung:** MVP mit einfacher API Route + Status-Feld, Umstieg auf eine Queue, sobald große PDFs scheitern.

---

## 5. Datenmodell (erster Entwurf)

```
notebooks   (id, user_id, title, created_at)
sources     (id, notebook_id, type, title, storage_path, status, summary, page_count, created_at)
chunks      (id, source_id, chunk_index, page_number, content, token_count, embedding vector(768), fts tsvector)
messages    (id, notebook_id, role, content, citations jsonb, created_at)
notes       (id, notebook_id, content, created_at)            -- Phase 2
```

---

## 6. Deployment

| Komponente | Bewertung | Anmerkung |
|---|---|---|
| Vercel | ✅ passt | Function-Timeouts und Body-Limit beachten (Abschnitte 2.4 und 4). |
| Supabase Cloud | ✅ passt | Free-Tier pausiert Projekte nach Inaktivität – für Demo okay, für echten Betrieb Pro-Plan. |

**Fehlt noch:**
- **Env-Variablen:** `GOOGLE_GENERATIVE_AI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (nur serverseitig!), `GEMINI_CHAT_MODEL`, `GEMINI_EMBEDDING_MODEL`
- **Supabase Migrations** im Repo (`supabase/migrations`), nicht im Dashboard klicken.
- **Lokale Entwicklung:** Supabase CLI (`supabase start`, braucht Docker) oder direkt gegen ein Dev-Projekt in der Cloud.

---

## 7. Kosten & Limits (zu recherchieren)

- [ ] Gemini Free Tier: Requests/Minute und Tokens/Tag für Chat- und Embedding-Modell
- [ ] Gemini Paid: Preis pro 1M Input/Output Token, Preis Embeddings
- [ ] Achtung: Im Free Tier darf Google Daten zur Verbesserung nutzen – für vertrauliche Dokumente Paid Tier
- [ ] Supabase Free: 500 MB DB, 1 GB Storage – reicht das für Vektoren? (768 Dim × 4 Byte ≈ 3 KB pro Chunk)
- [ ] Vercel Hobby: Function-Laufzeit, kommerzielle Nutzung nicht erlaubt

---

## 8. Offene Entscheidungen (Zusammenfassung)

| # | Frage | Optionen | Entscheidung |
|---|---|---|---|
| 1 | Zielgruppe | Nur ich · öffentlich mit Login | |
| 2 | RAG selbst bauen? | Eigene Pipeline · Gemini File Search · Hybrid mit Long Context | |
| 3 | Chat-Modell | Gemini 2.5 Flash · neueres Flash-Modell | |
| 4 | Embedding-Dimension | 768 · 1536 | |
| 5 | PDF-Parser | unpdf/pdfjs-dist · pdf-parse · Gemini | |
| 6 | Hintergrund-Jobs | API Route · Edge Function · Queue | |
| 7 | MVP-Scope | Nur Chat mit Zitaten · + Zusammenfassungen · + Studio | |
| 8 | Quellentypen im MVP | Nur PDF · PDF + Text · + URL | |

---

## 9. Vorschlag MVP (Phase 1)

1. Next.js-Projekt mit Tailwind + shadcn/ui aufsetzen, 3-Spalten-Layout
2. Supabase: Tabellen, pgvector, RLS, Storage-Bucket, Auth
3. Upload direkt zu Storage → Ingestion-Route (extrahieren, chunken, embedden, speichern)
4. Quellenliste mit Status und Checkboxen
5. Chat mit Streaming (AI SDK), Retrieval über ausgewählte Quellen, Zitate `[n]`
6. Klick auf Zitat öffnet PDF an der richtigen Seite
7. Deployment Vercel + Supabase Cloud

**Phase 2:** Notizen, Quellen-Zusammenfassungen, Study Guide / FAQ / Briefing, Hybrid Search
**Phase 3:** Audio Overview (Gemini TTS mit zwei Stimmen), Teilen, weitere Quellentypen
