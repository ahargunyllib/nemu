/** "K-03" → "K-04": the code a new kamus row starts with. */
export function nextCode(codes: string[]): string {
  const numbers = codes.map((code) => Number(code.match(/(\d+)$/u)?.[1] ?? 0));
  return `K-${String(Math.max(0, ...numbers) + 1).padStart(2, "0")}`;
}
