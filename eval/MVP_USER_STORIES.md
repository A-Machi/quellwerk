# MVP – User Stories und Voraussetzungen

Stand: 2026-11-07 · Grundlage: [CLAUDE.md](../CLAUDE.md) (Open Source, keine Kosten, keine Lizenzverstöße, alles in der Cloud)

## Annahmen für das MVP

- **Privat, ein Nutzer.** Weil die App öffentlich im Netz erreichbar ist, gibt es trotzdem einen Login. Die öffentliche Registrierung ist aus, sonst könnte jeder die Free-Tier-Kontingente verbrauchen.
- **Quellen:** PDFs mit echtem Text. Gescannte PDFs (ohne Textschicht) werden erkannt und mit Hinweis abgelehnt, OCR kommt später.
- **Alles in der Cloud:** Vercel Hobby (App), Supabase Free (DB, Dateien, Login), Cloudflare Workers AI Free (Modelle). Kein Docker, nichts Lokales außer `npm run dev`.

---

## Teil A – Was vorher stehen muss

Diese Punkte sind keine Features, aber ohne sie funktioniert keine User Story. Reihenfolge = Bearbeitungsreihenfolge.

### Ist-Zustand der Maschine (geprüft am 2026-11-07)

| Komponente | Status | Bewertung |
|---|---|---|
| Node.js | v24 (über nvm4w) | ✅ reicht für `npm run dev` und Builds |
| Git | installiert | ✅ |
| Docker Desktop | installiert | Wird **nicht gebraucht**. Kann deinstalliert werden. |
| Ollama, lokale GPU | – | Wird nicht gebraucht |

### V-01 – Projektname festlegen
Der Name „NotebookLM“ ist eine Marke von Google und darf nicht verwendet werden.
- [x] Eigener Projektname gewählt: **Quellwerk** (2026-11-07)
- [x] Name in `package.json`, UI-Titel und README verwendet

### V-02 – Accounts anlegen, ohne Zahlungsmittel
- [x] GitHub-Account, privates Repository für das Projekt: https://github.com/A-Machi/quellwerk
- [x] Vercel-Account (Hobby), mit GitHub verbunden
- [x] Supabase-Account (Free)
- [x] Cloudflare-Account (Free)
- [x] **Bei keinem Dienst eine Karte hinterlegt.** Nach dem Anlegen in den Billing-Einstellungen aller vier Dienste kontrolliert. (2026-11-07)

### V-03 – Supabase-Projekt einrichten
- [x] Projekt in einer EU-Region angelegt: Frankfurt (eu-central-1)
- [x] Supabase CLI installiert (`npm i -D supabase`, v3.0.0, MIT), Projekt mit `supabase link` verbunden, **ohne** `supabase start`
- [x] Erste Migration über `supabase db push --remote` (`supabase/migrations/20261107154610_initial_schema.sql`):
  - Extension `vector` aktiviert
  - Tabellen `notebooks`, `sources`, `chunks`, `messages`, jeweils mit `user_id`
  - `chunks.embedding vector(1024)` passend zu bge-m3, HNSW-Index darauf
  - Postgres-Funktion `match_chunks(query_embedding, source_ids, match_count)` für die Ähnlichkeitssuche
- [x] **Row Level Security** auf allen Tabellen: Nutzer sieht nur Zeilen mit eigener `user_id`. Supabase-Advisor: 0 Sicherheitswarnungen.
- [x] Privater Storage-Bucket `sources` mit Policies (Zugriff nur auf eigene Dateien, PDF und Text, max. 50 MB)
- [x] Auth: E-Mail-Login aktiviert, **öffentliche Registrierung deaktiviert**, anonyme Logins aus, eigener Nutzer im Dashboard angelegt und bestätigt

