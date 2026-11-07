# CLAUDE.md – Quellwerk

**Quellwerk** ist ein Klon von NotebookLM: Quellen (PDFs) hochladen, mit ihnen chatten, Antworten mit Quellenangaben. Privates Lernprojekt, keine kommerzielle Nutzung.

Planung: [eval/MVP_USER_STORIES.md](eval/MVP_USER_STORIES.md) · Hintergrund: [eval/EVALUATION.md](eval/EVALUATION.md)

## Grundregeln (nicht verhandelbar)

1. **Open-Source-Software und offene Modelle.** Jede Bibliothek und jedes KI-Modell hat eine Open-Source-Lizenz.
2. **Keine Kosten.** Gehostet wird nur in Free Tiers, bei denen **kein Zahlungsmittel hinterlegt** ist. Ohne Karte kann nichts abgebucht werden: Beim Erreichen eines Limits stoppt der Dienst, statt Geld zu verlangen. Niemals eine Karte hinterlegen oder auf einen bezahlten Plan wechseln.
3. **Keine Lizenzverstöße.** Jede Lizenz und jede Nutzungsbedingung wird vor der Nutzung geprüft und eingehalten.
4. **Alles läuft in der Cloud.** Lokal laufen nur Editor, Git und der Next.js-Dev-Server. Kein Docker, keine lokale Datenbank, keine lokalen Modelle.

Gilt eine dieser Regeln nicht sicher, wird die Komponente **nicht** eingebaut. Stattdessen wird beim Nutzer nachgefragt.

## Erlaubte Cloud-Dienste

Die Dienste selbst sind proprietär. Das ist eine bewusste Entscheidung vom 2026-11-07: Software und Modelle sind offen, gehostet wird kostenlos bei diesen Anbietern.

| Dienst | Zweck | Plan | Wichtige Limits (beim Start prüfen) |
|---|---|---|---|
| Vercel | Hosting Next.js (Frontend + API Routes) | Hobby | Nur nicht kommerziell. Request-Body ca. 4,5 MB. Function-Laufzeit begrenzt. |
| Supabase | PostgreSQL + pgvector, Storage, Auth | Free | 500 MB DB, 1 GB Storage, 50 MB pro Datei. Projekt pausiert nach ca. 1 Woche ohne Aktivität. |
| Cloudflare Workers AI | Chat-Modell und Embeddings | Workers Free | 10.000 Neurons pro Tag, danach Fehler bis zum nächsten Tag. |
| GitHub | Code-Repository, Verbindung zu Vercel | Free | – |

Weitere Dienste nur nach Rückfrage beim Nutzer.

## Verboten

- Zahlungsmittel hinterlegen, Paid Plan, Pay-as-you-go, Testphasen mit Karte
- Docker (auch Docker Desktop), lokale Datenbanken, lokale Modelle, Ollama
- Supabase-Funktionen, die Docker brauchen (`supabase start`, lokaler Supabase-Stack)
- Proprietäre Modelle wie Gemini, GPT oder Claude, **auch im Free Tier**
- Modelle mit eigenen, nicht OSI-konformen Lizenzen (z. B. Llama Community License, Gemma Terms of Use). Workers AI bietet viele Llama-Modelle an: diese nicht verwenden.
- Kommerzielle Nutzung (verstößt gegen Vercel Hobby)
- Den Namen „NotebookLM“, Google-Logos oder Google-Branding im Produkt. Das Projekt braucht einen eigenen Namen.
- Code, Texte, Logos oder UI-Assets aus fremden Projekten kopieren, ohne die Lizenz einzuhalten

## Lizenzregeln für Abhängigkeiten

| Lizenz | Status |
|---|---|
| MIT, Apache-2.0, BSD-2/3-Clause, ISC, PostgreSQL, 0BSD, Unlicense | ✅ erlaubt |
| MPL-2.0, LGPL | ⚠️ erlaubt, Bedingungen einhalten |
| GPL, AGPL | ⚠️ nur nach Rückfrage beim Nutzer |
| Keine Lizenz angegeben, „Source available“, SSPL, BSL, Commons Clause, eigene Modell-Lizenzen | ❌ nicht verwenden |

