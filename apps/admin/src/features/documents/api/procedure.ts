import { orpc } from "@/shared/api/orpc";

/** A saved recording's steps and parameters, for the knowledge panel. */
export function procedureQueryOptions(documentId: string) {
  return orpc.procedureGet.queryOptions({ input: { documentId } });
}
