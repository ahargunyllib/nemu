import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Button } from "@nemu/ui/components/button";
import { Spinner } from "@nemu/ui/components/spinner";
import { createFileRoute } from "@tanstack/react-router";

import { useDemoPageAction } from "@/features/demo/hooks/use-demo-page-action";
import BiayaSection from "@/features/perjalanan-dinas/components/biaya-section";
import DokumenSection from "@/features/perjalanan-dinas/components/dokumen-section";
import JadwalSection from "@/features/perjalanan-dinas/components/jadwal-section";
import JenisTujuanSection from "@/features/perjalanan-dinas/components/jenis-tujuan-section";
import { useAjukanPerdinForm } from "@/features/perjalanan-dinas/hooks/use-ajukan-perdin-form";
import { useIsiFormulirDemo } from "@/features/perjalanan-dinas/hooks/use-isi-formulir-demo";

export const Route = createFileRoute("/_auth/perdin/baru")({
  component: RouteComponent,
});

function RouteComponent() {
  const form = useAjukanPerdinForm();
  useDemoPageAction({
    label: "Isi formulir demo",
    nemuId: NEMU_IDS.demoPanel.fillForm,
    run: useIsiFormulirDemo(form),
  });

  return (
    <>
      <h1 className="text-lg font-semibold">Ajukan Perjalanan Dinas</h1>
      <form
        noValidate
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <JenisTujuanSection form={form} />
        <JadwalSection form={form} />
        <BiayaSection form={form} />
        <DokumenSection form={form} />
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <div className="flex justify-end">
              <Button
                type="submit"
                data-nemu-id={NEMU_IDS.perdinForm.kirim}
                disabled={isSubmitting}
              >
                {isSubmitting && <Spinner />}
                Kirim
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </>
  );
}
