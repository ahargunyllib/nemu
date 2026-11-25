import { z } from "zod";

import type {
  NarrationSegment,
  Procedure,
  ProcedureStep,
  RecordedEvent,
} from "@nemu/contracts/school";

import type { JsonCall } from "./llm.js";
import { isDeniedActionName } from "./safety.js";

/**
 * F3-01 (AI half): an operator's recording becomes reusable steps. Code cleans the raw events;
 * one model call at save time turns demo values into parameters and writes one short instruction
 * per step. Replay never calls a model (PRD §8). Save/Send/Submit steps are always the teacher's.
 */

type DraftStep = Omit<
  ProcedureStep,
  "id" | "order" | "valueTemplate" | "instruction" | "requiresHumanAction"
> & {
  value: string | null;
  t: number;
  label: string;
};

function locatorLabel(locator: RecordedEvent["locator"]): string {
  return locator.label ?? locator.name ?? locator.placeholder ?? locator.css ?? "elemen";
}

function sameTarget(left: RecordedEvent["locator"], right: RecordedEvent["locator"]): boolean {
  return (
    (left.css ?? "") === (right.css ?? "") &&
    (left.name ?? "") === (right.name ?? "") &&
    (left.label ?? "") === (right.label ?? "")
  );
}

function urlPattern(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

const VALUE_ROLES = new Set(["textbox", "combobox", "spinbutton", "searchbox", "listbox"]);

/** Pure: merges keystrokes, drops focus clicks and repeated navigation. */
export function cleanRecording(events: readonly RecordedEvent[]): DraftStep[] {
  const sorted = [...events].sort((left, right) => left.t - right.t);
  const steps: DraftStep[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index]!;
    const next = sorted[index + 1];
    const previous = steps.at(-1);

    if (event.type === "navigate") {
      if (previous?.action === "navigate" && previous.urlPattern === urlPattern(event.url))
        continue;
      steps.push({
        action: "navigate",
        locator: event.locator,
        urlPattern: urlPattern(event.url),
        value: null,
        t: event.t,
        label: event.url,
      });
      continue;
    }

    if (event.type === "click") {
      const focusClick =
        (event.locator.role && VALUE_ROLES.has(event.locator.role)) ||
        (next &&
          (next.type === "input" || next.type === "change") &&
          sameTarget(next.locator, event.locator));
      if (focusClick) continue;
      steps.push({
        action: "click",
        locator: event.locator,
        urlPattern: urlPattern(event.url),
        value: null,
        t: event.t,
        label: locatorLabel(event.locator),
      });
      continue;
    }

    const action = event.type === "change" && event.locator.role === "combobox" ? "select" : "fill";
    if (
      previous &&
      (previous.action === "fill" || previous.action === "select") &&
      sameTarget(previous.locator, event.locator)
    ) {
      previous.value = event.value;
      previous.action = action === "select" ? "select" : previous.action;
      continue;
    }
    steps.push({
      action,
      locator: event.locator,
      urlPattern: urlPattern(event.url),
      value: event.value,
      t: event.t,
      label: locatorLabel(event.locator),
    });
  }
  return steps;
}

/** Narration that overlaps each step (±1.5 s). */
export function narrationFor(
  step: { t: number },
  narration: readonly NarrationSegment[],
  next?: { t: number },
): string {
  const start = step.t - 1_500;
  const end = (next?.t ?? step.t) + 1_500;
  return narration
    .filter((segment) => segment.end >= start && segment.start <= end)
    .map((segment) => segment.text)
    .join(" ");
}

const compileSchema = z.object({
  title: z.string(),
  parameters: z.array(
    z.object({ name: z.string(), label: z.string(), question: z.string(), example: z.string() }),
  ),
  steps: z.array(
    z.object({
      index: z.number().int(),
      value_template: z.string().nullable(),
      instruction: z.string(),
    }),
  ),
});

const COMPILE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "parameters", "steps"],
  properties: {
    title: { type: "string" },
    parameters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "label", "question", "example"],
        properties: {
          name: { type: "string" },
          label: { type: "string" },
          question: { type: "string" },
          example: { type: "string" },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "value_template", "instruction"],
        properties: {
          index: { type: "integer" },
          value_template: { type: ["string", "null"] },
          instruction: { type: "string" },
        },
      },
    },
  },
} as const;

const COMPILE_INSTRUCTIONS = `Operator sekolah merekam cara mengerjakan sesuatu di aplikasi. Ubah rekaman menjadi langkah yang bisa dipakai ulang guru lain.
- Nilai contoh yang akan berbeda tiap kali dipakai (kelas, mata pelajaran, jenis penilaian, tanggal, nama) jadikan parameter: value_template "{{nama_parameter}}" (huruf kecil, garis bawah). Nilai yang selalu sama biarkan apa adanya.
- Narasi operator membantu: "misalnya", "sesuai kelas yang diajar" berarti parameter.
- Tiap parameter: label singkat, pertanyaan untuk guru (satu kalimat), dan example = nilai yang direkam.
- instruction: satu kalimat pendek (maks. 10 kata) untuk guru, sebut nama tombol/kolom di layar. Jangan pakai kata "salah".
- Langkah tanpa nilai (klik, pindah halaman): value_template null.`;

