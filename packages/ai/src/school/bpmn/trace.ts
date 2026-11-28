import type { ProcessFlow, ProcessGraph, ProcessNode } from "./graph.js";

/**
 * F3-12: from the element a symptom belongs to, walk the uploaded BPMN in code: back to the event
 * that set it off (or to where several paths merge), forward to the nearest end event, and over to
 * the step that undoes it (its "way back", from the WS-04 symptom index). Nothing here knows any
 * process by name: an SPP lock, a leave request or a tahfidz check all walk the same way (ADR-0010).
 */

/** One node on the walk and, for a gateway, the branch taken out of it. */
export type TraceHop = { node: ProcessNode; branch: ProcessFlow | null };

export type CauseTrace = {
  /** The element the teacher's words matched. */
  cause: ProcessNode;
  /** From the trigger (or the merge before it) up to and including the cause. */
  path: TraceHop[];
  /** The nodes after the cause up to the nearest end event, in order. */
  after: ProcessNode[];
  /** The step that undoes the cause and the gateway branch that leads to it, when known. */
  wayBack: {
    node: ProcessNode;
    condition: { gateway: ProcessNode; flow: ProcessFlow } | null;
  } | null;
};

const BRANCHING = new Set(["exclusiveGateway", "inclusiveGateway"]);
const TRIGGERS = new Set(["bpmn:StartEvent", "bpmn:BoundaryEvent", "bpmn:IntermediateCatchEvent"]);
const MAX_PATH = 8;

/** Start, boundary and intermediate catch events: where something from outside sets a path off. */
export function isTrigger(node: ProcessNode): boolean {
  return TRIGGERS.has(node.bpmnType);
}

function flowBetween(graph: ProcessGraph, from: string, to: string): ProcessFlow | null {
  for (const flowId of graph.nodes[from]?.outgoing ?? []) {
    const flow = graph.flows[flowId];
    if (flow?.target === to) return flow;
  }
  return null;
}

/** Back from the cause while the way is unambiguous: stops at a trigger, a merge or the start. */
function pathBack(graph: ProcessGraph, cause: ProcessNode): ProcessNode[] {
  const nodes = [cause];
  let current = cause;
  while (nodes.length < MAX_PATH && !isTrigger(current) && current.incoming.length === 1) {
    const flow = graph.flows[current.incoming[0]!];
    const source = flow ? graph.nodes[flow.source] : undefined;
    if (!source || nodes.includes(source)) break;
    nodes.unshift(source);
    current = source;
  }
  return nodes;
}

/** The shortest walk forward from `from` to `to`, breadth-first, or null. */
export function pathBetween(graph: ProcessGraph, from: string, to: string): ProcessNode[] | null {
  const cameFrom = new Map<string, string>();
  const seen = new Set([from]);
  let frontier = [from];
  while (frontier.length && !seen.has(to)) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const flowId of graph.nodes[id]?.outgoing ?? []) {
        const target = graph.flows[flowId]?.target;
        if (!target || seen.has(target) || !graph.nodes[target]) continue;
        seen.add(target);
        cameFrom.set(target, id);
        next.push(target);
      }
    }
    frontier = next;
  }
  if (!seen.has(to)) return null;
  const ids = [to];
  while (ids[0] !== from) ids.unshift(cameFrom.get(ids[0]!)!);
  return ids.length <= MAX_PATH ? ids.map((id) => graph.nodes[id]!) : null;
}

/** The nodes after `elementId` up to the nearest end event, breadth-first. */
function pathToEnd(graph: ProcessGraph, elementId: string): ProcessNode[] {
  const start = graph.nodes[elementId];
  if (!start || start.kind === "endEvent") return [];
  const ends = Object.values(graph.nodes).filter((node) => node.kind === "endEvent");
  const paths = ends
    .map((end) => pathBetween(graph, elementId, end.id))
    .filter((path): path is ProcessNode[] => !!path)
    .sort((a, b) => a.length - b.length);
  return paths[0]?.slice(1) ?? [];
}

