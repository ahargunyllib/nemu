import {
  momentThreeFollowUpRequest,
  momentThreeRequest,
  momentTwoRequest,
} from "@nemu/contracts/fixtures";
import type { AjukanPerjalananDinasInput } from "@nemu/contracts/process-instance";
import { describe, expect, it } from "vite-plus/test";

import type {
  NewProcessDocumentRecord,
  NewProcessInstanceRecord,
  ProcessDocumentRecord,
  ProcessInstanceRecord,
  ProcessInstanceRepository,
} from "./repository";
import {
  ajukanPerjalananDinas,
  getProcessInstance,
  kirimPertanggungjawaban,
  listMyProcessInstances,
  listMyTasks,
  loadProcessContext,
  majukanState,
  resetDemo,
  unggahDokumenPertanggungjawaban,
} from "./service";

function createFakes(existingIds: string[] = []) {
  let rows: ProcessInstanceRecord[] = [];
  let documents: ProcessDocumentRecord[] = [];
  let clock = Date.parse("2026-11-01T00:00:00Z");
  const tick = () => new Date((clock += 1000));

  const toRow = (record: NewProcessInstanceRecord): ProcessInstanceRecord => {
    const now = tick();
    return { createdAt: now, updatedAt: now, ...record };
  };
  const toDocument = (record: NewProcessDocumentRecord): ProcessDocumentRecord => ({
    uploadedAt: tick(),
    ...record,
  });

  const processInstances: ProcessInstanceRepository = {
    async insert(record) {
      const row = toRow(record);
      rows.push(row);
      return row;
    },
    async listByOwner(ownerId) {
      return rows
        .filter((row) => row.ownerId === ownerId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async findOwned(ownerId, id) {
      return rows.find((row) => row.id === id && row.ownerId === ownerId);
    },
    async updateState(id, state) {
      const index = rows.findIndex((row) => row.id === id);
      const row = { ...rows[index]!, state, updatedAt: tick() };
      rows[index] = row;
      return row;
    },
    async lastIdWithPrefix(prefix) {
      return [...existingIds, ...rows.map((row) => row.id)]
        .filter((id) => id.startsWith(prefix))
        .sort()
        .at(-1);
    },
    async listDocuments(instanceIds) {
      return documents.filter((document) => instanceIds.includes(document.instanceId));
    },
    async saveDocument(record) {
      const saved = toDocument(record);
      documents = [
        ...documents.filter(
          (document) =>
            document.instanceId !== record.instanceId || document.jenis !== record.jenis,
        ),
        saved,
      ];
      return saved;
    },
    async replaceOwned(ownerId, instances, newDocuments) {
      const dropped = new Set(rows.filter((row) => row.ownerId === ownerId).map((row) => row.id));
      rows = [...rows.filter((row) => !dropped.has(row.id)), ...instances.map(toRow)];
      documents = [
        ...documents.filter((document) => !dropped.has(document.instanceId)),
        ...newDocuments.map(toDocument),
      ];
    },
  };
  return { processInstances };
}

/** Fakes holding the seeded 3-Momen fixtures, as after the seed migration. */
async function createSeededFakes() {
  const deps = createFakes();
  await resetDemo(deps, "rina");
  return deps;
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

describe("listMyTasks", () => {
  it("lists the seeded Pertanggungjawaban task with its tanggal kembali and uploaded documents", async () => {
    const deps = await createSeededFakes();
    await ajukanPerjalananDinas(deps, "rina", { ...rinaToMakassar, kotaTujuan: "Denpasar" });

    const tasks = await listMyTasks(deps, "rina");

    expect(
      tasks.map(({ id, activeTask, tanggalKembali, dokumen }) => ({
        id,
        activeTask,
        tanggalKembali,
        dokumen: dokumen.map((document) => document.jenis),
      })),
    ).toEqual([
      {
        id: "PD-2026-0042",
        activeTask: {
          id: "PJ-PD-2026-0042",
          key: "pertanggungjawaban",
          label: "Pertanggungjawaban",
        },
        tanggalKembali: "2026-11-05",
        dokumen: ["surat_tugas", "boarding_pass_pergi"],
      },
    ]);
  });

  it("shows a Task once the demo panel moves an instance into a State that waits on the user", async () => {
    const deps = createFakes();
    const instance = await ajukanPerjalananDinas(deps, "rina", rinaToMakassar);
    for (const _ of ["Disetujui", "Berangkat", "Kembali"]) {
      await majukanState(deps, "rina", instance.id);
    }
    expect(await listMyTasks(deps, "rina")).toEqual([]);

    const advanced = await majukanState(deps, "rina", instance.id);

    expect(advanced).toMatchObject({ ok: true, value: { state: "Pertanggungjawaban" } });
    expect((await listMyTasks(deps, "rina")).map((task) => task.activeTask?.key)).toEqual([
      "pertanggungjawaban",
    ]);
  });
});

describe("getProcessInstance", () => {
  it("returns only the signed-in user's instance", async () => {
    const deps = await createSeededFakes();

    expect(await getProcessInstance(deps, "rina", "PD-2026-0042")).toMatchObject({
      state: "Pertanggungjawaban",
      activeTask: { key: "pertanggungjawaban" },
    });
    expect(await getProcessInstance(deps, "verifikator", "PD-2026-0042")).toBeNull();
  });
});

describe("majukanState", () => {
  it("refuses to move a Selesai instance or someone else's instance", async () => {
    const deps = await createSeededFakes();
    await majukanState(deps, "rina", "PD-2026-0042");
    await majukanState(deps, "rina", "PD-2026-0042");

    expect(await majukanState(deps, "rina", "PD-2026-0042")).toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
    expect(await majukanState(deps, "verifikator", "PD-2026-0042")).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});

describe("loadProcessContext", () => {
  it("gives the AI the seeded Pertanggungjawaban instance exactly as the Momen 3 fixture has it", async () => {
    const deps = await createSeededFakes();
    // Momen 1–2 create a newer request, but it waits on the atasan, not on Rina.
    await ajukanPerjalananDinas(deps, "rina", rinaToMakassar);

    expect(await loadProcessContext(deps, "rina")).toEqual(momentThreeRequest.process_context);
  });

  it("gives Momen 2 on Ajukan Perjalanan Dinas the trip as a plan in progress, not its Pertanggungjawaban", async () => {
    const deps = await createSeededFakes();

    const context = await loadProcessContext(deps, "rina", momentTwoRequest.url);

    expect(context).toEqual(momentTwoRequest.process_context);
    expect(context).not.toHaveProperty("return_date");
  });

  it("keeps the Pertanggungjawaban context for Momen 3 on Beranda and on the task page", async () => {
    const deps = await createSeededFakes();

    expect(await loadProcessContext(deps, "rina", momentThreeRequest.url)).toEqual(
      momentThreeRequest.process_context,
    );
    expect(await loadProcessContext(deps, "rina", momentThreeFollowUpRequest.url)).toEqual(
      momentThreeFollowUpRequest.process_context,
    );
  });

  it("falls back to the newest instance when none has a Task, and to nothing without instances", async () => {
    const deps = createFakes();
    expect(await loadProcessContext(deps, "rina")).toBeUndefined();

    await ajukanPerjalananDinas(deps, "rina", rinaToMakassar);

    expect(await loadProcessContext(deps, "rina")).toMatchObject({
      instance_id: "PD-2026-0001",
      status: "Diajukan",
      active_task: undefined,
      uploaded_documents: [],
    });
  });
});

describe("Pertanggungjawaban", () => {
  it("refuses Kirim while documents are missing, then moves to Verifikasi with the task ID", async () => {
    const deps = await createSeededFakes();

    expect(await kirimPertanggungjawaban(deps, "rina", "PD-2026-0042")).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Dokumen belum lengkap: boarding_pass_pulang, laporan_perjalanan",
    });

    for (const jenis of ["boarding_pass_pulang", "laporan_perjalanan"] as const) {
      const uploaded = await unggahDokumenPertanggungjawaban(deps, "rina", {
        instanceId: "PD-2026-0042",
        jenis,
        namaFile: `${jenis}.pdf`,
      });
      expect(uploaded.ok).toBe(true);
    }
    const sent = await kirimPertanggungjawaban(deps, "rina", "PD-2026-0042");

    expect(sent).toMatchObject({
      ok: true,
      value: { taskId: "PJ-PD-2026-0042", instance: { state: "Verifikasi" } },
    });
    expect(await listMyTasks(deps, "rina")).toEqual([]);
  });

  it("accepts uploads only while the instance is in Pertanggungjawaban", async () => {
    const deps = createFakes();
    const instance = await ajukanPerjalananDinas(deps, "rina", rinaToMakassar);

    const uploaded = await unggahDokumenPertanggungjawaban(deps, "rina", {
      instanceId: instance.id,
      jenis: "laporan_perjalanan",
      namaFile: "laporan.pdf",
    });

    expect(uploaded).toMatchObject({ ok: false, code: "CONFLICT" });
  });
});

describe("resetDemo", () => {
  it("puts back the seeded fixtures and drops the user's other instances", async () => {
    const deps = await createSeededFakes();
    await ajukanPerjalananDinas(deps, "rina", rinaToMakassar);
    await majukanState(deps, "rina", "PD-2026-0042");
    await ajukanPerjalananDinas(deps, "verifikator", rinaToMakassar);

    await resetDemo(deps, "rina");

    expect(
      (await listMyProcessInstances(deps, "rina")).map(({ id, state }) => ({ id, state })),
    ).toEqual([{ id: "PD-2026-0042", state: "Pertanggungjawaban" }]);
    expect(await listMyProcessInstances(deps, "verifikator")).toHaveLength(1);
    expect(await loadProcessContext(deps, "rina")).toEqual(momentThreeRequest.process_context);
  });
});
