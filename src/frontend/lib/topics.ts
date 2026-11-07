// Frage, die ein Klick auf ein Schlüsselthema im Chat stellt (US-14)
export function topicQuestion(topic: string): string {
  return `Was steht in den Quellen zu „${topic.trim()}“?`;
}