export type CompileProcedureInput = {
  title: string;
  events: readonly RecordedEvent[];
  narration: readonly NarrationSegment[];
};

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/gu, "_")
      .replace(/^_+|_+$/gu, "")
      .replace(/^(\d)/u, "p_$1") || "isian"
  );
}

export async function compileProcedure(
  deps: { llm: JsonCall },
  input: CompileProcedureInput,
): Promise<Procedure> {
  const drafts = cleanRecording(input.events);
  const response = await deps.llm({
    instructions: COMPILE_INSTRUCTIONS,
    content: [
      {
        type: "text",
        text: JSON.stringify({
          judul: input.title,
          langkah: drafts.map((draft, index) => ({
            index,
            aksi: draft.action,
            target: draft.label,
            nilai: draft.value,
            narasi: narrationFor(draft, input.narration, drafts[index + 1]),
          })),
        }),
      },
    ],
    schemaName: "procedure_compile",
    schema: COMPILE_JSON_SCHEMA,
    parse: (value) => compileSchema.parse(value),
    maxOutputTokens: 2_000,
  });
  return assembleProcedure(input.title, drafts, response);
}

/** Pure: validates the model's parameterization against the recording and applies the deny list. */
export function assembleProcedure(
  title: string,
  drafts: readonly DraftStep[],
  response: z.infer<typeof compileSchema>,
): Procedure {
  const parameters = new Map<string, Procedure["parameters"][number]>();
  for (const parameter of response.parameters) {
    const name = slug(parameter.name);
    if (!parameters.has(name)) {
      parameters.set(name, {
        name,
        label: parameter.label,
        question: parameter.question,
        example: parameter.example,
      });
    }
  }
  const byIndex = new Map(response.steps.map((step) => [step.index, step]));
  const used = new Set<string>();

  const steps: ProcedureStep[] = drafts.map((draft, index) => {
    const compiled = byIndex.get(index);
    let valueTemplate: string | null = draft.value;
    const template = compiled?.value_template ?? null;
    const parameterName = template?.match(/^\{\{\s*([a-z0-9_]+)\s*\}\}$/u)?.[1];
    if (draft.value !== null && parameterName && parameters.has(parameterName)) {
      valueTemplate = `{{${parameterName}}}`;
      used.add(parameterName);
      const parameter = parameters.get(parameterName)!;
      parameters.set(parameterName, { ...parameter, example: draft.value });
    }
    const requiresHumanAction = draft.action === "click" && isDeniedActionName(draft.label);
    const instruction = (compiled?.instruction?.trim() || defaultInstruction(draft)).replace(
      /\bsalah\b/giu,
      "keliru",
    );
    return {
      id: `step-${index + 1}`,
      order: index + 1,
      action: draft.action,
      locator: draft.locator,
      urlPattern: draft.urlPattern,
      valueTemplate: draft.action === "click" || draft.action === "navigate" ? null : valueTemplate,
      instruction: requiresHumanAction ? `Silakan tekan ${draft.label}.` : instruction,
      requiresHumanAction,
    };
  });

  return {
    title: response.title.trim() || title,
    parameters: [...parameters.values()].filter((parameter) => used.has(parameter.name)),
    steps,
  };
}

function defaultInstruction(draft: DraftStep): string {
  if (draft.action === "navigate") return "Buka halaman berikutnya.";
  if (draft.action === "click") return `Klik ${draft.label}.`;
  if (draft.action === "select") return `Pilih di kolom ${draft.label}.`;
  return `Isi kolom ${draft.label}.`;
}

export type ProcedureRun =
  | { status: "ok"; steps: Array<ProcedureStep & { value: string | null }> }
  | { status: "missing"; parameter: Procedure["parameters"][number] };

/** Pure: fills the parameters in; replay stops at the first human step (the executor's rule). */
export function instantiateProcedure(
  procedure: Procedure,
  values: Readonly<Record<string, string>>,
): ProcedureRun {
  for (const parameter of procedure.parameters) {
    if (!values[parameter.name]?.trim()) return { status: "missing", parameter };
  }
  return {
    status: "ok",
    steps: procedure.steps.map((step) => ({
      ...step,
      value: step.valueTemplate
        ? step.valueTemplate.replace(
            /\{\{\s*([a-z0-9_]+)\s*\}\}/gu,
            (_, name: string) => values[name] ?? "",
          )
        : null,
    })),
  };
}

/** "cara Pak Rizal · langkah 4": the knowledge text indexed for each step, for citations (F3-06). */
export function procedureKnowledgeTexts(
  procedure: Procedure,
): Array<{ article: string; text: string }> {
  return procedure.steps.map((step) => ({
    article: `langkah ${step.order}`,
    text: `${procedure.title}, langkah ${step.order}: ${step.instruction}${
      step.requiresHumanAction ? " (dikerjakan guru)" : ""
    }`,
  }));
}