### V-04 – Cloudflare Workers AI einrichten
- [ ] API-Token erstellt, der **nur** die Berechtigung „Workers AI“ hat
- [ ] Testaufruf Embedding mit `@cf/baai/bge-m3` liefert 1024 Zahlen
- [ ] 2–3 Chat-Modelle mit Apache-2.0-Lizenz getestet (Kandidaten in CLAUDE.md), mit deutschen Fragen zu einem Testtext. Bestes Modell ausgewählt.
- [ ] Lizenz des gewählten Modells auf der Cloudflare-Modellseite und auf Hugging Face bestätigt
- [ ] **Verbrauch gemessen:** Wie viele Neurons kostet eine Chat-Antwort, wie viele das Einbetten von 100 Seiten? Daraus abgeschätzt, wie viel pro Tag im Free Tier möglich ist.

### V-05 – Next.js-Grundgerüst und erstes Deployment
- [x] Projekt mit aktueller Next.js-Version (16.4.5), TypeScript (strict), Tailwind v4, App Router
- [x] shadcn/ui initialisiert (Base UI, Komponenten in `src/frontend/components/ui`)
- [x] Supabase-Client für Browser und Server (`@supabase/ssr`)
- [x] AI SDK (`ai` + `@ai-sdk/openai-compatible`) gegen Workers AI angebunden (Test mit echtem Token folgt in V-04)
- [x] Leeres 3-Spalten-Layout: Quellen · Chat · (Platzhalter Studio)
- [x] Ordnerstruktur `src/app` · `src/frontend` · `src/backend`, Backend mit `server-only` geschützt
- [x] Repo in Vercel importiert (Team A-Team, Hobby), erstes Deployment erreichbar
- [ ] Env-Variablen in Vercel gesetzt (folgt nach V-03 und V-04)

### V-06 – Konfiguration und Lizenzen
- [x] `.env.example` mit `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CHAT_MODEL`, `EMBEDDING_MODEL`
- [x] `.env.local` in `.gitignore`
- [x] `THIRD_PARTY_LICENSES.md` angelegt, jede Abhängigkeit eingetragen, alle 642 Pakete geprüft
- [x] Lizenz für das eigene Projekt gewählt: **MIT**, Datei `LICENSE` angelegt (2026-11-07)

---

## Teil B – User Stories

Format: *Als Nutzer möchte ich …, damit …* · Größe: S (< 1 Tag), M (1–2 Tage), L (3+ Tage) · Priorität nach MoSCoW

### Epic 0 – Zugang

#### US-00 – Einloggen · S · Must
Als Nutzer möchte ich mich einloggen, damit niemand anderes meine Notebooks sieht oder meine Free-Tier-Kontingente verbraucht.
- [ ] Login-Seite mit E-Mail und Passwort (Supabase Auth)
- [ ] Alle anderen Seiten und API Routes sind ohne Login gesperrt
- [ ] Logout-Button

*Braucht:* V-03, V-05

### Epic 1 – Notebooks

#### US-01 – Notebook anlegen · S · Must
Als Nutzer möchte ich ein neues Notebook mit einem Titel anlegen, damit ich Quellen zu einem Thema bündeln kann.
- [ ] Button „Neues Notebook“ auf der Startseite
- [ ] Titel ist editierbar, Standard „Unbenanntes Notebook“
- [ ] Nach dem Anlegen öffnet sich das Notebook

*Braucht:* US-00

#### US-02 – Notebooks verwalten · S · Must
Als Nutzer möchte ich alle Notebooks sehen, öffnen, umbenennen und löschen, damit ich den Überblick behalte.
- [ ] Startseite zeigt alle Notebooks mit Titel, Anzahl Quellen, Datum
- [ ] Löschen fragt nach Bestätigung und entfernt Quellen, Chunks, Dateien und Chatverlauf mit

*Braucht:* US-01

### Epic 2 – Quellen

