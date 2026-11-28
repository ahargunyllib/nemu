/** "Ibu" / "Bapak" in a full sentence, from WS-06's "Bu" / "Pak". */
export function addressFor(honorific: string): string {
  if (honorific === "Bu") return "Ibu";
  if (honorific === "Pak") return "Bapak";
  return honorific || "Anda";
}
