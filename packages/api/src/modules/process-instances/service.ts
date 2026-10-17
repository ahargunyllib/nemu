import type { ProcessContext } from "@nemu/contracts";
import {
  type AjukanPerjalananDinasInput,
  DOKUMEN_PERTANGGUNGJAWABAN,
  KOTA_TUJUAN,
  type UnggahDokumenInput,
} from "@nemu/contracts/process-instance";
import type { Database } from "@nemu/db";

import { DEMO_SEED_DOCUMENTS, DEMO_SEED_INSTANCES } from "./demo-seed";
import { type ProcessTask, activeTaskOf, nextState, nightsBetween } from "./process-flow";
import {
  type ProcessDocumentRecord,
  type ProcessInstanceRecord,
  type ProcessInstanceRepository,
  createProcessInstanceRepository,
} from "./repository";

export type ProcessInstanceDeps = {
  processInstances: ProcessInstanceRepository;
};

export function createProcessInstanceDeps(db: Database): ProcessInstanceDeps {
  return { processInstances: createProcessInstanceRepository(db) };
}

/** A Process Instance with its active Task and the documents uploaded to it. */
export type ProcessInstanceView = ProcessInstanceRecord & {
  activeTask: ProcessTask | null;
  dokumen: Pick<ProcessDocumentRecord, "jenis" | "namaFile" | "uploadedAt">[];
};

export type ProcessResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "NOT_FOUND" | "CONFLICT"; message: string };