/** The nearest gateway branch before `elementId`, searched backwards breadth-first. */
export function conditionBefore(
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

function hops(graph: ProcessGraph, nodes: ProcessNode[]): TraceHop[] {
  return nodes.map((node, index) => ({
    node,
    branch:
      BRANCHING.has(node.kind) && nodes[index + 1]
        ? flowBetween(graph, node.id, nodes[index + 1]!.id)
        : null,
  }));
}

/**
 * The walk for one question. `via` is an element the teacher named as what happened first
 * ("kalau bayar tunai"); it is used when the file has a path from it to the cause. `wayBackId` is
 * the step that undoes the cause, from the symptom index the operator corrects in WS-04.
 */
export function traceCause(
  graph: ProcessGraph,
  elementId: string,
  options: { via?: string | null; wayBackId?: string | null } = {},
): CauseTrace | null {
  const cause = graph.nodes[elementId];
  if (!cause) return null;
  const forward =
    options.via && options.via !== elementId ? pathBetween(graph, options.via, elementId) : null;
  // From the named step, the walk also goes back to what set that step off.
  const path = hops(
    graph,
    forward ? [...pathBack(graph, forward[0]!).slice(0, -1), ...forward] : pathBack(graph, cause),
  );
  const onPath = new Set(path.map((hop) => hop.node.id));
  const wayBackNode = options.wayBackId ? graph.nodes[options.wayBackId] : undefined;
  return {
    cause,
    path,
    after: pathToEnd(graph, elementId),
    wayBack:
      wayBackNode && !onPath.has(wayBackNode.id)
        ? { node: wayBackNode, condition: conditionBefore(graph, wayBackNode.id) }
        : null,
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

/**
 * A branch's conditions: "Regular, Overdue Left" lists conditions that all hold, so it reads
 * "Regular dan Overdue Left" (a model given the comma reads it as "or").
 */
export function branchConditions(flow: ProcessFlow): string {
  return (flow.name ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" dan ");
}

/** "Is Regular Invoice? (Yes)": a branch as the file labels it. */
export function branchLabel(gateway: ProcessNode, flow: ProcessFlow): string {
  const documented = flow.documentation || "";
  if (documented) return asClause(firstSentence(documented));
  return flow.name ? `${gateway.name} (${branchConditions(flow)})` : gateway.name;
}

export type StepDraft = {
  elementIds: string[];
  text: string;
  /** What the step is, for the model that puts it into plain words. */
  role: "trigger" | "condition" | "step" | "cause" | "way_back";
};

// Tasks a person does; service, script and send tasks and events are the system's.
const PERSON_TASKS = new Set(["bpmn:UserTask", "bpmn:ManualTask", "bpmn:Task"]);

function nodeText(node: ProcessNode): string {
  const documented = node.documentation ? firstSentence(node.documentation) : "";
  const by = node.lane && PERSON_TASKS.has(node.bpmnType) ? ` (oleh ${node.lane})` : "";
  return documented || `${node.name}${by}.`;
}

/**
 * Sumber for the teacher: 2–4 steps, each tied to the BPMN elements it comes from. The cause and
 * the way back always stay; then the branch that led to the cause, then the trigger, then the rest.
 */
export function stepDrafts(graph: ProcessGraph, trace: CauseTrace): StepDraft[] {
  const ranked: Array<StepDraft & { rank: number; order: number }> = [];
  let before = trace.path.slice(0, -1);
  // An end event is the outcome of the task before it: one step, told as that task.
  const outcomeOf = trace.cause.kind === "endEvent" ? before.at(-1) : undefined;
  if (outcomeOf?.node.kind === "task") before = before.slice(0, -1);
  const causeNodes =
    outcomeOf?.node.kind === "task" ? [outcomeOf.node, trace.cause] : [trace.cause];
  const nearestBranch = before.findLastIndex((hop) => !!hop.branch);
  // A trigger and the branch it decides right after it read as one step ("Tagihan SPP lewat jatuh
  // tempo." for the due date and "is it a regular invoice? yes").
  const trigger = before[0];
  const foldTrigger = !!trigger && isTrigger(trigger.node) && !!before[1]?.branch;
  before.forEach((hop, index) => {
    const { node, branch } = hop;
    if (foldTrigger && index === 0) return;
    if (foldTrigger && index === 1 && branch) {
      ranked.push({
        elementIds: [trigger!.node.id, node.id, branch.id],
        text: `${nodeText(trigger!.node).replace(/[.!?]+$/u, "")}: ${branchLabel(node, branch)}.`,
        role: "trigger",
        rank: index === nearestBranch ? 2 : 3,
        order: index,
      });
    } else if (branch) {
      ranked.push({
        elementIds: [node.id, branch.id],
        text: `${branchLabel(node, branch)}.`,
        role: "condition",
        rank: index === nearestBranch ? 2 : 4,
        order: index,
      });
    } else if (node.kind === "task" || isTrigger(node)) {
      ranked.push({
        elementIds: [node.id],
        text: nodeText(node),
        role: isTrigger(node) ? "trigger" : "step",
        rank: index === 0 ? 3 : 4,
        order: index,
      });
    }
  });
  ranked.push({
    elementIds: [...causeNodes.map((node) => node.id), ...trace.after.map((node) => node.id)],
    text: nodeText(causeNodes[0]!),
    role: "cause",
    rank: 1,
    order: before.length,
  });
  if (trace.wayBack) {
    const { node, condition } = trace.wayBack;
    ranked.push({
      elementIds: condition ? [condition.gateway.id, condition.flow.id, node.id] : [node.id],
      text: condition
        ? `${branchLabel(condition.gateway, condition.flow)} → ${nodeText(node)}`
        : nodeText(node),
      role: "way_back",
      rank: 1,
      order: before.length + 1,
    });
  }

  // Too short (a cause with nothing before it): add the step before the cause.
  if (ranked.length < 2) {
    const flow = graph.flows[trace.cause.incoming[0] ?? ""];
    const source = flow ? graph.nodes[flow.source] : undefined;
    if (source) {
      ranked.push({
        elementIds: [source.id],
        text: nodeText(source),
        role: "step",
        rank: 3,
        order: -1,
      });
    }
  }

  return ranked
    .toSorted((a, b) => a.rank - b.rank || b.order - a.order)
    .slice(0, 4)
    .toSorted((a, b) => a.order - b.order)
    .map(({ elementIds, text, role }) => ({ elementIds, text, role }));
}
