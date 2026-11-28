import { Button } from "@nemu/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@nemu/ui/components/dialog";
import { Kbd, KbdGroup } from "@nemu/ui/components/kbd";

/**
 * "Rekam cara" (F3-01): a recording starts in the Nemu Extension on the page being recorded, so
 * the Admin Workspace button says how, and the review comes back here as Periksa rekaman.
 */
export default function RecordProcedureDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <span aria-hidden className="size-2 rounded-full bg-destructive" />
        Rekam cara
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rekam cara</DialogTitle>
          <DialogDescription>
            Rekaman dimulai dari Nemu di halaman yang mau direkam, bukan dari sini.
          </DialogDescription>
        </DialogHeader>
        <ol className="grid list-decimal gap-3 pl-5">
          <li>Buka halaman AlurSekolah yang caranya mau direkam, di Chrome yang sudah ada Nemu.</li>
          <li>
            Tekan tombol Nemu, lalu pilih <strong>Rekam cara</strong>. Bisa juga dengan menahan{" "}
            <KbdGroup>
              <Kbd>Ctrl</Kbd>+<Kbd>Spasi</Kbd>
            </KbdGroup>{" "}
            dan bilang "Rekam cara input nilai".
          </li>
          <li>
            Kerjakan langkahnya seperti biasa. Klik dan isian ikut tercatat; tahan tombol bicara
            untuk menjelaskan langkah.
          </li>
          <li>
            Tekan <strong>Selesai</strong>, lalu <strong>Periksa rekaman</strong>. Halaman Periksa
            rekaman terbuka di Workspace: ganti nama isian bila perlu, lalu simpan.
          </li>
        </ol>
        <p className="text-muted-foreground">
          Sandi tidak pernah ikut terekam. Rekaman yang disimpan muncul di daftar sebagai Rekaman.
        </p>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Tutup</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
