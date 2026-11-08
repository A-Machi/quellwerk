# Quellwerk – Evaluation und Ergebnis

Am Anfang stand ein Stack-Vorschlag mit Gemini, Vercel und Supabase Cloud. Mit den Projektregeln (nur Open Source, keine Kosten, alles in der Cloud) hat sich der Stack geändert. Dieses Dokument hält fest, was evaluiert wurde, wie entschieden wurde und was am Ende gebaut ist.

Stand: 2026-11-08 · MVP und Phase 2 sind umgesetzt und live unter https://quellwerk.vercel.app

Verbindlich für Regeln und Konfiguration ist [CLAUDE.md](../CLAUDE.md). User Stories, Akzeptanzkriterien und Fortschritt stehen in [MVP_USER_STORIES.md](MVP_USER_STORIES.md).

---

## 1. Feature-Inventar

| Feature | Beschreibung | Stand |
|---|---|---|
| Notebooks | Projekte, die mehrere Quellen bündeln | ✅ umgesetzt |
| Quellen | PDF hochladen, Text einfügen, Notiz als Quelle | ✅ umgesetzt |
| Quellen-Auswahl | Checkbox pro Quelle, Auswahl bleibt gespeichert | ✅ umgesetzt |
| Chat mit Quellenangaben | Gestreamte Antwort, Zitate als Chips, Klick öffnet das PDF auf der Seite | ✅ umgesetzt |
| Chatverlauf | Bleibt nach dem Neuladen, Folgefragen werden verstanden | ✅ umgesetzt |
| Quellen-Zusammenfassung | Kurzfassung und Schlüsselthemen nach dem Upload | ✅ umgesetzt |
| Notizen | Antworten speichern, eigene Notizen schreiben | ✅ umgesetzt |
| Studio | FAQ, Briefing, Study Guide, Zeitleiste | ✅ umgesetzt |
| Login | Ein Nutzer, Registrierung aus | ✅ umgesetzt |
| Dark Mode | Hell, Dunkel oder System | ✅ umgesetzt |
| Verbrauchsanzeige | Tagesverbrauch von Workers AI in der Kopfzeile | ✅ umgesetzt |

---

## 2. Rahmenbedingungen

Aus [CLAUDE.md](../CLAUDE.md), festgelegt am 2026-11-07:

1. **Open Source:** Jede Bibliothek und jedes Modell hat eine Open-Source-Lizenz.
2. **Keine Kosten:** Nur Free Tiers ohne hinterlegtes Zahlungsmittel.
3. **Keine Lizenzverstöße:** Jede Abhängigkeit steht mit Lizenz in [THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md).
4. **Alles in der Cloud:** Kein Docker, keine lokale Datenbank, keine lokalen Modelle.

Folgen für den ursprünglichen Vorschlag:
- **Gemini fällt weg,** weil es proprietär ist, auch im Free Tier.
- **Docker fällt weg,** damit auch der lokale Supabase-Stack.

---

## 3. Stack: Vorschlag und Umsetzung

| Bereich | Ursprünglicher Vorschlag | Umgesetzt | Grund |
|---|---|---|---|
| Framework | Next.js 15 | **Next.js 16.4** (App Router, Cache Components, Proxy) | aktuelle Version beim Start |
| UI | Tailwind CSS, shadcn/ui | **Tailwind v4, shadcn/ui** (Base UI), next-themes für den Dark Mode | wie geplant |
| Backend | Next.js API Routes | **Route Handler und Server Actions**, `src/proxy.ts` für Session und Login-Weiterleitung | kein separates Backend nötig |
| Chat-Modell | Gemini 2.5 Flash | **gpt-oss-20b** über Cloudflare Workers AI (Apache-2.0), Ausweichmodell Mistral Small 3.1 | Gemini proprietär, gpt-oss im Test am schnellsten und günstigsten |
| Embeddings | Gemini Embeddings | **bge-m3** über Workers AI (MIT, 1024 Dimensionen, mehrsprachig) | offen, gut für Deutsch |
| KI-Anbindung | AI SDK mit `@ai-sdk/google` | **AI SDK v7** mit `@ai-sdk/openai-compatible` | OpenAI-kompatibler Endpunkt von Workers AI |
| Datenbank | Supabase PostgreSQL + pgvector | **Supabase Free** in Frankfurt, pgvector 0.8.2, HNSW-Index, RLS auf allen Tabellen | wie geplant |
| Dateien | Supabase Storage | **privater Bucket** `sources`, Upload direkt aus dem Browser über signierte URLs | Vercel nimmt nur ca. 4,5 MB pro Anfrage an |
| PDF | pdf-parse oder pdfjs-dist | **unpdf** (pdf.js), Text seitenweise | Seitenzahlen für Zitate |
| Hosting | Vercel | **Vercel Hobby**, Region Frankfurt (fra1) | nahe an der Datenbank |
| Tests | – | **Vitest:** Unit-Tests und Integrationstests gegen Supabase, vor jedem Deployment | neu dazugekommen |

