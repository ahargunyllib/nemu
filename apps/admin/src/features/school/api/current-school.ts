import { orpc } from "@/shared/api/orpc";

/** The school the signed-in operator or admin works in; the top bar and the side menu share it. */
export function currentSchoolQueryOptions() {
  return orpc.currentSchool.queryOptions({ staleTime: Number.POSITIVE_INFINITY });
}
