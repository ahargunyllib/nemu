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

import { useDemoPageAction } from "@/features/demo/hooks/use-demo-page-action";
import PerdinFormTabs from "@/features/perjalanan-dinas/components/perdin-form-tabs";
import StartProcessButton from "@/features/perjalanan-dinas/components/start-process-button";
import { useAjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import { useIsiFormulirDemo } from "@/features/perjalanan-dinas/hooks/use-isi-formulir-demo";
import ProcessBadge from "@/features/processes/components/process-badge";
import { PERJALANAN_DINAS } from "@/features/processes/lib/processes";

export const Route = createFileRoute("/_auth/perdin/baru")({
  component: RouteComponent,
});

const FORM_ID = "perdin-form";

function RouteComponent() {
  const form = useAjukanPerdinForm();
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
            Start {PERJALANAN_DINAS.name}
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
            <PerdinFormTabs form={form} />
          </form>
        </CardContent>
      </Card>
    </>
  );
}
