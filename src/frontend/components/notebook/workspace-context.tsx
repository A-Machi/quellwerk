"use client";

import { createContext, use, useCallback, useMemo, useRef, useSyncExternalStore } from "react";

import type { SourceSummary } from "@/backend/sources/service";
import { parseDeselected, selectAllState, selectedSourceIds, type SelectAllState } from "@/frontend/lib/source-selection";

type Workspace = {
  notebookId: string;
  sources: SourceSummary[];
  selectedIds: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string, selected: boolean) => void;
  allState: SelectAllState;
  setAll: (selected: boolean) => void;
  // Frage an den Chat schicken, z. B. per Klick auf ein Schlüsselthema (US-14)
  ask: (question: string) => void;
  registerAsk: (handler: ((question: string) => void) | null) => void;
};

const WorkspaceContext = createContext<Workspace | null>(null);

// Die Auswahl liegt im localStorage, damit sie ein Neuladen übersteht.
// Ohne localStorage (z. B. privater Modus) gilt sie nur für diesen Besuch.
const CHANGE_EVENT = "quellwerk:selection-change";
const memoryFallback = new Map<string, string>();

const storageKey = (notebookId: string) => `quellwerk:deselected:${notebookId}`;

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memoryFallback.set(key, value);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// Gemeinsamer Zustand von Quellen- und Chat-Spalte: welche Quellen der Chat nutzt.
export function WorkspaceProvider({
  notebookId,
  sources,
  children,
}: {
  notebookId: string;
  sources: SourceSummary[];
  children: React.ReactNode;
}) {
  const key = storageKey(notebookId);
  // Auf dem Server gibt es keinen localStorage: dort ist alles ausgewählt.
  const raw = useSyncExternalStore(subscribe, () => readStored(key), () => null);
  const askHandler = useRef<((question: string) => void) | null>(null);
  const ask = useCallback((question: string) => askHandler.current?.(question), []);
  const registerAsk = useCallback((handler: ((question: string) => void) | null) => {
    askHandler.current = handler;
  }, []);

  const value = useMemo<Workspace>(() => {
    const deselected = parseDeselected(raw);
    const save = (next: Set<string>) => writeStored(key, JSON.stringify([...next]));
    return {
      notebookId,
      sources,
      selectedIds: selectedSourceIds(sources, deselected),
      isSelected: (id) => !deselected.has(id),
      toggle: (id, selected) => {
        const next = new Set(deselected);
        if (selected) next.delete(id);
        else next.add(id);
        save(next);
      },
      allState: selectAllState(sources, deselected),
      setAll: (selected) =>
        save(selected ? new Set() : new Set(sources.filter((s) => s.status === "ready").map((s) => s.id))),
      ask,
      registerAsk,
    };
  }, [ask, key, notebookId, raw, registerAsk, sources]);

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

export function useWorkspace(): Workspace {
  const workspace = use(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace braucht einen WorkspaceProvider");
  return workspace;
}