#### US-03 – PDF hochladen · M · Must
Als Nutzer möchte ich ein oder mehrere PDFs in ein Notebook hochladen, damit ich Fragen dazu stellen kann.
- [ ] Upload per Button und Drag & Drop
- [ ] Nur PDF erlaubt, max. 50 MB pro Datei (Limit von Supabase Free)
- [ ] Datei geht **direkt vom Browser** in den Storage-Bucket (Signed Upload URL), nicht durch eine API Route
- [ ] Eintrag in `sources` mit Status `uploaded`

*Braucht:* US-01, V-03

#### US-04 – PDF wird verarbeitet · L · Must
Als Nutzer möchte ich, dass das PDF nach dem Upload automatisch durchsuchbar gemacht wird, damit der Chat es verwenden kann.
- [ ] API Route auf Vercel lädt das PDF aus dem Storage und extrahiert den Text **seitenweise** (unpdf oder pdfjs-dist)
- [ ] Text wird in Chunks geteilt (ca. 800 Token, ca. 100 Token Overlap, an Absatzgrenzen)
- [ ] Embeddings über Workers AI (bge-m3) in Batches erzeugt und in `chunks` gespeichert
- [ ] Status wechselt `uploaded → processing → ready`, bei Fehler `failed` mit Grund
- [ ] PDF ohne Textschicht → `failed` mit Hinweis „Gescanntes PDF, wird noch nicht unterstützt“
- [ ] Tageslimit von Workers AI erreicht → `failed` mit Hinweis „Tageslimit erreicht, morgen erneut versuchen“ und Button „Erneut verarbeiten“
- [ ] Verarbeitung bleibt innerhalb der Function-Laufzeit von Vercel Hobby. Falls nötig: maximale Seitenzahl fürs MVP festlegen (Wert nach Messung in V-04).

*Braucht:* US-03, V-04

#### US-05 – Verarbeitungsstatus sehen · S · Must
Als Nutzer möchte ich sehen, ob eine Quelle noch verarbeitet wird oder fertig ist, damit ich weiß, wann ich fragen kann.
- [ ] Quellenliste zeigt Status (Spinner, Haken, Fehler-Icon mit Grund)
- [ ] Status aktualisiert sich ohne Neuladen der Seite

*Braucht:* US-04

#### US-06 – Quellen verwalten · S · Must
Als Nutzer möchte ich Quellen umbenennen und löschen, damit falsche Uploads den Chat nicht stören.
- [ ] Löschen entfernt Datei im Storage und alle zugehörigen Chunks

*Braucht:* US-03

#### US-07 – Quellen für den Chat auswählen · S · Must
Als Nutzer möchte ich per Checkbox wählen, welche Quellen der Chat nutzt, damit ich Antworten auf bestimmte Dokumente eingrenzen kann.
- [ ] Checkbox pro Quelle, „Alle auswählen“
- [ ] Nur Quellen mit Status `ready` sind auswählbar
- [ ] Auswahl wird bei der Suche als Filter verwendet

*Braucht:* US-05

#### US-08 – Text als Quelle einfügen · S · Should
Als Nutzer möchte ich kopierten Text als Quelle einfügen, damit ich auch Inhalte ohne PDF nutzen kann.
- [ ] Dialog mit Titel und Textfeld, danach gleiche Verarbeitung wie US-04 (ohne Seitenzahlen)

*Braucht:* US-04

### Epic 3 – Chat

#### US-09 – Frage stellen und Antwort erhalten · L · Must
Als Nutzer möchte ich eine Frage zu meinen Quellen stellen und eine Antwort bekommen, die nur auf diesen Quellen beruht.
- [ ] Frage wird mit bge-m3 eingebettet, `match_chunks` liefert Top-k Chunks (ca. 8–10) aus den ausgewählten Quellen
- [ ] Chunks nummeriert in den Prompt, System-Prompt verlangt Antworten nur aus den Quellen
- [ ] Antwort wird **gestreamt** angezeigt
- [ ] Markdown wird gerendert (Listen, Fett, Tabellen)
- [ ] Ohne ausgewählte Quelle ist das Eingabefeld deaktiviert mit Hinweis
- [ ] Tageslimit erreicht → klare Meldung im Chat statt Fehlerseite

