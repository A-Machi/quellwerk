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
