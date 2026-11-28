import type { client } from "@/shared/api/orpc";

/** A BPMN's panel data: task and gateway counts and each WS-04 element. */
export type ProcessDetail = Awaited<ReturnType<typeof client.getProcessDetail>>;
export type ProcessElement = ProcessDetail["elements"][number];
