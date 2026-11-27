import { Alert, AlertDescription, AlertTitle } from "@nemu/ui/components/alert";
import { Button } from "@nemu/ui/components/button";
import { Spinner } from "@nemu/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";

import { orpc } from "@/shared/api/orpc";

/** Reads `/akademik/guru/saya` and `/nilai` with the stored URL and key, so a typo shows at once. */
export default function AlurSekolahConnectionCheck({ ready }: { ready: boolean }) {
  const check = useMutation(orpc.checkAlurSekolahConnection.mutationOptions());
  const result = check.data;

  return (
    <div className="grid w-full gap-3">
      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={!ready || check.isPending}
          onClick={() => check.mutate(undefined)}
        >
          {check.isPending && <Spinner />}
          Cek koneksi
        </Button>
      </div>
      {result?.status === "ok" && (
        <Alert>
          <CircleCheckIcon />
          <AlertTitle>Terhubung sebagai {result.account}</AlertTitle>
          <AlertDescription>
            {result.email} ·{" "}
            {result.classes.length ? `kelas ${result.classes.join(", ")}` : "semua kelas"} ·{" "}
            {result.grades.toLocaleString("id-ID")} nilai terbaca
          </AlertDescription>
        </Alert>
      )}
      {result?.status === "failed" && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Belum terhubung</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}
      {check.error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Belum terhubung</AlertTitle>
          <AlertDescription>{check.error.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
