import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/shared/api/orpc";

/** After a document is uploaded, saved, switched or deleted: the lists and the stat cards. */
export function invalidateKnowledge(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: orpc.listDocuments.key() }),
    queryClient.invalidateQueries({ queryKey: orpc.knowledgeStats.key() }),
  ]);
}
