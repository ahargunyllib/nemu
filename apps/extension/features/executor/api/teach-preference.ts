import { storage } from "wxt/utils/storage";

/**
 * F0-14: the kinds of task the teacher asked to try herself next time ("Coba sendiri").
 * The next run of such a task starts in cara 2; it stays on this browser.
 */
const teachNextTimeItem = storage.defineItem<string[]>("local:executorTeachKinds", {
  fallback: [],
});

export async function wantsToTry(kind: string): Promise<boolean> {
  return (await teachNextTimeItem.getValue()).includes(kind);
}

export async function tryNextTime(kind: string): Promise<void> {
  const kinds = await teachNextTimeItem.getValue();
  if (!kinds.includes(kind)) await teachNextTimeItem.setValue([...kinds, kind]);
}
