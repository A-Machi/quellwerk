# Third-Party-Lizenzen

Alle Abhängigkeiten von Quellwerk mit ihrer Lizenz. Regeln: siehe [CLAUDE.md](CLAUDE.md#lizenzregeln-für-abhängigkeiten). Bei jeder neuen Abhängigkeit hier ergänzen.

Stand: 2026-11-07

## Direkte npm-Abhängigkeiten

| Paket | Version | Lizenz | Art | Quelle |
|---|---|---|---|---|
| next | 16.4.5 | MIT | Laufzeit | https://github.com/vercel/next.js |
| react | 19.3.0 | MIT | Laufzeit | https://github.com/facebook/react |
| react-dom | 19.3.0 | MIT | Laufzeit | https://github.com/facebook/react |
| ai | 7.0.164 | Apache-2.0 | Laufzeit | https://github.com/vercel/ai |
| @ai-sdk/openai-compatible | 3.0.86 | Apache-2.0 | Laufzeit | https://github.com/vercel/ai |
| @supabase/supabase-js | 2.119.0 | MIT | Laufzeit | https://github.com/supabase/supabase-js |
| @supabase/ssr | 0.12.7 | MIT | Laufzeit | https://github.com/supabase/ssr |
| zod | 4.6.7 | MIT | Laufzeit | https://github.com/colinhacks/zod |
| server-only | 0.0.1 | MIT | Laufzeit | https://github.com/facebook/react |
| @base-ui/react | 1.9.0 | MIT | Laufzeit | https://github.com/mui/base-ui |
| shadcn | 4.23.0 | MIT | Laufzeit | https://github.com/shadcn-ui/ui |
| cn | 0.5.2 | MIT | Laufzeit | https://github.com/shadcn-ui/cn |
| class-variance-authority | 0.7.1 | Apache-2.0 | Laufzeit | https://github.com/joe-bell/cva |
| lucide-react | 1.70.0 | ISC | Laufzeit | https://github.com/lucide-icons/lucide |
| react-resizable-panels | 4.19.1 | MIT | Laufzeit | https://github.com/bvaughn/react-resizable-panels |
| tw-animate-css | 1.4.0 | MIT | Laufzeit | https://github.com/Wombosvideo/tw-animate-css |
| tailwindcss | 4.3.5 | MIT | Entwicklung | https://github.com/tailwindlabs/tailwindcss |
| @tailwindcss/turbopack | 4.3.5 | MIT | Entwicklung | https://github.com/tailwindlabs/tailwindcss |
| typescript | 5.9.3 | Apache-2.0 | Entwicklung | https://github.com/microsoft/TypeScript |
| eslint | 9.39.5 | MIT | Entwicklung | https://github.com/eslint/eslint |
| eslint-config-next | 16.4.5 | MIT | Entwicklung | https://github.com/vercel/next.js |
| @types/node, @types/react, @types/react-dom | 20.x / 19.x | MIT | Entwicklung | https://github.com/DefinitelyTyped/DefinitelyTyped |

Die UI-Komponenten unter `src/frontend/components/ui/` stammen aus shadcn/ui (MIT) und wurden ins Projekt kopiert.

## Schriften

| Schrift | Lizenz | Einbindung |
|---|---|---|
| Geist, Geist Mono | SIL Open Font License 1.1 | `next/font/google`, beim Build geladen und selbst ausgeliefert |

## Transitive Abhängigkeiten (Prüfung 2026-11-07)

Alle 642 Einträge aus `package-lock.json` geprüft (inkl. optionaler Plattform-Pakete). **Keine GPL, keine AGPL, kein Paket ohne Lizenzangabe.**

| Lizenz | Anzahl | Bewertung |
|---|---|---|
| MIT, Apache-2.0, ISC, BSD-2/3-Clause, 0BSD, BlueOak-1.0.0, CC0-1.0, Python-2.0 | 613 | ✅ erlaubt |
| CC-BY-4.0 (`caniuse-lite`, Browserdaten) | 1 | ✅ erlaubt, Namensnennung ist im Paket enthalten |
| AFL-2.1 OR BSD-3-Clause (`json-schema`) | 1 | ✅ wir nutzen es unter BSD-3-Clause |
| MPL-2.0 (`lightningcss`, `axe-core`) | 13 | ⚠️ erlaubt, nur Build- und Lint-Werkzeuge, unverändert genutzt |
| LGPL-3.0-or-later (`@img/sharp-*`, libvips für `next/image`) | 14 | ⚠️ erlaubt, optionale Bibliothek, unverändert und dynamisch eingebunden |

**Bedingung für MPL und LGPL:** Diese Pakete werden nicht verändert. Würden wir sie ändern, müssten die Änderungen offengelegt werden.
