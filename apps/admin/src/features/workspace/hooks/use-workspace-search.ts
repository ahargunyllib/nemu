import { useQueries, useQuery } from "@tanstack/react-query";

import { listDocumentsQueryOptions } from "@/features/documents/api/list-documents";
import {
  type SearchResult,
  documentResults,
  stepResults,
} from "@/features/workspace/lib/search-results";
import { orpc } from "@/shared/api/orpc";

/**
 * Everything the top bar's search can find, loaded only once the palette opens: the school's
 * documents (the same query as Dokumen dan alur) and the tasks and events of each BPMN that was read.
 */
export function useWorkspaceSearch(open: boolean) {
  const documents = useQuery({ ...listDocumentsQueryOptions(), enabled: open });
  const processes = (documents.data ?? []).filter(
    (document) => document.format === "bpmn" && document.status === "ready",
  );
  const elements = useQueries({
    queries: processes.map((document) => ({
      ...orpc.listProcessElements.queryOptions({ input: { id: document.id } }),
      enabled: open,
    })),
  });

  const results: SearchResult[] = [
    ...documentResults(documents.data ?? []),
    ...processes.flatMap((document, index) => stepResults(document, elements[index]?.data ?? [])),
  ];

  return {
    results,
    isPending: documents.isPending || elements.some((query) => query.isPending),
  };
}
