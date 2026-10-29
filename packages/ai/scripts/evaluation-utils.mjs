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
