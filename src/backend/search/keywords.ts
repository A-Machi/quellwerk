import "server-only";

// Häufige deutsche und englische Wörter, die in fast jedem Abschnitt vorkommen.
// Ohne sie würde die Volltextsuche (ODER-Verknüpfung) beliebige Abschnitte finden.
const STOPWORDS = new Set(
  (
    "aber alle allem allen aller alles als also am an ander andere anderen auch auf aus bei beim bin bis bist da damit dann " +
    "das dass dazu dem den denn der des die dies diese diesem diesen dieser dieses doch dort du durch ein eine einem einen " +
    "einer eines er es etwas euch für gab gibt hab habe haben hat hatte hier hin ich ihm ihn ihr im in ins ist ja jede jedem " +
    "jeden jeder kann kein keine können man mehr mein mit muss nach nicht noch nun nur ob oder ohne sehr sein seine sich sie " +
    "sind so soll sollen steht stehen über um und uns unter viel vom von vor war waren was weil welche welcher welches wenn " +
    "wer werden wie wieder wird wo wurde zu zum zur zwischen erkläre erklär nenne nennen zeig zeige sag sage bitte quelle quellen " +
    "a about all also an and any are as at be been but by can do does for from had has have how i if in into is it its may " +
    "more most no not of on or our should so some such than that the their them then there these they this those to under " +
    "up was we were what when where which who why will with would you your explain tell list show describe source sources document"
  ).split(" "),
);

const MAX_TERMS = 12;

// Wörter, Zahlen und Kennungen wie "LLM05", "GPT-4" oder "ISO-27001" als Suchbegriffe.
export function extractSearchTerms(question: string): string[] {
  const tokens = question.toLowerCase().match(/[\p{L}\p{N}]+(?:[-_.][\p{L}\p{N}]+)*/gu) ?? [];
  const terms: string[] = [];
  for (const token of tokens) {
    if (token.length < 2 || STOPWORDS.has(token) || terms.includes(token)) continue;
    terms.push(token);
    // "gpt-4" findet die Volltextsuche (Konfiguration "simple") als "gpt" und "4"
    for (const part of token.split(/[-_.]/)) {
      if (part.length >= 2 && part !== token && !STOPWORDS.has(part) && !terms.includes(part)) terms.push(part);
    }
    if (terms.length >= MAX_TERMS) break;
  }
  return terms.slice(0, MAX_TERMS);
}
