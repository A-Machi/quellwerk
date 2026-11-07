import path from "node:path";

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const alias = {
  "@tests": path.resolve(import.meta.dirname, "tests"),
  "@": path.resolve(import.meta.dirname, "src"),
  // "server-only" wirft außerhalb von React Server Components. In Tests ist das egal.
  "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
};

export default defineConfig(({ mode }) => ({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Echte Supabase-Datenbank: Werte aus .env.local
          env: loadEnv(mode, process.cwd(), ""),
          testTimeout: 60_000,
          hookTimeout: 60_000,
          // Nacheinander, um Rate Limits von Supabase Auth nicht zu reißen
          fileParallelism: false,
        },
      },
    ],
  },
}));
