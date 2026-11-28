import type { ProcessGraph, ProcessNode } from "@nemu/ai/school/bpmn/graph";

import type { ProcessElementRecord } from "./catalog-repository";

/** Who does a BPMN task: a person in a lane (Nemu can help) or the system (Nemu never does it). */
export type TaskPerformer = "person" | "system";

const SYSTEM_TASKS = new Set([
  "bpmn:ServiceTask",
  "bpmn:ScriptTask",
  "bpmn:BusinessRuleTask",
  "bpmn:SendTask",
  "bpmn:ReceiveTask",
]);

export function taskPerformer(node: Pick<ProcessNode, "bpmnType">): TaskPerformer {
  return SYSTEM_TASKS.has(node.bpmnType) ? "system" : "person";
}

export type ProcessSummary = {
  taskCount: number;
  gatewayCount: number;
  /** A person's tasks with no page to open: Nemu can only explain them (WS-04 "terpetakan"). */
  unmappedTasks: number;
};

/**
 * Dokumen dan alur's counts for one BPMN: its tasks and gateways, and how many of the people's
 * tasks have no page yet, from the BPMN link or the page the operator kept in WS-04.
 */
export function summarizeProcess(
  graph: ProcessGraph,
  elements: Pick<ProcessElementRecord, "elementId" | "page">[],
): ProcessSummary {
  const pages = new Map(elements.map((element) => [element.elementId, element.page]));
  const nodes = Object.values(graph.nodes);
  const tasks = nodes.filter((node) => node.kind === "task");
  return {
    taskCount: tasks.length,
    gatewayCount: nodes.filter((node) => node.bpmnType.endsWith("Gateway")).length,
    unmappedTasks: tasks.filter(
      (node) => taskPerformer(node) === "person" && !(node.link ?? pages.get(node.id)),
    ).length,
  };
}
