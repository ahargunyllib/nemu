import { BpmnModdle, type ModdleElement } from "bpmn-moddle";
import camundaDescriptor from "camunda-bpmn-moddle/resources/camunda.json" with { type: "json" };

/**
 * F3-03: an uploaded BPMN 2.0 file (AlurKerja Studio exports Camunda 7 dialect) becomes a plain
 * process graph Nemu can walk without a model: tasks with their lane, form fields and
 * documentation, and gateways with each flow's condition.
 */

export type FormFieldType = "string" | "long" | "boolean" | "date" | "enum" | "file";

export type FormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  defaultValue: string | null;
  options: Array<{ id: string; name: string }>;
};

export type ConditionLanguage = "juel" | "feel" | "label";

export type ProcessFlow = {
  id: string;
  name: string | null;
  source: string;
  target: string;
  condition: { language: ConditionLanguage; body: string } | null;
};

export type ProcessNodeKind =
  | "startEvent"
  | "endEvent"
  | "task"
  | "exclusiveGateway"
  | "parallelGateway"
  | "inclusiveGateway"
  | "other";

export type ProcessNode = {
  id: string;
  kind: ProcessNodeKind;
  bpmnType: string;
  name: string;
  documentation: string;
  lane: string | null;
  candidateGroups: string[];
  assignee: string | null;
  formFields: FormField[];
  incoming: string[];
  outgoing: string[];
  defaultFlow: string | null;
};

export type ProcessGraph = {
  id: string;
  name: string;
  documentation: string;
  startIds: string[];
  nodes: Record<string, ProcessNode>;
  flows: Record<string, ProcessFlow>;
  lanes: string[];
  warnings: string[];
};

type Element = ModdleElement & Record<string, unknown>;

