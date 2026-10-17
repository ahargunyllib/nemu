// @vitest-environment happy-dom
import type { DokumenPertanggungjawaban } from "@nemu/contracts/process-instance";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";
import { orpc } from "@/shared/api/orpc";

import PertanggungjawabanTask from "./pertanggungjawaban-task";

// A fake Nemu Service behind the real oRPC query utils. `refetchGate` lets a test hold the
// Process Instance refetch open, as a slow network would.
const server = vi.hoisted(() => ({
  dokumen: [] as { jenis: DokumenPertanggungjawaban; namaFile: string; uploadedAt: Date }[],
  refetchGate: Promise.resolve(),
  kirim: vi.fn(),
}));

vi.mock("@/shared/api/orpc", async () => {
  const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
  return {
    orpc: createTanstackQueryUtils({
      async getProcessInstance(): Promise<ProcessInstanceView> {
        const dokumen = [...server.dokumen];
        await server.refetchGate;
        return instanceWith(dokumen);
      },
      async unggahDokumenPertanggungjawaban({
        jenis,
        namaFile,
      }: {
        jenis: DokumenPertanggungjawaban;
        namaFile: string;
      }) {
        const dokumen = { instanceId: "PD-2026-0042", jenis, namaFile, uploadedAt: new Date() };
        server.dokumen.push(dokumen);
        return dokumen;
      },
      async kirimPertanggungjawaban() {
        server.kirim();
        const instance = { ...instanceWith(server.dokumen), state: "Verifikasi" as const };
        return { taskId: "PJ-PD-2026-0042", instance };
      },
    }),
  };
});

function instanceWith(dokumen: ProcessInstanceView["dokumen"]): ProcessInstanceView {
  return {
    id: "PD-2026-0042",
    ownerId: "rina",
    state: "Pertanggungjawaban",
    jenisPerjalanan: "Perjalanan dinas luar kota",
    nomorSuratTugas: "ST-123/BLD/2026",
    kotaTujuan: "Makassar",
    provinsi: "Sulawesi Selatan",
    maksud: "Rapat koordinasi layanan digital",
    tanggalBerangkat: "2026-11-03",
    tanggalKembali: "2026-11-05",
    modaTransport: "Pesawat",
    biayaTransport: 3_893_000,
    penginapan: "tidak_hotel",
    nominalPenginapan: 447_000,
    uangHarian: 1_290_000,
    dokumenUndangan: "undangan-rapat-koordinasi.pdf",
    createdAt: new Date("2026-10-27"),
    updatedAt: new Date("2026-11-06"),
    activeTask: {
      id: "PJ-PD-2026-0042",
      key: "pertanggungjawaban",
      label: "Pertanggungjawaban",
    },
    dokumen,
  };
}

function TaskPage() {
  const { data } = useQuery(
    orpc.getProcessInstance.queryOptions({ input: { instanceId: "PD-2026-0042" } }),
  );
  return data ? <PertanggungjawabanTask instance={data} /> : null;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PertanggungjawabanTask", () => {
  test("Kirim waits for the refetch after the last upload instead of refusing it", async () => {
    const uploadedAt = new Date("2026-11-06");
    server.dokumen = [
      { jenis: "surat_tugas", namaFile: "surat-tugas.pdf", uploadedAt },
      { jenis: "boarding_pass_pergi", namaFile: "boarding-pass-pergi-yia-upg.pdf", uploadedAt },
      { jenis: "laporan_perjalanan", namaFile: "laporan-perjalanan-makassar.pdf", uploadedAt },
    ];
    const toastSuccess = vi.spyOn(toast, "success");
    const toastError = vi.spyOn(toast, "error");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TaskPage />
      </QueryClientProvider>,
    );
    const kirim = await screen.findByRole("button", { name: "Kirim" });

    let releaseRefetch = () => {};
    server.refetchGate = new Promise((resolve) => {
      releaseRefetch = resolve;
    });
    fireEvent.change(screen.getByLabelText("Unggah boarding pass pulang"), {
      target: { files: [new File(["pdf"], "boarding-pass-pulang-upg-yia.pdf")] },
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("boarding-pass-pulang-upg-yia.pdf terunggah"),
    );

    // The upload succeeded but the page still shows the old instance.
    fireEvent.click(kirim);
    expect(toastError).not.toHaveBeenCalled();
    expect(server.kirim).not.toHaveBeenCalled();

    releaseRefetch();
    await screen.findByText("boarding-pass-pulang-upg-yia.pdf");
    await waitFor(() => expect(kirim).toHaveProperty("disabled", false));
    fireEvent.click(kirim);

    await waitFor(() => expect(server.kirim).toHaveBeenCalledOnce());
    expect(toastError).not.toHaveBeenCalled();
  });
});
