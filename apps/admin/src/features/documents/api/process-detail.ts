import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/shared/api/orpc";

/** A BPMN's counts and elements for the knowledge panel (summary line, tasks, symptoms). */
export function processDetailQueryOptions(id: string) {
  return orpc.getProcessDetail.queryOptions({ input: { id } });
}

/** After a WS-04 element is corrected: the panel, the old element list, and the stat cards. */
export function invalidateProcessElements(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: orpc.getProcessDetail.key() }),
    queryClient.invalidateQueries({ queryKey: orpc.listProcessElements.key() }),
    queryClient.invalidateQueries({ queryKey: orpc.knowledgeStats.key() }),
  ]);
}
