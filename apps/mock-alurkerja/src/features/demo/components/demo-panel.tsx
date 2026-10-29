import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import { Field, FieldLabel } from "@nemu/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nemu/ui/components/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@nemu/ui/components/sheet";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { Spinner } from "@nemu/ui/components/spinner";

import { useDemoPanel } from "@/features/demo/hooks/use-demo-panel";

/**
 * Plays the atasan, PPK, and bendahara for the demo: Panel demo → Majukan State moves the
 * picked Process Instance to its next State in two clicks.
 */
export default function DemoPanel({ workspaceId }: { workspaceId?: string | null }) {
  const { instances, selected, pick, majukan, isMajukanPending, reset, isResetPending } =
    useDemoPanel(workspaceId);

  return (
    <Sheet>
      <SheetTrigger
        data-nemu-id={NEMU_IDS.demoPanel.open}
        render={<Button variant="outline" size="sm" className="shadow-lg" />}
      >
        Panel demo
      </SheetTrigger>
      <SheetContent side="left" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Panel demo</SheetTitle>
          <SheetDescription>
            Majukan State pengajuan tanpa menunggu atasan, PPK, atau bendahara.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          {!instances ? (
            <Skeleton className="h-9 w-full" />
          ) : selected ? (
            <>
              <Field>
                <FieldLabel htmlFor="demo-process-instance">Pengajuan</FieldLabel>
                <Select
                  items={instances.map((instance) => ({ label: instance.id, value: instance.id }))}
                  value={selected.id}
                  onValueChange={(id) => pick(id)}
                >
                  <SelectTrigger
                    id="demo-process-instance"
                    data-nemu-id={NEMU_IDS.demoPanel.instance}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.id} · {instance.kotaTujuan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">State sekarang</span>
                <Badge variant="secondary">{selected.state}</Badge>
              </div>
              <Button
                className="w-full"
                data-nemu-id={NEMU_IDS.demoPanel.advance}
                disabled={isMajukanPending || selected.state === "Selesai"}
                onClick={majukan}
              >
                {isMajukanPending && <Spinner />}
                Majukan State
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">Belum ada pengajuan.</p>
          )}
        </div>
        <SheetFooter>
          <Button
            variant="destructive"
            data-nemu-id={NEMU_IDS.demoPanel.reset}
            disabled={isResetPending}
            onClick={reset}
          >
            {isResetPending && <Spinner />}
            Reset data demo
          </Button>
          <SheetClose data-nemu-id={NEMU_IDS.demoPanel.close} render={<Button variant="outline" />}>
            Tutup
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
