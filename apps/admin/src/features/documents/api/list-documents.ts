import { orpc } from "@/shared/api/orpc";

/** WS-04 lists the school's own documents; WS-02 lists the built-in AlurSekolah package. */
export type DocumentScope = "alursekolah" | null;

export function listDocumentsQueryOptions(packageId: DocumentScope = null) {
  return orpc.listDocuments.queryOptions({ input: { packageId } });
}
