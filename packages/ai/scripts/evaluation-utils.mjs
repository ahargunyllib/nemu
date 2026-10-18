function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function summarizeMomentLatency(momentResults, targetMs = 8_000) {
  const moment1 = median(momentResults.moment1.map((result) => result.total_ms));
  const moment2 = median(momentResults.moment2.map((result) => result.total_ms));
  const moment3Initial = median(momentResults.moment3.map((result) => result.initial_ms));
  const moment3FollowUp = median(momentResults.moment3.map((result) => result.follow_up_ms));
  const moment3EndToEnd = median(momentResults.moment3.map((result) => result.end_to_end_ms));
  const responseMedians = [moment1, moment2, moment3Initial, moment3FollowUp].filter(
    (value) => value !== null,
  );

  return {
    moment1,
    moment2,
    moment3_initial: moment3Initial,
    moment3_follow_up: moment3FollowUp,
    moment3_end_to_end: moment3EndToEnd,
    within_8s_target:
      responseMedians.length > 0 && responseMedians.every((value) => value <= targetMs),
  };
}

export function parseEvaluationOptions(args) {
  const isLive = args.includes("--live");
  const momentsArgument = args.find((argument) => argument.startsWith("--moments="));
  let selectedMoments = null;

  if (momentsArgument) {
    selectedMoments = [
      ...new Set(
        momentsArgument
          .slice("--moments=".length)
          .split(",")
          .map((value) => Number(value)),
      ),
    ].sort((left, right) => left - right);

    if (
      !selectedMoments.length ||
      selectedMoments.some((moment) => !Number.isInteger(moment) || moment < 1 || moment > 3)
    ) {
      throw new Error("--moments must contain a comma-separated subset of 1,2,3");
    }
    if (!isLive) {
      throw new Error("Selective moment evaluation requires --live");
    }
  }

  return { isLive, selectedMoments };
}
