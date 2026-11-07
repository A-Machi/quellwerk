// Öffnet ein PDF im eingebauten PDF-Viewer des Browsers auf einer bestimmten Seite.
// Chrome, Edge, Firefox und Safari verstehen das Fragment "#page=n".
export function pdfPageUrl(fileUrl: string, pageNumber: number | null): string {
  const base = fileUrl.split("#")[0];
  return pageNumber && pageNumber > 0 ? `${base}#page=${pageNumber}` : base;
}