**Ablauf vor jeder neuen Abhängigkeit:**
1. Lizenz prüfen (`npm view <paket> license`, bei Modellen die Modellseite bei Cloudflare und die Model Card auf Hugging Face).
2. Eintrag in `THIRD_PARTY_LICENSES.md` ergänzen (Name, Version, Lizenz, Link).
3. Bei Unklarheit nicht einbauen, sondern nachfragen.

## Stack

| Bereich | Wahl | Lizenz |
|---|---|---|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui | MIT |
| Hosting | Vercel Hobby | Dienst |
| Datenbank | Supabase PostgreSQL + pgvector | PostgreSQL License |
| Dateien | Supabase Storage (privater Bucket) | Dienst |
| Login | Supabase Auth (öffentliche Registrierung aus) | Dienst |
| Supabase-Client | `@supabase/supabase-js`, `@supabase/ssr` | MIT |
| Chat-Modell | Workers AI, Kandidaten: Qwen3 30B A3B, Mistral Small 3.1, gpt-oss-20b (Auswahl nach Test) | Apache-2.0 |
| Embeddings | Workers AI `@cf/baai/bge-m3` (mehrsprachig, 1024 Dimensionen) | MIT |
| AI-Anbindung | Vercel AI SDK (`ai`) + `@ai-sdk/openai-compatible` gegen den OpenAI-kompatiblen Endpoint von Workers AI | Apache-2.0 |
| PDF | unpdf oder pdfjs-dist (Extraktion), react-pdf (Anzeige) | MIT / Apache-2.0 |
| DB-Migrationen | SQL-Dateien in `supabase/migrations`, angewendet mit Supabase CLI (`supabase link`, `supabase db push`, ohne Docker) | MIT |

Modellnamen bei Cloudflare ändern sich. Vor dem Einbau die aktuelle Modellliste prüfen.

## Projektstruktur

```
src/
  app/        Routing von Next.js (Pflichtordner). Seiten und Route Handler bleiben dünn
              und rufen nur frontend/ bzw. backend/ auf.
  frontend/   components/ (ui/ = shadcn), hooks/, lib/ (Browser-Code, Supabase-Browser-Client)
  backend/    env.ts, supabase/, ai/ und künftige Services. Jede Datei beginnt mit
              `import "server-only"`, damit Secrets nie ins Browser-Bundle geraten.
```

- `frontend/` darf `backend/` nur für Typen importieren (`import type`).
- shadcn-Komponenten landen über `components.json` automatisch in `src/frontend/components/ui/`.

## Befehle

`npm run dev` · `npm run build` · `npm run lint` · `npx tsc --noEmit`

## Git

- Repo: https://github.com/A-Machi/quellwerk (privat, Branch `main`). Commits mit der GitHub-noreply-Adresse von A-Machi, nie mit der Firmen-E-Mail.
- `gh` muss auf den Account **A-Machi** geschaltet sein (`gh auth switch -u A-Machi`), nicht auf den Firmen-Account.
- **Conventional Commits** ohne ID und ohne Scope: `feat: …`, `fix: …`, `docs: …`, `chore: …`, `refactor: …`, `style: …`, `test: …`. Also nicht `feat(US-01): …` oder `feat: [US-01] …`.
- Beschreibung auf Deutsch.

## Next.js-Version

@AGENTS.md

Next.js 16 mit `cacheComponents` und `partialPrefetching` (siehe `next.config.ts`). Vor Code zu Routing, Caching, Proxy oder Datenabruf die passende Doku in `node_modules/next/dist/docs/` lesen.

## Arbeitsweise

- Sprache mit dem Nutzer: Deutsch.
- Vor dem Vorschlagen eines Tools oder Dienstes die vier Grundregeln prüfen und die Lizenz nennen.
- Modellnamen, URLs und Keys nur über Env-Variablen. Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_API_TOKEN`) nur serverseitig, nie mit `NEXT_PUBLIC_`.
- Datenbank-Änderungen nur als Migration im Repo, nicht im Supabase-Dashboard klicken.
- Free-Tier-Limits mitdenken: Erreicht ein Dienst sein Limit, zeigt das UI eine klare Meldung statt eines kaputten Zustands.
- Uploads gehen direkt vom Browser zu Supabase Storage, nicht durch eine API Route (4,5-MB-Limit von Vercel).
