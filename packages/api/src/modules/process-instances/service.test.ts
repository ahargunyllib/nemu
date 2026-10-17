import type { AjukanPerjalananDinasInput } from "@nemu/contracts/process-instance";
import { describe, expect, it } from "vite-plus/test";

import type { ProcessInstanceRecord, ProcessInstanceRepository } from "./repository";
import { ajukanPerjalananDinas, listMyProcessInstances } from "./service";

function createFakes(existingIds: string[] = []) {
  const rows: ProcessInstanceRecord[] = [];
  const processInstances: ProcessInstanceRepository = {
    async insert(record) {
      const now = new Date(Date.now() + rows.length);
      const row: ProcessInstanceRecord = { createdAt: now, updatedAt: now, ...record };
      rows.push(row);
      return row;
    },
    async listByOwner(ownerId) {
      return rows
        .filter((row) => row.ownerId === ownerId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async lastIdWithPrefix(prefix) {
      return [...existingIds, ...rows.map((row) => row.id)]
        .filter((id) => id.startsWith(prefix))
        .sort()
        .at(-1);
    },
  };
  return { processInstances };
}

const rinaToMakassar: AjukanPerjalananDinasInput = {
  jenisPerjalanan: "Perjalanan dinas luar kota",
  nomorSuratTugas: "ST-123/BLD/2026",
  kotaTujuan: "Makassar",
  maksud: "Rapat koordinasi layanan digital",
  tanggalBerangkat: "2026-11-03",
  tanggalKembali: "2026-11-05",
  modaTransport: "Pesawat",
  biayaTransport: 3_500_000,
  penginapan: "tidak_hotel",
  nominalPenginapan: 447_000,
  uangHarian: 1_290_000,
  dokumenUndangan: "undangan-rapat.pdf",
};

describe("ajukanPerjalananDinas", () => {
  it("creates the user's Process Instance in State Diajukan with the destination's province", async () => {
    const deps = createFakes();

    const instance = await ajukanPerjalananDinas(deps, "rina", rinaToMakassar);

    expect(instance).toMatchObject({
      ...rinaToMakassar,
      id: "PD-2026-0001",
      ownerId: "rina",
      state: "Diajukan",
      provinsi: "Sulawesi Selatan",
    });
  });

  it("numbers each request after the highest nomor pengajuan of its departure year", async () => {
    const deps = createFakes(["PD-2026-0042", "PD-2027-0100"]);

    const first = await ajukanPerjalananDinas(deps, "rina", rinaToMakassar);
    const second = await ajukanPerjalananDinas(deps, "verifikator", rinaToMakassar);

    expect([first.id, second.id]).toEqual(["PD-2026-0043", "PD-2026-0044"]);
  });
});

describe("listMyProcessInstances", () => {
  it("lists only the signed-in user's Process Instances, newest first, with their State", async () => {
    const deps = createFakes();
    const older = await ajukanPerjalananDinas(deps, "rina", rinaToMakassar);
    await ajukanPerjalananDinas(deps, "verifikator", rinaToMakassar);
    const newer = await ajukanPerjalananDinas(deps, "rina", {
      ...rinaToMakassar,
      kotaTujuan: "Denpasar",
    });

    const mine = await listMyProcessInstances(deps, "rina");

    expect(mine.map(({ id, state, provinsi }) => ({ id, state, provinsi }))).toEqual([
      { id: newer.id, state: "Diajukan", provinsi: "Bali" },
      { id: older.id, state: "Diajukan", provinsi: "Sulawesi Selatan" },
    ]);
  });
});
