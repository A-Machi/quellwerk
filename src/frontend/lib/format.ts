const dateFormat = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatSourceCount(count: number): string {
  return count === 1 ? "1 Quelle" : `${count} Quellen`;
}