// Nomor pengajuan: PD-<year of departure>-<4-digit sequence within that year>.
async function nextNomorPengajuan(
  processInstances: ProcessInstanceRepository,
  tanggalBerangkat: string,
): Promise<string> {
  const prefix = `PD-${tanggalBerangkat.slice(0, 4)}-`;
  const last = await processInstances.lastIdWithPrefix(prefix);
  const sequence = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

/** Kirim on the Ajukan Perjalanan Dinas form: the new Process Instance starts in State Diajukan. */
export async function ajukanPerjalananDinas(
  { processInstances }: ProcessInstanceDeps,
  ownerId: string,
  input: AjukanPerjalananDinasInput,
): Promise<ProcessInstanceRecord> {
  return processInstances.insert({
    ...input,
    id: await nextNomorPengajuan(processInstances, input.tanggalBerangkat),
    ownerId,
    state: "Diajukan",
    provinsi: KOTA_TUJUAN[input.kotaTujuan],
  });
}

export function listMyProcessInstances({ processInstances }: ProcessInstanceDeps, ownerId: string) {
  return processInstances.listByOwner(ownerId);
}

async function toViews(
  processInstances: ProcessInstanceRepository,
  records: readonly ProcessInstanceRecord[],
): Promise<ProcessInstanceView[]> {
  const documents = await processInstances.listDocuments(records.map((record) => record.id));
  return records.map((record) => ({
    ...record,
    activeTask: activeTaskOf(record),
    dokumen: documents
      .filter((document) => document.instanceId === record.id)
      .map(({ jenis, namaFile, uploadedAt }) => ({ jenis, namaFile, uploadedAt })),
  }));
}

function notFound(instanceId: string): ProcessResult<never> {
  return { ok: false, code: "NOT_FOUND", message: `Pengajuan ${instanceId} tidak ditemukan` };
}

/** `get_process_instance`: one of the user's instances, or null when it isn't theirs. */
export async function getProcessInstance(
  { processInstances }: ProcessInstanceDeps,
  ownerId: string,
  instanceId: string,
): Promise<ProcessInstanceView | null> {
  const record = await processInstances.findOwned(ownerId, instanceId);
  if (!record) return null;
  const [view] = await toViews(processInstances, [record]);
  return view ?? null;
}

/** `list_my_tasks`: the user's instances that wait on them, most recently changed first. */
export async function listMyTasks(
  { processInstances }: ProcessInstanceDeps,
  ownerId: string,
): Promise<ProcessInstanceView[]> {
  const withTask = (await processInstances.listByOwner(ownerId))
    .filter((record) => activeTaskOf(record))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return toViews(processInstances, withTask);
}

const AJUKAN_PERJALANAN_DINAS_PATH = "/perdin/baru";

function isAjukanPerjalananDinas(pageUrl: string | undefined): boolean {
  if (!pageUrl) return false;
  return new URL(pageUrl).pathname.replace(/\/$/, "") === AJUKAN_PERJALANAN_DINAS_PATH;
}

/**
 * The Process Instance Nemu answers about: the most recently changed one that has
 * a Task for the user, else their most recently changed one.
 *
 * On Ajukan Perjalanan Dinas (Momen 2) Rina is still planning the trip, so the
 * same trip goes out as a plan in progress (`isi_rencana`), without its later
 * State, return date, or documents.
 */
export async function loadProcessContext(
  { processInstances }: ProcessInstanceDeps,
  ownerId: string,
  pageUrl?: string,
): Promise<ProcessContext | undefined> {
  const records = (await processInstances.listByOwner(ownerId)).sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
  const active = records.find((record) => activeTaskOf(record)) ?? records[0];
  if (!active) return undefined;
  const [view] = await toViews(processInstances, [active]);
  if (!view) return undefined;

  if (isAjukanPerjalananDinas(pageUrl)) {
    return {
      instance_id: view.id,
      active_task: "isi_rencana",
      destination_province: view.provinsi,
      nights: nightsBetween(view.tanggalBerangkat, view.tanggalKembali),
      uploaded_documents: [],
    };
  }

  return {
    instance_id: view.id,
    status: view.state,
    active_task: view.activeTask?.key,
    return_date: view.tanggalKembali,
    destination_province: view.provinsi,
    nights: nightsBetween(view.tanggalBerangkat, view.tanggalKembali),
    uploaded_documents: view.dokumen.map((document) => document.jenis),
  };
}

/** The demo panel: moves the instance to its next State without the atasan, PPK, or bendahara. */
export async function majukanState(
  { processInstances }: ProcessInstanceDeps,
  ownerId: string,
  instanceId: string,
): Promise<ProcessResult<ProcessInstanceRecord>> {
  const record = await processInstances.findOwned(ownerId, instanceId);
  if (!record) return notFound(instanceId);
  const next = nextState(record.state);
  if (!next) {
    return { ok: false, code: "CONFLICT", message: `${instanceId} sudah ${record.state}` };
  }
  return { ok: true, value: await processInstances.updateState(record.id, next) };
}

async function findInPertanggungjawaban(
  processInstances: ProcessInstanceRepository,
  ownerId: string,
  instanceId: string,
): Promise<ProcessResult<ProcessInstanceRecord>> {
  const record = await processInstances.findOwned(ownerId, instanceId);
  if (!record) return notFound(instanceId);
  if (record.state !== "Pertanggungjawaban") {
    return {
      ok: false,
      code: "CONFLICT",
      message: `${instanceId} tidak sedang di tahap Pertanggungjawaban (status ${record.state})`,
    };
  }
  return { ok: true, value: record };
}

export async function unggahDokumenPertanggungjawaban(
  { processInstances }: ProcessInstanceDeps,
  ownerId: string,
  { instanceId, jenis, namaFile }: UnggahDokumenInput,
): Promise<ProcessResult<ProcessDocumentRecord>> {
  const found = await findInPertanggungjawaban(processInstances, ownerId, instanceId);
  if (!found.ok) return found;
  return { ok: true, value: await processInstances.saveDocument({ instanceId, jenis, namaFile }) };
}

/** Kirim on the Pertanggungjawaban task: with every document uploaded, the State moves to Verifikasi. */
export async function kirimPertanggungjawaban(
  { processInstances }: ProcessInstanceDeps,
  ownerId: string,
  instanceId: string,
): Promise<ProcessResult<{ taskId: string; instance: ProcessInstanceRecord }>> {
  const found = await findInPertanggungjawaban(processInstances, ownerId, instanceId);
  if (!found.ok) return found;

  const uploaded = new Set(
    (await processInstances.listDocuments([instanceId])).map((document) => document.jenis),
  );
  const missing = DOKUMEN_PERTANGGUNGJAWABAN.filter((jenis) => !uploaded.has(jenis));
  if (missing.length) {
    return {
      ok: false,
      code: "CONFLICT",
      message: `Dokumen belum lengkap: ${missing.join(", ")}`,
    };
  }

  const task = activeTaskOf(found.value);
  const instance = await processInstances.updateState(instanceId, "Verifikasi");
  return { ok: true, value: { taskId: task?.id ?? instanceId, instance } };
}

/** The demo panel's reset: puts back the user's 3-Momen fixtures and drops everything else they made. */
export async function resetDemo({ processInstances }: ProcessInstanceDeps, ownerId: string) {
  const instances = DEMO_SEED_INSTANCES.filter((instance) => instance.ownerId === ownerId);
  const ids = new Set(instances.map((instance) => instance.id));
  const documents = DEMO_SEED_DOCUMENTS.filter((document) => ids.has(document.instanceId));
  await processInstances.replaceOwned(ownerId, instances, documents);
}
