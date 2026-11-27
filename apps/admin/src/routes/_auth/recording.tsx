import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import RecordingReview from "@/features/recording/components/recording-review";

/** "Periksa rekaman" from "Rekam cara" in the Nemu Extension (F3-01/02). */
const searchSchema = z.object({ recording: z.string().uuid() });

export const Route = createFileRoute("/_auth/recording")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { recording } = Route.useSearch();
  return (
    <>
      <PageHeading
        title="Periksa rekaman"
        description="Ganti nama isian, hapus langkah yang tidak perlu, lalu simpan supaya guru bisa memakainya."
      />
      <RecordingReview recordingId={recording} />
    </>
  );
}
