// Vorprüfung im Browser, damit offensichtlich falsche Dateien gar nicht erst
// hochgeladen werden. Die verbindliche Prüfung macht der Server
// (validatePdfUpload in src/backend/sources/service.ts) mit denselben Grenzen.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function checkPdfFile(file: { name: string; size: number; type: string }): string | null {
  const isPdf = file.name.toLowerCase().endsWith(".pdf") && (file.type === "application/pdf" || file.type === "");
  if (!isPdf) return `„${file.name}“ ist kein PDF.`;
  if (file.size === 0) return `„${file.name}“ ist leer.`;
  if (file.size > MAX_UPLOAD_BYTES) return `„${file.name}“ ist größer als 50 MB.`;
  return null;
}

// Grenzen für Text-Quellen, gleich wie parseTextSource im Backend
export const MAX_TEXT_SOURCE_CHARS = 200_000;
const MIN_TEXT_SOURCE_CHARS = 20;

export function checkTextSource(input: { title: string; text: string }): string | null {
  if (!input.title.trim()) return "Bitte gib einen Titel ein.";
  if (input.title.trim().length > 300) return "Der Titel darf höchstens 300 Zeichen lang sein.";
  const length = input.text.trim().length;
  if (length < MIN_TEXT_SOURCE_CHARS) return `Der Text muss mindestens ${MIN_TEXT_SOURCE_CHARS} Zeichen lang sein.`;
  if (length > MAX_TEXT_SOURCE_CHARS) return "Der Text ist zu lang.";
  return null;
}
