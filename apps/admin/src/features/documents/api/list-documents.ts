import { orpc } from "@/shared/api/orpc";

export function listDocumentsQueryOptions() {
  return orpc.listDocuments.queryOptions();
}
