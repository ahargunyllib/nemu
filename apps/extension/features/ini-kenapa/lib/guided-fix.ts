import { normalizeControlName } from "@nemu/ai/school/safety";
import type { ExecutorStep, ExecutorTask } from "@nemu/contracts/executor";

import { accessibleName, findTarget, isVisible } from "../../executor/lib/find-target";
import type { AnswerNext } from "./explanation";

type GuidedFix = Extract<AnswerNext, { kind: "fix" }>;

const MENUS = [
  "a[href]",
  "[role=link]",
  "[role=menuitem]",
  "[role=tab]",
  "nav button",
  "[role=navigation] button",
].join(", ");

/**
 * The menu the kamus sentence names on the way to the target, when the target isn't on this page:
 * "Guru cukup membuka menu E-Kinerja dan menekan tombol Sinkro Ruang GTK" → "E-Kinerja". A menu
 * named before the target wins over one named after it.
 */
export function menuNamedIn(doc: Document, how: string, target: string): string | null {
  const sentence = ` ${normalizeControlName(how)} `;
  const wanted = normalizeControlName(target);
  const targetAt = sentence.indexOf(` ${wanted} `);
  const named = [...doc.querySelectorAll(MENUS)]
    .filter((element) => isVisible(element))
    .map((element) => {
      const name = accessibleName(element);
      const normalized = normalizeControlName(name);
      const at = normalized.length >= 3 ? sentence.indexOf(` ${normalized} `) : -1;
      return { name, at: normalized === wanted ? -1 : at };
    })
    .filter((menu) => menu.at >= 0)
    .sort((a, b) => a.at - b.at);
  const before = named.filter((menu) => targetAt < 0 || menu.at < targetAt);
  return (before.at(-1) ?? named[0])?.name ?? null;
}

/**
 * Cara 2 for an error the teacher can fix herself (F2-04): Nemu points at the control the Kamus
 * Kendala names and she presses it. When it is under another menu, Nemu first points at that menu.
 */
export function guidedFixTask(doc: Document, fix: GuidedFix): ExecutorTask {
  const point: ExecutorStep = {
    verb: "point",
    target: { label: fix.target },
    sentence: `Klik ${fix.target}.`,
  };
  const onPage = findTarget(doc, point.target).status !== "missing";
  const menu = onPage ? null : menuNamedIn(doc, fix.how, fix.target);
  return {
    kind: "ini-kenapa",
    title: `Perbaiki sendiri: ${fix.target}`,
    source: `Kamus Kendala ${fix.entryId}`,
    steps: menu ? [{ verb: "clickMenu", target: { label: menu } }, point] : [point],
  };
}
