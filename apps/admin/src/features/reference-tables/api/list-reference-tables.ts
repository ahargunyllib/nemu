import { orpc } from "@/shared/api/orpc";

export function listReferenceTablesQueryOptions() {
  return orpc.listReferenceTables.queryOptions();
}
