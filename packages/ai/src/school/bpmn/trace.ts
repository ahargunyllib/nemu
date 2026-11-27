import type { ProcessFlow, ProcessGraph, ProcessNode } from "./graph.js";

/**
 * F3-12: from the element a symptom belongs to, walk the uploaded BPMN in code to the condition
 * that led there and to the way back (the nearest end event). Nothing here knows any process by
 * name: an SPP lock, a leave request or a tahfidz check all walk the same way (ADR-0010).
 */

export type CauseTrace = {
  /** The task or end event the symptom belongs to. */
  cause: ProcessNode;
  /** The gateway branch that led to the cause, when the walk back meets one. */
  condition: { gateway: ProcessNode; flow: ProcessFlow } | null;
  /** The nodes after the cause up to the nearest end event, in order. */
  wayBack: ProcessNode[];
  /** The flows taken on the way back. */
  wayBackFlows: ProcessFlow[];
};

const BRANCHING = new Set(["exclusiveGateway", "inclusiveGateway"]);

/** The nearest gateway branch before `elementId`, searched backwards breadth-first. */
function conditionBefore(
  graph: ProcessGraph,
  elementId: string,
): { gateway: ProcessNode; flow: ProcessFlow } | null {
  const seen = new Set([elementId]);
  let frontier = [elementId];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const flowId of graph.nodes[id]?.incoming ?? []) {
        const flow = graph.flows[flowId];
        const source = flow ? graph.nodes[flow.source] : undefined;
        if (!flow || !source) continue;
        if (BRANCHING.has(source.kind) && source.outgoing.length > 1) {
          return { gateway: source, flow };
        }
        if (!seen.has(source.id)) {
          seen.add(source.id);
          next.push(source.id);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** The shortest path from `elementId` to an end event, breadth-first, never revisiting a node. */
function wayBackFrom(
  graph: ProcessGraph,
  elementId: string,
): { nodes: ProcessNode[]; flows: ProcessFlow[] } {
  const start = graph.nodes[elementId];
  if (!start || start.kind === "endEvent") return { nodes: [], flows: [] };
  const cameFrom = new Map<string, ProcessFlow>();
  const seen = new Set([elementId]);
  let frontier = [elementId];
  let end: string | null = null;
  while (frontier.length && !end) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const flowId of graph.nodes[id]?.outgoing ?? []) {
        const flow = graph.flows[flowId];
        const target = flow ? graph.nodes[flow.target] : undefined;
        if (!flow || !target || seen.has(target.id)) continue;
        seen.add(target.id);
        cameFrom.set(target.id, flow);
        if (target.kind === "endEvent") {
          end = target.id;
          break;
        }
        next.push(target.id);
      }
      if (end) break;
    }
    frontier = next;
  }
  if (!end) return { nodes: [], flows: [] };
  const nodes: ProcessNode[] = [];
  const flows: ProcessFlow[] = [];
  for (let id = end; id !== elementId;) {
    const flow = cameFrom.get(id)!;
    nodes.unshift(graph.nodes[id]!);
    flows.unshift(flow);
    id = flow.source;
  }
  return { nodes, flows };
}

export function traceCause(graph: ProcessGraph, elementId: string): CauseTrace | null {
  const cause = graph.nodes[elementId];
  if (!cause) return null;
  const { nodes, flows } = wayBackFrom(graph, elementId);
  return {
    cause,
    condition: conditionBefore(graph, elementId),
    wayBack: nodes,
    wayBackFlows: flows,
  };
}

/** "Satu. Dua." → "Satu." */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  return trimmed.split(/(?<=[.!?])\s+/u)[0] ?? trimmed;
}

/** "SPP belum lunas." → "SPP belum lunas"; "Belum lunas" → "belum lunas" (keeps "SPP"). */
export function asClause(sentence: string): string {
  const text = sentence.trim().replace(/[.!?\s]+$/u, "");
  return /^\p{Lu}\p{Ll}/u.test(text)
    ? `${text[0]!.toLocaleLowerCase("id-ID")}${text.slice(1)}`
    : text;
}

export function capitalize(text: string): string {
  return text ? `${text[0]!.toLocaleUpperCase("id-ID")}${text.slice(1)}` : text;
}

/** What led to the cause in plain words, from the branch's documentation or its labels. */
export function conditionClause(trace: CauseTrace): string {
  const { condition, cause } = trace;
  if (condition) {
    const documented = condition.flow.documentation || "";
    if (documented) return asClause(firstSentence(documented));
    const question = condition.gateway.name.replace(/\?\s*$/u, "");
    return condition.flow.name
      ? `${asClause(question)}: ${asClause(condition.flow.name)}`
      : asClause(question);
  }
  return `langkah "${cause.name}" berjalan`;
}

export type StepDraft = { elementIds: string[]; text: string };

function nodeStep(node: ProcessNode): StepDraft {
  const documented = node.documentation ? firstSentence(node.documentation) : "";
  return {
    elementIds: [node.id],
    text: documented || `${node.name}${node.lane ? ` (oleh ${node.lane})` : ""}.`,
  };
}

/**
 * Sumber for the teacher: 2–4 steps, each tied to the BPMN elements it comes from. The branch,
 * the cause, then the way back: the fixer's task and the last task before the end event.
 */
export function stepDrafts(
  graph: ProcessGraph,
  trace: CauseTrace,
  fixerTaskId: string | null,
): StepDraft[] {
  const steps: StepDraft[] = [];
  if (trace.condition) {
    const { gateway, flow } = trace.condition;
    const documented = flow.documentation || gateway.documentation;
    steps.push({
      elementIds: [gateway.id, flow.id],
      text: documented
        ? firstSentence(documented)
        : `${gateway.name}${flow.name ? ` ${flow.name}.` : ""}`,
    });
  }
  steps.push(nodeStep(trace.cause));

  const tasks = trace.wayBack.filter((node) => node.kind === "task");
  const picked = [
    ...new Set(
      [tasks.find((node) => node.id === fixerTaskId), tasks.at(-1)].filter(
        (node): node is ProcessNode => !!node,
      ),
    ),
  ];
  for (const node of picked) if (steps.length < 4) steps.push(nodeStep(node));

  // Too short (an end-event symptom with no branch): add the step before the cause.
  if (steps.length < 2) {
    const flow = graph.flows[trace.cause.incoming[0] ?? ""];
    const before = flow ? graph.nodes[flow.source] : undefined;
    if (before) steps.unshift(nodeStep(before));
  }
  return steps;
}
