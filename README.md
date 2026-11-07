# Quellwerk

Quellen hochladen, mit ihnen chatten, jede Antwort mit Beleg. Ein privater Open-Source-Klon von NotebookLM.

Läuft komplett in kostenlosen Cloud-Tarifen: Vercel Hobby, Supabase Free, Cloudflare Workers AI Free.

## Entwicklung

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev                  # http://localhost:3000
```

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server |
| `npm run build` | Produktions-Build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck |

## Struktur

```
src/
  app/        Routing von Next.js: Seiten und API-Endpunkte, nur dünne Schicht
  frontend/   UI-Komponenten, Hooks, Browser-Code
  backend/    Serverlogik (Supabase, KI, Services), geschützt durch "server-only"
eval/         Planung: Evaluation und MVP-User-Stories
```

## Lizenz

MIT, siehe [LICENSE](LICENSE). Lizenzen der Abhängigkeiten: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
