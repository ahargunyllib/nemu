/** Ends a line the Nemu Service sends, such as a warning, with a full stop when it has none. */
export function asSentence(text: string): string {
  return /[.!?…]$/.test(text.trim()) ? text : `${text}.`;
}