*Braucht:* US-04, US-07

#### US-10 – Ehrliche Antwort, wenn nichts gefunden · S · Must
Als Nutzer möchte ich klar erfahren, wenn die Quellen meine Frage nicht beantworten, damit ich keiner erfundenen Antwort vertraue.
- [ ] Antwort lautet sinngemäß „Dazu steht nichts in den ausgewählten Quellen“
- [ ] Mit 5 Testfragen geprüft, deren Antwort nicht in den Quellen steht

*Braucht:* US-09

#### US-11 – Chatverlauf bleibt erhalten · M · Must
Als Nutzer möchte ich nach dem Neuladen meinen bisherigen Chat sehen und Folgefragen stellen können.
- [ ] Nachrichten inkl. Zitaten werden in `messages` gespeichert
- [ ] Folgefragen („Und was steht zu Punkt 2?“) werden vor der Suche mit dem Verlauf zu einer eigenständigen Frage umformuliert
- [ ] Button „Chat leeren“

*Braucht:* US-09

### Epic 4 – Quellenangaben

#### US-12 – Zitate in der Antwort · M · Must
Als Nutzer möchte ich zu jeder Aussage sehen, aus welcher Quelle sie stammt, damit ich sie prüfen kann.
- [ ] Antwort enthält Marker `[1]`, `[2]` …
- [ ] Marker werden als klickbare Chips angezeigt, Hover zeigt Quellname, Seite und Textausschnitt
- [ ] Zitate verweisen nur auf tatsächlich mitgeschickte Chunks (ungültige Nummern werden entfernt)

*Braucht:* US-09

#### US-13 – Zur zitierten Stelle springen · M · Must
Als Nutzer möchte ich auf ein Zitat klicken und die Stelle im PDF sehen, damit ich den Kontext lesen kann.
- [ ] Klick öffnet einen PDF-Viewer (react-pdf) auf der richtigen Seite, PDF wird über eine kurzlebige Signed URL aus dem Storage geladen
- [ ] Zitierter Textausschnitt ist sichtbar hervorgehoben (Should, Seite reicht für Must)

*Braucht:* US-12

---

## Teil C – Reihenfolge

```
Sprint 0  Voraussetzungen   V-01 … V-06
Sprint 1  Grundgerüst       US-00, US-01, US-02, US-03, US-06
Sprint 2  Ingestion         US-04, US-05, US-07
Sprint 3  Chat              US-09, US-10, US-12
Sprint 4  Fertigstellen     US-11, US-13, US-08 (Should)
```

Nach Sprint 3 ist der Kern nutzbar: PDF hoch, Frage stellen, Antwort mit Quellen.

---

## Definition of Done (gilt für jede Story)

- Akzeptanzkriterien erfüllt und **auf dem Vercel-Deployment** getestet, nicht nur mit `npm run dev`
- Neue Abhängigkeiten in `THIRD_PARTY_LICENSES.md` eingetragen, Lizenz erfüllt die Regeln aus CLAUDE.md
- Nur die erlaubten Dienste aus CLAUDE.md verwendet, bei keinem ein Zahlungsmittel hinterlegt
- DB-Änderungen als Migration im Repo
- Keine Secrets im Code oder im Browser-Bundle

---

## Offene Entscheidungen

| # | Frage | Optionen | Empfehlung |
|---|---|---|---|
| 1 | Projektname | – | ✅ Quellwerk |
| 2 | Chat-Modell | Qwen3 30B A3B · Mistral Small 3.1 · gpt-oss-20b | Nach Test in V-04 |
| 3 | Text-Quellen im MVP | Ja (US-08) · später | Ja, kleiner Aufwand |
| 4 | Eigene Projekt-Lizenz | MIT · Apache-2.0 | ✅ MIT |
| 5 | Supabase-Region | Frankfurt · andere EU-Region | ✅ Frankfurt |