function asArray(value: unknown): Element[] {
  return Array.isArray(value) ? (value as Element[]) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function documentationOf(element: Element): string {
  return asArray(element.documentation)
    .map((doc) => text(doc.text).trim())
    .filter(Boolean)
    .join("\n");
}

function kindOf(type: string): ProcessNodeKind {
  if (type === "bpmn:StartEvent") return "startEvent";
  if (type === "bpmn:EndEvent") return "endEvent";
  if (type === "bpmn:ExclusiveGateway") return "exclusiveGateway";
  if (type === "bpmn:ParallelGateway") return "parallelGateway";
  if (type === "bpmn:InclusiveGateway") return "inclusiveGateway";
  if (/Task$/u.test(type) || type === "bpmn:SubProcess" || type === "bpmn:CallActivity")
    return "task";
  return "other";
}

const FILE_FIELD = /\b(surat|lampiran|unggah|upload|file|dokumen|berkas)\b/iu;

function fieldType(raw: string, id: string, label: string): FormFieldType {
  const type = raw.toLowerCase();
  if (FILE_FIELD.test(`${id.replace(/_/gu, " ")} ${label}`)) return "file";
  if (type === "long" || type === "integer" || type === "number") return "long";
  if (type === "boolean") return "boolean";
  if (type === "date") return "date";
  if (type === "enum") return "enum";
  return "string";
}

/** Camunda formData, Flowable formProperty, or unknown namespaces via $children/$attrs. */
function formFieldsOf(element: Element): FormField[] {
  const extension = element.extensionElements as Element | undefined;
  const values = asArray(extension?.values);
  const fields: FormField[] = [];
  for (const value of values) {
    if (value.$type === "camunda:FormData") {
      for (const field of asArray(value.fields)) {
        const id = text(field.id);
        const label = text(field.label) || id;
        const constraints = asArray((field.validation as Element | undefined)?.constraints);
        fields.push({
          id,
          label,
          type: fieldType(text(field.type), id, label),
          required: constraints.some((constraint) => text(constraint.name) === "required"),
          defaultValue: text(field.defaultValue) || null,
          options: asArray(field.values).map((option) => ({
            id: text(option.id),
            name: text(option.name) || text(option.id),
          })),
        });
      }
      continue;
    }
    // Generic fallback for flowable:formProperty and other dialects bpmn-moddle keeps as raw children.
    const local = value.$type.split(":").pop()?.toLowerCase() ?? "";
    if (local === "formproperty" || local === "formfield") {
      const attrs = (value.$attrs ?? {}) as Record<string, string>;
      const id = text(value.id) || attrs.id || "";
      const label = text(value.name) || attrs.name || attrs.label || id;
      fields.push({
        id,
        label,
        type: fieldType(attrs.type ?? "string", id, label),
        required: attrs.required === "true",
        defaultValue: attrs.default ?? attrs.defaultValue ?? null,
        options: asArray(value.$children).map((child) => {
          const childAttrs = (child.$attrs ?? {}) as Record<string, string>;
          return {
            id: text(child.id) || childAttrs.id || "",
            name: text(child.name) || childAttrs.name || "",
          };
        }),
      });
    }
  }
  return fields;
}

function conditionOf(flow: Element): ProcessFlow["condition"] {
  const expression = flow.conditionExpression as Element | undefined;
  const body = text(expression?.body).trim();
  if (body) {
    const language = text(expression?.language).toLowerCase();
    if (language === "feel" || body.startsWith("=")) {
      return { language: "feel", body: body.replace(/^=\s*/u, "") };
    }
    return { language: "juel", body };
  }
  return null;
}

export async function importBpmn(xml: string): Promise<ProcessGraph> {
  const moddle = new BpmnModdle({ camunda: camundaDescriptor });
  const { rootElement, warnings: parseWarnings } = await moddle.fromXML(xml);
  const warnings = parseWarnings.map((warning) => warning.message);
  const process = asArray(rootElement.rootElements).find(
    (element) => element.$type === "bpmn:Process",
  );
  if (!process) throw new Error("The BPMN file has no process");

  const laneOf = new Map<string, string>();
  const lanes: string[] = [];
  for (const laneSet of asArray(process.laneSets)) {
    for (const lane of asArray(laneSet.lanes)) {
      const laneName = text(lane.name) || text(lane.id);
      lanes.push(laneName);
      for (const ref of asArray(lane.flowNodeRef)) laneOf.set(text(ref.id), laneName);
    }
  }

  const nodes: Record<string, ProcessNode> = {};
  const flows: Record<string, ProcessFlow> = {};
  for (const element of asArray(process.flowElements)) {
    const id = text(element.id);
    if (element.$type === "bpmn:SequenceFlow") {
      flows[id] = {
        id,
        name: text(element.name) || null,
        source: text((element.sourceRef as Element | undefined)?.id),
        target: text((element.targetRef as Element | undefined)?.id),
        condition: conditionOf(element),
      };
      continue;
    }
    const groups = text(element.candidateGroups);
    nodes[id] = {
      id,
      kind: kindOf(element.$type),
      bpmnType: element.$type,
      name: text(element.name) || id,
      documentation: documentationOf(element),
      lane: laneOf.get(id) ?? null,
      candidateGroups: groups
        ? groups
            .split(",")
            .map((group) => group.trim())
            .filter(Boolean)
        : [],
      assignee: text(element.assignee) || null,
      formFields: formFieldsOf(element),
      incoming: asArray(element.incoming).map((flow) => text(flow.id)),
      outgoing: asArray(element.outgoing).map((flow) => text(flow.id)),
      defaultFlow: text((element.default as Element | undefined)?.id) || null,
    };
  }

  // Flows drawn with only a label ("Sakit > 1 hari") can't be evaluated; keep the label for review.
  for (const flow of Object.values(flows)) {
    const source = nodes[flow.source];
    if (
      source?.kind === "exclusiveGateway" &&
      source.outgoing.length > 1 &&
      !flow.condition &&
      source.defaultFlow !== flow.id
    ) {
      if (flow.name) {
        flow.condition = { language: "label", body: flow.name };
        warnings.push(
          `Flow ${flow.id} ("${flow.name}") has only a label; ask the operator to add a condition.`,
        );
      } else {
        warnings.push(
          `Flow ${flow.id} out of ${source.id} has no condition and is not the default.`,
        );
      }
    }
  }

  return {
    id: text(process.id),
    name: text(process.name) || text(process.id),
    documentation: documentationOf(process),
    startIds: Object.values(nodes)
      .filter((node) => node.kind === "startEvent")
      .map((node) => node.id),
    nodes,
    flows,
    lanes,
    warnings,
  };
}

/** Knowledge chunks for grounding and the "Sumber: Alur Izin Guru" citation, one per task. */
export function bpmnKnowledgeTexts(graph: ProcessGraph): Array<{ article: string; text: string }> {
  return Object.values(graph.nodes)
    .filter((node) => node.kind === "task" || node.kind === "exclusiveGateway")
    .map((node) => {
      const fields = node.formFields.map((field) =>
        field.options.length
          ? `${field.label} (${field.options.map((option) => option.name).join(", ")})`
          : field.label,
      );
      const outgoing = node.outgoing
        .map((flowId) => graph.flows[flowId])
        .filter((flow): flow is ProcessFlow => !!flow)
        .map(
          (flow) => `${flow.name ?? "lanjut"} → ${graph.nodes[flow.target]?.name ?? flow.target}`,
        );
      return {
        article: `${graph.name} › ${node.name}`,
        text: [
          `${node.name}${node.lane ? ` (oleh ${node.lane})` : ""}.`,
          node.documentation,
          fields.length ? `Isian: ${fields.join("; ")}.` : "",
          outgoing.length > 1 ? `Cabang: ${outgoing.join("; ")}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    });
}
