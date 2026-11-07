# User Stories und Voraussetzungen

Teil 1: MVP (Sprint 0 bis 4) · Teil 2: [Phase 2](#phase-2--studio-notizen-und-bessere-suche) (Sprint 5 bis 8)

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
- [x] API-Token erstellt, der **nur** die Berechtigung „Workers AI“ hat (Read + Write, nur eigener Account, 1 Jahr gültig)
- [x] Testaufruf Embedding mit `@cf/baai/bge-m3` liefert 1024 Zahlen (0,2 s)
- [x] Chat-Modelle mit Apache-2.0-Lizenz getestet (gpt-oss-20b, gpt-oss-120b, mistral-small-3.1, granite-4.0-h-micro, glm-4.7-flash), mit deutschen Fragen zu einem Testtext. Gewählt: **gpt-oss-20b**, Ausweichmodell mistral-small-3.1. qwen3-30b-a3b fällt raus (Abschaltung 2026-11-20).
- [x] Lizenz des gewählten Modells auf Hugging Face bestätigt (gpt-oss-20b: Apache-2.0, bge-m3: MIT)
- [x] **Verbrauch gemessen:** Wie viele Neurons kostet eine Chat-Antwort, wie viele das Einbetten von 100 Seiten? Daraus abgeschätzt, wie viel pro Tag im Free Tier möglich ist. Ergebnis: ca. 127 Neurons pro Chat-Frage (7.000 Token), also ca. 75 Fragen pro Tag. Embeddings ca. 50 Neurons pro 100 Seiten (geschätzt nach Preis).

### V-05 – Next.js-Grundgerüst und erstes Deployment
- [x] Projekt mit aktueller Next.js-Version (16.4.5), TypeScript (strict), Tailwind v4, App Router
- [x] shadcn/ui initialisiert (Base UI, Komponenten in `src/frontend/components/ui`)
- [x] Supabase-Client für Browser und Server (`@supabase/ssr`)
- [x] AI SDK (`ai` + `@ai-sdk/openai-compatible`) gegen Workers AI angebunden (Test mit echtem Token folgt in V-04)
- [x] Leeres 3-Spalten-Layout: Quellen · Chat · (Platzhalter Studio)
- [x] Ordnerstruktur `src/app` · `src/frontend` · `src/backend`, Backend mit `server-only` geschützt
- [x] Repo in Vercel importiert (Team A-Team, Hobby), erstes Deployment erreichbar
- [x] Env-Variablen in Vercel gesetzt (alle 7 für Production, die zwei Secrets als „Secret“; Preview folgt bei Bedarf), Function Region Frankfurt (fra1), Redeploy erfolgreich

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
- [x] Login-Seite mit E-Mail und Passwort (Supabase Auth)
- [x] Alle anderen Seiten und API Routes sind ohne Login gesperrt
- [x] Logout-Button

*Braucht:* V-03, V-05

### Epic 1 – Notebooks

#### US-01 – Notebook anlegen · S · Must
Als Nutzer möchte ich ein neues Notebook mit einem Titel anlegen, damit ich Quellen zu einem Thema bündeln kann.
- [x] Button „Neues Notebook“ auf der Startseite
- [x] Titel ist editierbar, Standard „Unbenanntes Notebook“
- [x] Nach dem Anlegen öffnet sich das Notebook

*Braucht:* US-00

#### US-02 – Notebooks verwalten · S · Must
Als Nutzer möchte ich alle Notebooks sehen, öffnen, umbenennen und löschen, damit ich den Überblick behalte.
- [x] Startseite zeigt alle Notebooks mit Titel, Anzahl Quellen, Datum
- [x] Löschen fragt nach Bestätigung und entfernt Quellen, Chunks, Dateien und Chatverlauf mit

*Braucht:* US-01

### Epic 2 – Quellen

#### US-03 – PDF hochladen · M · Must
Als Nutzer möchte ich ein oder mehrere PDFs in ein Notebook hochladen, damit ich Fragen dazu stellen kann.
- [x] Upload per Button und Drag & Drop
- [x] Nur PDF erlaubt, max. 50 MB pro Datei (Limit von Supabase Free)
- [x] Datei geht **direkt vom Browser** in den Storage-Bucket (Signed Upload URL), nicht durch eine API Route
- [x] Eintrag in `sources` mit Status `uploaded`

*Braucht:* US-01, V-03

#### US-04 – PDF wird verarbeitet · L · Must
Als Nutzer möchte ich, dass das PDF nach dem Upload automatisch durchsuchbar gemacht wird, damit der Chat es verwenden kann.
- [x] API Route auf Vercel lädt das PDF aus dem Storage und extrahiert den Text **seitenweise** (unpdf oder pdfjs-dist)
- [x] Text wird in Chunks geteilt (ca. 800 Token, ca. 100 Token Overlap, an Absatzgrenzen)
- [x] Embeddings über Workers AI (bge-m3) in Batches erzeugt und in `chunks` gespeichert
- [x] Status wechselt `uploaded → processing → ready`, bei Fehler `failed` mit Grund
- [x] PDF ohne Textschicht → `failed` mit Hinweis „Gescanntes PDF, wird noch nicht unterstützt“
- [x] Tageslimit von Workers AI erreicht → `failed` mit Hinweis „Tageslimit erreicht, morgen erneut versuchen“ und Button „Erneut verarbeiten“
- [x] Verarbeitung bleibt innerhalb der Function-Laufzeit von Vercel Hobby. Falls nötig: maximale Seitenzahl fürs MVP festlegen (Wert nach Messung in V-04).

*Braucht:* US-03, V-04

#### US-05 – Verarbeitungsstatus sehen · S · Must
Als Nutzer möchte ich sehen, ob eine Quelle noch verarbeitet wird oder fertig ist, damit ich weiß, wann ich fragen kann.
- [x] Quellenliste zeigt Status (Spinner, Haken, Fehler-Icon mit Grund)
- [x] Status aktualisiert sich ohne Neuladen der Seite

*Braucht:* US-04

#### US-06 – Quellen verwalten · S · Must
Als Nutzer möchte ich Quellen umbenennen und löschen, damit falsche Uploads den Chat nicht stören.
- [x] Löschen entfernt Datei im Storage und alle zugehörigen Chunks

*Braucht:* US-03

#### US-07 – Quellen für den Chat auswählen · S · Must
Als Nutzer möchte ich per Checkbox wählen, welche Quellen der Chat nutzt, damit ich Antworten auf bestimmte Dokumente eingrenzen kann.
- [x] Checkbox pro Quelle, „Alle auswählen“
- [x] Nur Quellen mit Status `ready` sind auswählbar
- [x] Auswahl wird bei der Suche als Filter verwendet

*Braucht:* US-05

#### US-08 – Text als Quelle einfügen · S · Should
Als Nutzer möchte ich kopierten Text als Quelle einfügen, damit ich auch Inhalte ohne PDF nutzen kann.
- [x] Dialog mit Titel und Textfeld, danach gleiche Verarbeitung wie US-04 (ohne Seitenzahlen)

*Braucht:* US-04

### Epic 3 – Chat

#### US-09 – Frage stellen und Antwort erhalten · L · Must
Als Nutzer möchte ich eine Frage zu meinen Quellen stellen und eine Antwort bekommen, die nur auf diesen Quellen beruht.
- [x] Frage wird mit bge-m3 eingebettet, `match_chunks` liefert Top-k Chunks (ca. 8–10) aus den ausgewählten Quellen
- [x] Chunks nummeriert in den Prompt, System-Prompt verlangt Antworten nur aus den Quellen
- [x] Antwort wird **gestreamt** angezeigt
- [x] Markdown wird gerendert (Listen, Fett, Tabellen)
- [x] Ohne ausgewählte Quelle ist das Eingabefeld deaktiviert mit Hinweis
- [x] Tageslimit erreicht → klare Meldung im Chat statt Fehlerseite

*Braucht:* US-04, US-07

#### US-10 – Ehrliche Antwort, wenn nichts gefunden · S · Must
Als Nutzer möchte ich klar erfahren, wenn die Quellen meine Frage nicht beantworten, damit ich keiner erfundenen Antwort vertraue.
- [x] Antwort lautet sinngemäß „Dazu steht nichts in den ausgewählten Quellen“
- [x] Mit 5 Testfragen geprüft, deren Antwort nicht in den Quellen steht

*Braucht:* US-09

#### US-11 – Chatverlauf bleibt erhalten · M · Must
Als Nutzer möchte ich nach dem Neuladen meinen bisherigen Chat sehen und Folgefragen stellen können.
- [x] Nachrichten inkl. Zitaten werden in `messages` gespeichert
- [x] Folgefragen („Und was steht zu Punkt 2?“) werden vor der Suche mit dem Verlauf zu einer eigenständigen Frage umformuliert
- [x] Button „Chat leeren“

*Braucht:* US-09

### Epic 4 – Quellenangaben

#### US-12 – Zitate in der Antwort · M · Must
Als Nutzer möchte ich zu jeder Aussage sehen, aus welcher Quelle sie stammt, damit ich sie prüfen kann.
- [x] Antwort enthält Marker `[1]`, `[2]` …
- [x] Marker werden als klickbare Chips angezeigt, Hover zeigt Quellname, Seite und Textausschnitt
- [x] Zitate verweisen nur auf tatsächlich mitgeschickte Chunks (ungültige Nummern werden entfernt)

*Braucht:* US-09

#### US-13 – Zur zitierten Stelle springen · M · Must
Als Nutzer möchte ich auf ein Zitat klicken und die Stelle im PDF sehen, damit ich den Kontext lesen kann.
- [x] Klick öffnet einen PDF-Viewer (react-pdf) auf der richtigen Seite, PDF wird über eine kurzlebige Signed URL aus dem Storage geladen
- [x] Zitierter Textausschnitt ist sichtbar hervorgehoben (Should, Seite reicht für Must)

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

**Stand 2026-11-07:** MVP und Phase 2 komplett (Sprint 0 bis 8), dazu Dark Mode. Tests: 123 Unit-Tests (`npm test`) und 71 Integrationstests gegen Supabase (`npm run test:integration`), beide laufen vor jedem Vercel-Deployment (`npm run verify`). Dazu 11 Tests mit echtem Workers AI (`RUN_AI_TESTS=1`).

---

## Definition of Done (gilt für jede Story)

- Akzeptanzkriterien erfüllt und **auf dem Vercel-Deployment** getestet, nicht nur mit `npm run dev`
- Neue Abhängigkeiten in `THIRD_PARTY_LICENSES.md` eingetragen, Lizenz erfüllt die Regeln aus CLAUDE.md
- Nur die erlaubten Dienste aus CLAUDE.md verwendet, bei keinem ein Zahlungsmittel hinterlegt
- DB-Änderungen als Migration im Repo
- Keine Secrets im Code oder im Browser-Bundle

---

## Entscheidungen

| # | Frage | Optionen | Entscheidung |
|---|---|---|---|
| 1 | Projektname | – | ✅ Quellwerk |
| 2 | Chat-Modell | gpt-oss-20b · Mistral Small 3.1 · weitere | ✅ gpt-oss-20b |
| 3 | Text-Quellen im MVP | Ja (US-08) · später | ✅ Ja |
| 4 | Eigene Projekt-Lizenz | MIT · Apache-2.0 | ✅ MIT |
| 5 | Supabase-Region | Frankfurt · andere EU-Region | ✅ Frankfurt |

---

# Phase 2 – Studio, Notizen und bessere Suche

Entschieden am 2026-11-07: Phase 2 wird komplett umgesetzt, bei offenen Fragen gilt jeweils die Empfehlung.

## Phase 2 · Ziel

Phase 2 füllt die Studio-Spalte und macht Quellen schneller verständlich:
Zusammenfassungen pro Quelle, Studio-Ausgaben (Study Guide, FAQ, Briefing, Zeitleiste), Notizen und eine bessere Suche.

Nicht in Phase 2: Audio Overview (Podcast), Teilen mit anderen Nutzern, weitere Quellentypen wie URLs. Das bleibt Phase 3.

## Phase 2 · Das Free-Tier-Limit als wichtigste Randbedingung

Workers AI erlaubt **10.000 Neurons pro Tag**. Im MVP kostet eine Chat-Frage etwa 130 Neurons, weil nur 8 Abschnitte ans Modell gehen. Studio-Funktionen lesen deutlich mehr Text. Deshalb gilt für Phase 2:

- **Einmal erzeugen, dann speichern.** Zusammenfassungen und Studio-Ausgaben werden in der Datenbank abgelegt und nicht bei jedem Öffnen neu berechnet.
- **Große Dokumente nicht komplett lesen.** Statt des ganzen Textes gehen ausgewählte Abschnitte und vorhandene Zusammenfassungen ans Modell.
- **Verbrauch sichtbar machen** (US-21), damit man sieht, wie viel vom Tag noch übrig ist.

### Kosten-Schätzung (gpt-oss-20b, noch nicht gemessen)

Grundlage: Preis laut Cloudflare-API (0,20 $ pro 1 Mio. Input-Token, 0,30 $ pro 1 Mio. Output-Token) und 1.000 Neurons = 0,011 $. Daraus ergeben sich etwa **18 Neurons pro 1.000 Input-Token** und **27 Neurons pro 1.000 Output-Token**. Reasoning-Token zählen zum Output.

| Vorgang | Input | Output | Neurons (geschätzt) | pro Tag möglich |
|---|---|---|---|---|
| Chat-Frage (MVP, gemessen) | ca. 7.000 Token | ca. 300 Token | **127** | ca. 75 |
| Zusammenfassung, ganzes OWASP-PDF (122 Seiten) | ca. 57.000 Token | ca. 800 Token | ca. 1.060 | ca. 9 |
| Zusammenfassung mit Auswahl (max. 12.000 Token) | ca. 12.000 Token | ca. 800 Token | **220 (gemessen)** | ca. 45 |
| Studio-Ausgabe aus Zusammenfassungen + 8 Abschnitten | ca. 1.000–9.000 Token | ca. 1.500 Token | **21 gemessen (kleine Quelle), ca. 150–200 bei großen Quellen** | ab ca. 50 |
| Umformulieren einer Folgefrage (MVP) | ca. 300 Token | ca. 50 Token | ca. 7 | – |

Die Werte werden in V-07 gemessen und hier ersetzt.

---

## Phase 2 · Teil A – Was vorher stehen muss

### V-07 – Verbrauch messen
- [x] Zusammenfassung mit Auswahl (12.000 Token) gemessen: 220 Neurons (synthetisches 40-Seiten-Dokument). Das ganze Dokument wurde nicht gemessen, um das Kontingent zu schonen: Der Verbrauch ist linear zu den Token (bestätigt durch die Chat-Messung), also ca. 1.000 Neurons für 57.000 Token.
- [x] Studio-Ausgabe (FAQ) gemessen: 20,7 Neurons bei einer kleinen Quelle (ca. 1.000 Token Input). Bei großen Quellen mit 8 vollen Abschnitten linear ca. 150–200.
- [x] Auswahl liefert eine sinnvolle deutsche Zusammenfassung mit Themen (Test mit echtem Modell). Entscheidung 2 bleibt: Auswahl.
- [x] Tabelle „Kosten-Schätzung“ oben mit den gemessenen Werten aktualisiert

### V-08 – Datenbank erweitern (Migration)
- [x] `sources`: Spalten `summary text`, `key_topics text[]`, `summary_status` (`none` · `pending` · `ready` · `failed`)
- [x] Neue Tabelle `notes`: Notizen und Studio-Ausgaben in einer Tabelle (siehe Entscheidung 3)
  - `id`, `notebook_id`, `user_id`, `kind` (`note` · `study_guide` · `faq` · `briefing` · `timeline`), `title`, `content` (Markdown), `citations jsonb`, `source_ids uuid[]`, `created_at`, `updated_at`
- [x] Neue Tabelle `usage_log`: `id`, `user_id`, `kind` (`chat` · `rewrite` · `embedding` · `summary` · `studio`), `neurons numeric`, `created_at`
- [x] Für Hybrid-Suche (US-20): Spalte `chunks.fts tsvector` (generiert) mit GIN-Index
- [x] RLS, Policies und GRANTs wie bei den bestehenden Tabellen
- [x] Supabase-Advisor: 0 Sicherheitswarnungen

### V-09 – Verbrauch zentral erfassen
- [x] Jeder Aufruf von Workers AI (Chat, Umformulieren, Embeddings, Zusammenfassung, Studio) schreibt `usage.neurons` in `usage_log`
- [x] Embeddings melden keinen Verbrauch: dort aus Token-Zahl und Preis schätzen und als geschätzt markieren

---

## Phase 2 · Teil B – User Stories

Format wie im MVP: *Als Nutzer möchte ich …, damit …* · Größe: S (< 1 Tag), M (1–2 Tage), L (3+ Tage) · Priorität nach MoSCoW

### Epic 5 – Quellen verstehen

#### US-14 – Zusammenfassung pro Quelle · M · Must
Als Nutzer möchte ich zu jeder Quelle eine kurze Zusammenfassung und die Schlüsselthemen sehen, damit ich schnell weiß, worum es geht, ohne das Dokument zu lesen.
- [x] Nach erfolgreicher Verarbeitung wird die Zusammenfassung automatisch erzeugt (siehe Entscheidung 1)
- [x] 4–6 Sätze plus 3–6 Schlüsselthemen, auf Deutsch (wie die Oberfläche)
- [x] Bei großen Quellen gehen höchstens 12.000 Token ans Modell: Anfang, Ende und gleichmäßig verteilte Abschnitte (siehe Entscheidung 2)
- [x] Wird einmal erzeugt und gespeichert, Button „Neu erzeugen“
- [x] Klick auf eine Quelle in der Liste klappt Zusammenfassung und Themen auf
- [x] Klick auf ein Schlüsselthema stellt im Chat die Frage „Was steht zu ‚Thema‘ in den Quellen?“
- [x] Tageslimit erreicht: Quelle bleibt nutzbar, Zusammenfassung zeigt „später erneut versuchen“

*Braucht:* V-07, V-08 · *Kosten:* ca. 240 Neurons pro Quelle, einmalig

### Epic 6 – Studio

#### US-15 – Studio-Ausgabe erzeugen · L · Must
Als Nutzer möchte ich aus den ausgewählten Quellen per Klick einen Study Guide, ein FAQ, ein Briefing oder eine Zeitleiste erzeugen, damit ich den Inhalt in einer passenden Form lernen oder weitergeben kann.
- [x] Studio-Spalte zeigt vier Kacheln: Study Guide, FAQ, Briefing, Zeitleiste
- [x] Nutzt die im Chat ausgewählten Quellen (US-07)
- [x] Input fürs Modell: Zusammenfassungen der Quellen (US-14) plus passende Abschnitte, max. ca. 9.000 Token
- [x] Ausgabe als Markdown mit Quellenangaben `[n]`, Chips wie im Chat (US-12) und Klick zur Stelle (US-13)
- [x] Wird gestreamt angezeigt und danach in `notes` gespeichert
- [x] Vor dem Erzeugen wird der geschätzte Verbrauch angezeigt („ca. 200 Neurons“)
- [x] Zeitleiste: nur Ereignisse mit Datum aus den Quellen, sonst Hinweis „Keine datierten Ereignisse gefunden“

*Braucht:* US-14, V-08 · *Kosten:* ca. 205 Neurons pro Ausgabe

#### US-16 – Studio-Ausgaben verwalten · S · Must
Als Nutzer möchte ich erzeugte Ausgaben wieder öffnen, löschen und kopieren, damit ich sie nicht neu erzeugen muss.
- [x] Liste der Ausgaben unter den Kacheln mit Typ, Titel und Datum
- [x] Öffnen in einer größeren Ansicht, Löschen mit Bestätigung
- [x] „Als Markdown kopieren“ in die Zwischenablage
- [x] „Neu erzeugen“ mit den aktuell ausgewählten Quellen

*Braucht:* US-15

### Epic 7 – Notizen

#### US-17 – Chat-Antwort als Notiz speichern · S · Must
Als Nutzer möchte ich eine gute Antwort aus dem Chat als Notiz behalten, damit sie nicht verloren geht, wenn ich den Chat leere.
- [x] Button „Als Notiz speichern“ unter jeder Antwort
- [x] Notiz behält Text und Quellenangaben, Titel aus der Frage
- [x] Erscheint in der Studio-Spalte bei den Notizen

*Braucht:* V-08

#### US-18 – Eigene Notizen schreiben · M · Should
Als Nutzer möchte ich eigene Notizen anlegen, bearbeiten und löschen, damit ich Gedanken direkt neben den Quellen festhalten kann.
- [x] Neue Notiz mit Titel und Markdown-Text, Vorschau beim Lesen
- [x] Bearbeiten und Löschen mit Bestätigung
- [x] Gespeichert pro Notebook, nur für den eigenen Nutzer sichtbar (RLS)

*Braucht:* V-08

#### US-19 – Notiz als Quelle verwenden · S · Could
Als Nutzer möchte ich eine Notiz in eine Quelle umwandeln, damit der Chat sie bei Antworten berücksichtigt.
- [x] Button „Als Quelle hinzufügen“ an einer Notiz
- [x] Wird wie eine Text-Quelle (US-08) verarbeitet

*Braucht:* US-18, US-08 · *Kosten:* Embeddings, vernachlässigbar

### Epic 8 – Suche und Verbrauch

#### US-20 – Hybrid-Suche · M · Should
Als Nutzer möchte ich, dass der Chat auch exakte Begriffe wie Namen, Nummern oder Abkürzungen zuverlässig findet, damit Fragen wie „Was steht zu LLM05?“ funktionieren.
- [x] Suche kombiniert Vektorsuche (bge-m3) und Volltextsuche (Postgres `tsvector`)
- [x] Ergebnisse werden per Reciprocal Rank Fusion zusammengeführt
- [x] Testfragen mit exakten Begriffen aus dem OWASP-PDF (z. B. „LLM05“, „Improper Output Handling“) finden den richtigen Abschnitt unter den Top 3
- [x] Keine zusätzlichen Neurons (Volltextsuche läuft in der Datenbank)

*Braucht:* V-08 · *Kosten:* 0 Neurons

#### US-21 – Tagesverbrauch anzeigen · S · Should
Als Nutzer möchte ich sehen, wie viel vom Tageskontingent von Workers AI schon verbraucht ist, damit ich nicht überrascht werde, wenn nichts mehr geht.
- [x] Anzeige in der Kopfzeile, z. B. „KI heute: 1.240 / 10.000“
- [x] Farbe wechselt ab 80 % auf Warnung
- [x] Zählt ab 0:00 UTC, so wie Cloudflare das Kontingent zurücksetzt (prüfen)
- [x] Hinweis, dass Embeddings geschätzt sind

*Braucht:* V-09

---

## Phase 2 · Teil C – Vorschlag für die Reihenfolge

```
Sprint 5   Grundlage      V-07, V-08, V-09, US-21
Sprint 6   Quellen        US-14, US-20
Sprint 7   Studio         US-15, US-16
Sprint 8   Notizen        US-17, US-18, US-19 (Could)
```

Begründung: Die Verbrauchsanzeige kommt zuerst, weil Studio-Funktionen das Kontingent spürbar nutzen. Die Zusammenfassungen (US-14) sind die Grundlage für günstige Studio-Ausgaben. Die Hybrid-Suche kostet keine Neurons und verbessert sofort auch den bestehenden Chat.

---

## Phase 2 · Definition of Done

Wie im MVP, zusätzlich:
- Jede neue KI-Funktion schreibt ihren Verbrauch in `usage_log`
- Gemessener Verbrauch steht in der Kosten-Tabelle oben
- Integrationstests mit Fake-Modell, dazu mindestens ein Test mit dem echten Modell (`RUN_AI_TESTS=1`)

---

## Phase 2 · Entscheidungen

| # | Frage | Optionen | Empfehlung | Entscheidung |
|---|---|---|---|---|
| 1 | Wann wird die Zusammenfassung erzeugt? | automatisch nach der Verarbeitung · erst beim ersten Aufklappen | automatisch, dann ist sie sofort da | ✅ automatisch |
| 2 | Wie viel Text geht in die Zusammenfassung? | ganzes Dokument · Auswahl bis 12.000 Token | Auswahl, nach Messung in V-07 bestätigen | ✅ Auswahl bis 12.000 Token |
| 3 | Notizen und Studio-Ausgaben speichern | eine Tabelle `notes` mit `kind` · zwei Tabellen | eine Tabelle, einfacher | ✅ eine Tabelle `notes` |
| 4 | Welche Studio-Ausgaben zuerst? | Study Guide · FAQ · Briefing · Zeitleiste | FAQ und Briefing zuerst, Zeitleiste zuletzt | ✅ alle vier, Reihenfolge FAQ, Briefing, Study Guide, Zeitleiste |
| 5 | Sprache der Volltextsuche | `german` (Wortstämme) · `simple` (exakte Wörter) | `simple`, weil viele Quellen englisch oder gemischt sind | ✅ `simple`, Stoppwörter filtert die App |
| 6 | Verbrauchsanzeige (US-21) | ja · nein | ja | ✅ ja |
| 7 | Reihenfolge der Sprints | wie in Teil C · andere | wie in Teil C | ✅ wie in Teil C |