---

## 4. Entscheidungen

Die offenen Fragen aus der ersten Evaluation und wie sie entschieden wurden:

| # | Frage | Entscheidung |
|---|---|---|
| 1 | Zielgruppe | Privat, ein Nutzer. Trotzdem mit Login, weil die App öffentlich erreichbar ist. Registrierung ist aus. |
| 2 | RAG selbst bauen? | Ja, eigene Pipeline. Die Gemini File Search API ist proprietär. |
| 3 | Chat-Modell | gpt-oss-20b, nach einem Test von fünf Modellen. qwen3-30b schied aus, weil Cloudflare es am 20.11.2026 abschaltet. |
| 4 | Embedding-Dimension | 1024 (bge-m3), unter dem HNSW-Limit von 2.000 |
| 5 | PDF-Parser | unpdf. Gescannte PDFs werden erkannt und mit Hinweis abgelehnt, OCR gibt es nicht. |
| 6 | Hintergrund-Jobs | Eine Anfrage pro Quelle (max. 60 s, max. 300 Seiten). Die Zusammenfassung läuft danach per `after()`. Eine Job-Queue war bisher nicht nötig. |
| 7 | Umfang | MVP und Phase 2 komplett |
| 8 | Quellentypen | PDF und Text. Notizen lassen sich als Text-Quelle hinzufügen. |

Die Entscheidungen zu Phase 2 (Zusammenfassung automatisch, Auswahl bis 12.000 Token, eine Tabelle für Notizen und Studio, Volltext mit `simple`) stehen in [MVP_USER_STORIES.md](MVP_USER_STORIES.md).

---

## 5. RAG-Pipeline, wie sie umgesetzt ist

**Quelle einlesen**

| # | Schritt | Umsetzung |
|---|---|---|
| 1 | Upload | Der Browser lädt direkt in den Storage, über eine signierte URL, max. 50 MB. Die Quelle bekommt den Status `uploaded`. |
| 2 | Text extrahieren | unpdf liest seitenweise. Silbentrennung und Steuerzeichen werden bereinigt. Unter 20 Zeichen pro Seite gilt das PDF als Scan. Text-Quellen bilden einen Block ohne Seitenzahl. |
| 3 | Chunks | ca. 3.200 Zeichen (ca. 800 Token), 400 Zeichen Überlappung. Geschnitten wird an Absatz-, Satz- und Wortgrenzen, nie über eine Seitengrenze. |
| 4 | Embeddings | bge-m3 in Batches zu 32 Texten |
| 5 | Speichern | Tabelle `chunks` mit Vektor (HNSW-Index) und Volltextspalte (`tsvector`, GIN-Index). Status `ready`, bei Fehlern `failed` mit verständlichem Grund. |
| 6 | Zusammenfassung | Bei großen Quellen eine Auswahl aus Anfang, Ende und verteilten Abschnitten, bis 12.000 Token. Ergebnis: 4 bis 6 Sätze und Schlüsselthemen. |

**Frage beantworten**

| # | Schritt | Umsetzung |
|---|---|---|
| 1 | Folgefrage umformulieren | Mit den letzten 6 Nachrichten wird die Frage eigenständig gemacht, z. B. „Und warum?“ zu „Warum stieg der Umsatz 2025?“. |
| 2 | Hybrid-Suche | Postgres-Funktion `match_chunks_hybrid`: Vektorsuche plus Volltextsuche. Füllwörter entfernt die App vorher. Beide Rankings werden per Reciprocal Rank Fusion (k = 60) zusammengeführt, die besten 8 Abschnitte kommen in den Prompt. Gesucht wird nur in den ausgewählten, fertigen Quellen des Notebooks. |
| 3 | Prompt | Nummerierte Abschnitte mit Titel und Seite, dazu der Verlauf ohne alte Zitat-Marker. Steht nichts in den Quellen, gibt es eine feste Antwort. |
| 4 | Antwort | Gestreamt als NDJSON: erst die Zitate, dann der Text. |
| 5 | Anzeige | Zitat-Marker werden zu Chips. Ein Klick öffnet das PDF im Browser-Viewer auf der Seite (`#page=n`), daneben steht der zitierte Abschnitt. |
| 6 | Verlauf | Frage und Antwort samt Zitaten landen in `messages`. |

Re-Ranking der Treffer war bisher nicht nötig.

---

## 6. Datenmodell

```
notebooks   (id, user_id, title, created_at, updated_at)
sources     (id, notebook_id, user_id, type pdf|text, title, storage_path, status, error, page_count,
             summary, key_topics, summary_status, created_at, updated_at)
chunks      (id, source_id, user_id, chunk_index, page_number, content, token_count,
             embedding vector(1024), fts tsvector, created_at)
messages    (id, notebook_id, user_id, role, content, citations jsonb, created_at)
notes       (id, notebook_id, user_id, kind note|faq|briefing|study_guide|timeline, title, content,
             citations jsonb, source_ids, created_at, updated_at)
usage_log   (id, user_id, kind, neurons, estimated, created_at)
```

