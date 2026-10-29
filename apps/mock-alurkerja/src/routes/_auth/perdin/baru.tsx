import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import { useDemoPageAction } from "@/features/demo/hooks/use-demo-page-action";
import PerdinFormTabs from "@/features/perjalanan-dinas/components/perdin-form-tabs";
import StartProcessButton from "@/features/perjalanan-dinas/components/start-process-button";
import { useAjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import { useIsiFormulirDemo } from "@/features/perjalanan-dinas/hooks/use-isi-formulir-demo";
import { PERDIN_TABS, type PerdinTab } from "@/features/perjalanan-dinas/lib/perdin-form";
import ProcessBadge from "@/features/processes/components/process-badge";
import { PERJALANAN_DINAS } from "@/features/processes/lib/processes";

// The open tab is in the URL, so moving to another tab is a page change Nemu's guide follows.
const searchSchema = z.object({
  tab: z
    .enum(PERDIN_TABS.map(({ value }) => value) as [PerdinTab, ...PerdinTab[]])
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/_auth/perdin/baru")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

const FORM_ID = "perdin-form";

function RouteComponent() {
  const form = useAjukanPerdinForm();
  const { tab = PERDIN_TABS[0].value } = Route.useSearch();
  const navigate = Route.useNavigate();
  useDemoPageAction({
    label: "Isi formulir demo",
    nemuId: NEMU_IDS.demoPanel.fillForm,
    run: useIsiFormulirDemo(form),
  });

  return (
    <>
      <PageHeading
        title={
          <span className="flex items-center gap-3">
            <ProcessBadge
              code={PERJALANAN_DINAS.code}
              tone={PERJALANAN_DINAS.tone}
              className="size-7 rounded-lg text-xs"
            />
            Mulai {PERJALANAN_DINAS.name}
          </span>
        }
        actions={<StartProcessButton form={form} formId={FORM_ID} />}
      />
      <Card className="gap-3 py-5 shadow-sm [--card-spacing:--spacing(7.5)]">
        <CardHeader className="gap-3">
          <CardTitle>Formulir Perjalanan Dinas</CardTitle>
          <CardDescription>Isi sesuai surat tugas. Ikuti SOP-PD-01.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id={FORM_ID}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
          >
            <PerdinFormTabs
              form={form}
              tab={tab}
              onTabChange={(next) => navigate({ search: { tab: next }, replace: true })}
            />
          </form>
        </CardContent>
      </Card>
    </>
  );
}
