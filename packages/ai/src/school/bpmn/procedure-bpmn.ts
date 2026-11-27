import type { Procedure } from "@nemu/contracts/school";
import { layoutProcess } from "bpmn-auto-layout";
import { BpmnModdle, type ModdleElement } from "bpmn-moddle";
import camundaDescriptor from "camunda-bpmn-moddle/resources/camunda.json" with { type: "json" };

/**
 * F3-03: a reviewed recording as BPMN 2.0 (Camunda 7 dialect, like AlurKerja Studio): one user
 * task per step for the teacher's group, a step only the teacher does as "Guru menekan Simpan",
 * each parameter as a form field on the step that first uses it, and each step's page as its task
 * link. `bpmn-auto-layout` draws it, so it opens in bpmn.io and Camunda Modeler.
 */

function idPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_]+/gu, "_").replace(/^_+|_+$/gu, "") || "x";
}

/** "Klik Al-Quran." stays; a human step reads "Guru menekan Simpan ujian". */
export function stepTaskName(step: Procedure["steps"][number]): string {
  const target = step.locator.name ?? step.locator.label ?? "tombol";
  if (step.requiresHumanAction) return `Guru menekan ${target}`;
  return step.instruction.replace(/\.$/u, "") || target;
}

export async function procedureToBpmn(procedure: Procedure): Promise<string> {
  const moddle = new BpmnModdle({ camunda: camundaDescriptor });
  const processId = `Process_${idPart(procedure.title)}`;
  const parameters = new Map(procedure.parameters.map((parameter) => [parameter.name, parameter]));
  const placed = new Set<string>();
  const elements: ModdleElement[] = [];
  const flows: ModdleElement[] = [];

  const start = moddle.create("bpmn:StartEvent", {
    id: "Start_Rekaman",
    name: procedure.recordedBy ? `Rekaman ${procedure.recordedBy}` : "Mulai",
  });
  elements.push(start);
  let previous: ModdleElement = start;

  const connect = (target: ModdleElement) => {
    const flow = moddle.create("bpmn:SequenceFlow", {
      id: `Flow_${flows.length + 1}`,
      sourceRef: previous,
      targetRef: target,
    });
    flows.push(flow);
    previous.outgoing = [...((previous.outgoing as ModdleElement[] | undefined) ?? []), flow];
    target.incoming = [...((target.incoming as ModdleElement[] | undefined) ?? []), flow];
    previous = target;
  };

  for (const step of procedure.steps) {
    const names = [...(step.valueTemplate ?? "").matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gu)].map(
      (match) => match[1]!,
    );
    const fields = names
      .filter((name) => parameters.has(name) && !placed.has(name))
      .map((name) => {
        placed.add(name);
        const parameter = parameters.get(name)!;
        return moddle.create("camunda:FormField", {
          id: name,
          label: parameter.label,
          type: "string",
          defaultValue: parameter.example || undefined,
          validation: moddle.create("camunda:Validation", {
            constraints: [moddle.create("camunda:Constraint", { name: "required" })],
          }),
        });
      });
    const values: ModdleElement[] = [];
    if (fields.length) values.push(moddle.create("camunda:FormData", { fields }));
    const task = moddle.create("bpmn:UserTask", {
      id: `Task_Langkah${step.order}`,
      name: stepTaskName(step),
      candidateGroups: "guru",
      documentation: [
        moddle.create("bpmn:Documentation", {
          text: step.requiresHumanAction
            ? `Dikerjakan guru: ${step.instruction}`
            : step.instruction,
        }),
      ],
      ...(values.length
        ? { extensionElements: moddle.create("bpmn:ExtensionElements", { values }) }
        : {}),
    });
    elements.push(task);
    connect(task);
  }

  const end = moddle.create("bpmn:EndEvent", { id: "End_Rekaman", name: "Selesai" });
  elements.push(end);
  connect(end);

  const process = moddle.create("bpmn:Process", {
    id: processId,
    name: procedure.title,
    isExecutable: true,
    documentation: [
      moddle.create("bpmn:Documentation", {
        text: `Direkam di Nemu${procedure.recordedBy ? ` oleh ${procedure.recordedBy}` : ""}. Langkah bertanda "Guru menekan" tidak pernah dikerjakan Nemu.`,
      }),
    ],
    flowElements: [...elements, ...flows],
  });
  const definitions = moddle.create("bpmn:Definitions", {
    id: `Definitions_${idPart(procedure.title)}`,
    targetNamespace: "http://nemu.id/bpmn",
    exporter: "Nemu",
    rootElements: [process],
  });
  const { xml } = await moddle.toXML(definitions, { format: true });
  return layoutProcess(xml);
}
