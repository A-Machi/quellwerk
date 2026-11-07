import { PDFDocument, StandardFonts } from "pdf-lib";

// Erzeugt ein echtes PDF mit Textschicht, eine Seite pro Eintrag.
// Ein leerer String ergibt eine Seite ohne Text (wie ein Scan).
export async function makePdf(pages: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = doc.addPage([595, 842]);
    if (text) {
      page.drawText(text, { x: 50, y: 790, size: 11, font, maxWidth: 495, lineHeight: 14 });
    }
  }
  return doc.save();
}