- **Funktionen:** `match_chunks`, `match_chunks_hybrid`, `usage_today`
- **Schutz:** Row Level Security auf allen Tabellen, ausdrückliche `GRANT`s, anonyme Nutzer haben keinen Zugriff. Die Sicherheitsprüfung von Supabase meldet keine Warnung zum Code.
- **Migrationen:** in [supabase/migrations](../supabase/migrations), eingespielt mit der Supabase CLI ohne Docker

---

## 7. Lange Verarbeitung auf Vercel

Die Sorge aus der ersten Evaluation war, dass große PDFs die Laufzeit einer Vercel Function sprengen. Umgesetzt ist die einfachste Variante:

- **Eine Anfrage pro Quelle:** max. 60 Sekunden und max. 300 Seiten.
- **Status-Abfrage:** Die Oberfläche fragt alle 2 Sekunden nach, bis die Quelle fertig ist.
- **Zusammenfassung:** läuft per `after()`, nachdem die Antwort schon zurück ist.

Das OWASP-PDF mit 122 Seiten wurde damit problemlos verarbeitet. Eine Job-Queue (Inngest, QStash) wäre erst nötig, wenn größere Dokumente scheitern.

---

## 8. Kosten und Limits

Alle Dienste laufen im Free Tier ohne Zahlungsmittel. Begrenzend ist das Kontingent von Workers AI: **10.000 Neurons pro Tag**, zurückgesetzt um 0:00 UTC.

| Vorgang | Neurons | Messung |
|---|---|---|
| Chat-Frage (ca. 7.000 Token Input) | 127 | gemessen |
| Zusammenfassung (Auswahl bis 12.000 Token) | 220 | gemessen |
| Studio-Ausgabe, kleine Quelle | 21 | gemessen |
| Studio-Ausgabe, große Quelle | ca. 150–200 | hochgerechnet |
| Embeddings für 100 Seiten | ca. 50 | geschätzt, Workers AI meldet hier keinen Verbrauch |
| Embeddings OWASP-PDF (122 Seiten, ca. 57.000 Token) | ca. 60 | geschätzt |

Weitere Grenzen:

| Dienst | Grenze |
|---|---|
| Supabase Free | 500 MB Datenbank, 1 GB Storage, 50 MB pro Datei, pausiert nach ca. 1 Woche ohne Nutzung |
| Vektoren | 1024 × 4 Byte ≈ 4 KB pro Chunk, plus Index und Text. Grob einige zehntausend Chunks passen in die 500 MB. |
| Vercel Hobby | nur nicht kommerziell, ca. 4,5 MB pro Anfrage, eine Function-Region |

**Datenschutz:** Bei jeder Frage gehen die passenden Textabschnitte an Cloudflare. Die Datenbank liegt in Frankfurt.

---

## 9. Qualität und Tests

- **123 Unit-Tests:** Chunking, PDF-Extraktion, Zitate, Prompts, Validierung, Verbrauch.
- **71 Integrationstests gegen die echte Supabase-Datenbank:** RLS zwischen zwei Nutzern, Notebooks, Quellen, Pipeline, Chat, Verlauf, Zusammenfassung, Hybrid-Suche, Studio, Notizen und Verbrauch. Sie arbeiten mit temporären Test-Nutzern und Fake-Embeddings, kosten also keine Neurons.
- **11 Tests mit dem echten Modell,** nur auf Wunsch (`RUN_AI_TESTS=1`): Antwortqualität, 5 unbeantwortbare Fragen, Folgefrage, Zusammenfassung und FAQ.
- **Pipeline:** `vercel.json` führt vor jedem Build `npm run verify` aus (Lint, Typecheck, Unit- und Integrationstests). Schlägt ein Test fehl, wird nicht deployt.
- **Gegenprobe:** 7 absichtlich eingebaute Fehler wurden alle von den Tests erkannt.

---

## 10. Wartung

- **Cloudflare-Token** läuft am **07.11.2027** ab. Dann einen neuen in `.env.local` und in Vercel eintragen.
- **Abschaltung von Modellen:** Cloudflare kündigt sie an (`planned_deprecation_date`). Trifft es gpt-oss-20b, `CHAT_MODEL` auf `@cf/mistralai/mistral-small-3.1-24b-instruct` umstellen.
- **Supabase-Pause:** Pausiert das Projekt nach einer Woche ohne Nutzung, lässt es sich im Dashboard wieder starten.
- **Preview-Deployments:** Die Env-Variablen sind nur für Production gesetzt. Für Arbeit auf anderen Branches in Vercel ergänzen.
