import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { importBpmn } from "./bpmn/graph.js";
import { stepDrafts, traceCause } from "./bpmn/trace.js";
import { BU_SITI } from "./fixtures/sdit-nusantara.js";
import {
  contactForLane,
  explainProcess,
  isParentSafe,
  screenSymptoms,
  suggestSymptoms,
  type GradeCheck,
  type ProcessIndex,
  type SymptomCandidate,
} from "./process-help.js";
import { createFixtureSchoolAi } from "./runtime.js";
import { fakeJsonCall } from "./test-helpers.js";

const FIXTURES = join(import.meta.dirname, "../../src/school/fixtures");

async function sppGraph() {
  return importBpmn(await readFile(join(FIXTURES, "F2-1_alur-spp.bpmn"), "utf8"));
}

/** A small CSV reader: quoted cells with doubled quotes inside them, one row per line. */
function parseCsv(text: string): Array<Record<string, string>> {
  const rows = text
    .trim()
    .split("\n")
    .map((line) => {
      const cells: string[] = [];
      let cell = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i]!;
        if (quoted && char === '"' && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) {
          cells.push(cell);
          cell = "";
        } else cell += char;
      }
      return [...cells, cell.replace(/\r$/u, "")];
    });
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header!.map((name, i) => [name, cells[i] ?? ""])));
}

/** `F2-1_pertanyaan-dan-kunci.csv`, the official F2-1 key: 3 questions with their BPMN sources. */
async function f21Questions() {
  const rows = parseCsv(await readFile(join(FIXTURES, "F2-1_pertanyaan-dan-kunci.csv"), "utf8"));
  return rows.map((row) => ({
    no: row.no!,
    question: row.pertanyaan_guru!,
    // "A > B (Yes) > C; pembanding: …" → the ids the answer's Sumber must point at.
    sources: [...row.elemen_bpmn_sumber!.matchAll(/\b[A-Z][A-Za-z]*_[A-Za-z]+\b/gu)].map(
      (match) => match[0],
    ),
  }));
}

function candidatesOf(index: ProcessIndex): SymptomCandidate[] {
  return Object.entries(index).flatMap(([elementId, entry]) =>
    entry.symptoms.map((symptom) => ({ documentId: "doc-spp", elementId, symptom })),
  );
}

/** What each F2-1 question must find, from the CSV's `lulus_jika` column. */
const EXPECTED: Record<string, { cause: string; mustCite: string[]; gradeCheck: GradeCheck }> = {
  "1": {
    cause: "Task_LockGrades",
    mustCite: ["Task_LockGrades", "Timer_DueDateReached"],
    gradeCheck: { status: "saved", student: "Aisyah Putri Wijaya" },
  },
  "2": {
    cause: "Task_UpdatePartiallyPaid",
    mustCite: ["Task_UpdatePartiallyPaid", "Gw_InvoiceType", "Flow_10", "Task_UnlockGrades"],
    gradeCheck: { status: "not_asked" },
  },
  "3": {
    cause: "Task_UnlockGrades",
    mustCite: ["Boundary_PaidInCash", "Gw_InvoiceType", "Flow_12", "Task_UnlockGrades"],
    gradeCheck: { status: "not_asked" },
  },
};

test("F3-10: the official SPP file reads with its boundary events, gateways and branches", async () => {
  const graph = await sppGraph();
  assert.equal(graph.id, "Process_SPP");
  assert.equal(graph.nodes.Boundary_PaidInCash?.bpmnType, "bpmn:BoundaryEvent");
  assert.equal(graph.nodes.Timer_DueDateReached?.bpmnType, "bpmn:BoundaryEvent");
  assert.equal(graph.flows.Flow_10?.name, "Regular, Overdue Left");
  assert.deepEqual(graph.lanes, ["Parent"]);
});

test("F3-12: the walks for the three F2-1 questions follow the file", async () => {
  const graph = await sppGraph();

  const locked = traceCause(graph, "Task_LockGrades", { wayBackId: "Task_UnlockGrades" })!;
  assert.deepEqual(
    locked.path.map((hop) => hop.node.id),
    ["Timer_DueDateReached", "Gw_IsRegularInvoice", "Task_LockGrades"],
  );
  assert.equal(locked.path[1]!.branch?.name, "Yes");
  assert.deepEqual(
    locked.after.map((node) => node.id),
    ["End_GradesLocked"],
  );
  assert.equal(locked.wayBack?.condition?.flow.name, "Regular, None Overdue");
  assert.deepEqual(
    stepDrafts(graph, locked).map((step) => step.elementIds),
    [
      ["Timer_DueDateReached"],
      ["Gw_IsRegularInvoice", "Flow_04"],
      ["Task_LockGrades", "End_GradesLocked"],
      ["Gw_InvoiceType", "Flow_12", "Task_UnlockGrades"],
    ],
  );

  // Payments by VA/QRIS and in cash meet at Check Invoices, so the walk back stops there.
  const partial = traceCause(graph, "Task_UpdatePartiallyPaid", {
    wayBackId: "Task_UnlockGrades",
  })!;
  assert.deepEqual(
    stepDrafts(graph, partial).map((step) => step.elementIds),
    [
      ["Task_CheckInvoices"],
      ["Gw_InvoiceType", "Flow_10"],
      ["Task_UpdatePartiallyPaid", "End_InvoicesPartiallyPaid"],
      ["Gw_InvoiceType", "Flow_12", "Task_UnlockGrades"],
    ],
  );

  // "Kalau bayar tunai": the walk starts at the event the teacher named.
  const cash = traceCause(graph, "Task_UnlockGrades", { via: "Boundary_PaidInCash" })!;
  assert.deepEqual(
    stepDrafts(graph, cash).map((step) => step.elementIds),
    [
      ["Boundary_PaidInCash"],
      ["Task_CheckInvoices"],
      ["Gw_InvoiceType", "Flow_12"],
      ["Task_UnlockGrades", "Task_UpdateFullyPaid", "End_InvoicePaid"],
    ],
  );
});

test("F3-11: the index keeps only element ids in the file and a usable role", async () => {
  const graph = await sppGraph();
  const llm = fakeJsonCall({
    process_symptoms: () => ({
      elements: [
        {
          element_id: "Task_LockGrades",
          symptoms: ["nilai tidak muncul di aplikasi orang tua.", "SPP Rp350.000 belum dibayar"],
          way_back: "Task_UnlockGrades",
          role: "Bagian keuangan.",
        },
        { element_id: "Task_UnlockGrades", symptoms: [], way_back: "Task_Nope", role: null },
        { element_id: "Gone", symptoms: ["x"], way_back: null, role: null },
      ],
    }),
  });
  const index = await suggestSymptoms({ llm }, { graph });
  assert.deepEqual(index.Task_LockGrades, {
    symptoms: ["nilai tidak muncul di aplikasi orang tua"],
    wayBack: "Task_UnlockGrades",
    role: "Bagian keuangan",
  });
  assert.equal(index.Task_UnlockGrades?.wayBack, null);
  assert.ok(index.Boundary_PaidInCash, "boundary events are indexed");
  assert.ok(!("Gone" in index));
  assert.ok(!("Gw_InvoiceType" in index), "gateways are not indexed");
});

test("F2-1: 3/3 official questions with the fixture responder, Bu Ratna and a safe reply", async () => {
  const ai = createFixtureSchoolAi();
  const graph = await sppGraph();
  const index = await ai.suggestSymptoms({ graph });
  const candidates = candidatesOf(index);
  const questions = await f21Questions();
  assert.equal(questions.length, 3);
  for (const row of questions) {
    const expected = EXPECTED[row.no]!;
    const found = await ai.matchSymptom({ question: row.question, candidates });
    assert.equal(found?.match.elementId, expected.cause, `Q${row.no}: symptom match`);
    const answer = await ai.explainProcess({
      question: row.question,
      process: { documentId: "doc-spp", title: "Alur SPP", version: "1", graph, index },
      match: found!.match,
      via: found!.via,
      gradeCheck: expected.gradeCheck,
      teacher: BU_SITI,
    });
    assert.equal(answer?.status, "process", `Q${row.no}`);
    if (answer?.status !== "process") continue;
    const cited = answer.steps.flatMap((step) => step.elementIds);
    for (const id of expected.mustCite) assert.ok(cited.includes(id), `Q${row.no} cites ${id}`);
    // Every id in Sumber is in the file, and most of the CSV's source path is cited.
    for (const id of cited) assert.ok(id in graph.nodes || id in graph.flows, id);
    const fromKey = row.sources.filter((id) => cited.includes(id));
    assert.ok(fromKey.length >= 3, `Q${row.no} cites ${fromKey.join(", ")}`);
    assert.ok(answer.steps.length >= 2 && answer.steps.length <= 4);
    assert.equal(answer.fixer?.name, "Bu Ratna");
    assert.match(answer.sentence, /Yang bisa membantu: Bu Ratna \(keuangan\)\.$/u);
    assert.ok(answer.parentReply && isParentSafe(answer.parentReply), answer.parentReply ?? "");
    assert.match(answer.parentReply, /Bu Ratna/u);
    if (expected.gradeCheck.status === "saved")
      assert.match(
        answer.sentence,
        /^Nilai Aisyah Putri Wijaya sudah tersimpan\. Bukan kesalahan Ibu\. Kemungkinan karena alur SPP sekolah: nilai murid dikunci otomatis kalau ada tagihan SPP bulanan/u,
      );
  }
});

test("F3-13: no AlurSekolah data for a named student means 'kemungkinan'", async () => {
  const ai = createFixtureSchoolAi();
  const graph = await sppGraph();
  const index = await ai.suggestSymptoms({ graph });
  const answer = await ai.explainProcess({
    question: "Nilai UTS Aisyah kok tidak muncul di aplikasi orang tua?",
    process: { documentId: "doc-spp", title: "Alur SPP", version: "1", graph, index },
    match: {
      documentId: "doc-spp",
      elementId: "Task_LockGrades",
      symptom: "nilai tidak muncul di aplikasi orang tua",
    },
    gradeCheck: { status: "unknown" },
    teacher: BU_SITI,
  });
  assert.equal(answer?.status, "process");
  if (answer?.status !== "process") return;
  assert.match(answer.sentence, /^Kemungkinan karena alur SPP sekolah: /u);
});

test("F3-13: grades AlurSekolah doesn't have mean the process isn't the cause", async () => {
  const ai = createFixtureSchoolAi();
  const graph = await sppGraph();
  const answer = await ai.explainProcess({
    question: "Kenapa nilai Kevin tidak muncul di aplikasi orang tua?",
    process: { documentId: "doc-spp", title: "SPP", version: "1", graph, index: {} },
    match: {
      documentId: "doc-spp",
      elementId: "Task_LockGrades",
      symptom: "nilai tidak muncul di aplikasi orang tua",
    },
    gradeCheck: { status: "not_saved", student: "Kevin Ardiansyah" },
    teacher: BU_SITI,
  });
  assert.deepEqual(answer, {
    status: "grades_not_saved",
    student: "Kevin Ardiansyah",
    sentence:
      "Nilai Kevin Ardiansyah belum tersimpan di AlurSekolah, jadi belum bisa tampil. Simpan dulu nilainya, Ibu.",
  });
});

test("F3-14: a question no symptom describes matches nothing", async () => {
  const ai = createFixtureSchoolAi();
  const candidates = candidatesOf(await ai.suggestSymptoms({ graph: await sppGraph() }));
  for (const question of [
    "Nemu, ini kenapa?",
    "Kenapa absen murid tidak bisa disimpan?",
    "Kenapa jadwal pelajaran besok berubah?",
  ]) {
    assert.equal(await ai.matchSymptom({ question, candidates }), null, question);
  }
});

test("the fixer comes from a lane first, then from the role in the index", () => {
  const contacts = BU_SITI.contacts;
  assert.equal(contactForLane("Bagian Keuangan", contacts)?.name, "Bu Ratna");
  assert.equal(contactForLane("Parent", contacts), null);
  assert.equal(contactForLane("bendahara atau operator sekolah", contacts)?.name, "Bu Ratna");
  assert.equal(contactForLane("operator sekolah, bukan bendahara", contacts)?.name, "Pak Rizal");
});

test("a model reply with an amount, 'tunggakan' or no helper is replaced by the safe draft", async () => {
  const graph = await sppGraph();
  const index = await createFixtureSchoolAi().suggestSymptoms({ graph });
  for (const bad of [
    "Mohon maaf, ada tunggakan SPP. Silakan hubungi Bu Ratna.",
    "Nilai belum tampil karena SPP Rp350.000 belum dibayar. Hubungi Bu Ratna.",
    "Nilai belum tampil karena ada tagihan 350 ribu. Hubungi Bu Ratna.",
    "Nilai belum tampil, silakan hubungi sekolah.",
  ]) {
    const llm = fakeJsonCall({
      process_help: (request) => {
        const data = JSON.parse((request.content[0] as { text: string }).text);
        return {
          answer: "Menurut alur sekolah, nilai dikunci kalau tagihan reguler lewat jatuh tempo.",
          why: "Tagihan reguler lewat jatuh tempo, jadi nilai dikunci.",
          steps: data.draf_langkah,
          parent_reply: bad,
        };
      },
    });
    const answer = await explainProcess(
      { llm },
      {
        question: "Nilai UTS Aisyah kok tidak muncul di aplikasi orang tua?",
        process: { documentId: "d", title: "Alur SPP", version: "1", graph, index },
        match: { documentId: "d", elementId: "Task_LockGrades", symptom: "nilai tidak muncul" },
        gradeCheck: { status: "saved", student: "Aisyah Putri Wijaya" },
        teacher: BU_SITI,
      },
    );
    assert.equal(answer?.status, "process");
    if (answer?.status !== "process") continue;
    assert.ok(answer.parentReply && isParentSafe(answer.parentReply));
    assert.ok(answer.parentReply.startsWith("Assalamu'alaikum, Bapak/Ibu."));
    assert.match(answer.parentReply, /Bu Ratna/u);
    assert.equal(
      answer.sentence,
      "Nilai Aisyah Putri Wijaya sudah tersimpan. Bukan kesalahan Ibu. Kemungkinan karena alur SPP sekolah: nilai dikunci kalau tagihan reguler lewat jatuh tempo. Yang bisa membantu: Bu Ratna (keuangan).",
    );
  }
  assert.equal(isParentSafe("Mohon dilunasi 350 ribu"), false);
  assert.equal(isParentSafe("Ada yang menunggak"), false);
  assert.equal(isParentSafe("Bu Ratna di bagian keuangan bisa membantu."), true);
});

test("a step naming an element id the file doesn't have keeps the code's draft", async () => {
  const graph = await sppGraph();
  const index = await createFixtureSchoolAi().suggestSymptoms({ graph });
  const llm = fakeJsonCall({
    process_help: (request) => {
      const data = JSON.parse((request.content[0] as { text: string }).text);
      return {
        answer: "Kemungkinan nilai dikunci.",
        why: "Karena tagihan lewat jatuh tempo.",
        steps: data.draf_langkah.map((step: { index: number }) => ({
          index: step.index,
          text: step.index === 0 ? "Lihat Task_Invented." : "Langkah biasa.",
        })),
        parent_reply: "Silakan hubungi Bu Ratna di bagian keuangan.",
      };
    },
  });
  const answer = await explainProcess(
    { llm },
    {
      question: "Nilai Aisyah kok tidak muncul?",
      process: { documentId: "d", title: "Alur SPP", version: "1", graph, index },
      match: { documentId: "d", elementId: "Task_LockGrades", symptom: "nilai tidak muncul" },
      gradeCheck: { status: "unknown" },
      teacher: BU_SITI,
    },
  );
  assert.equal(answer?.status, "process");
  if (answer?.status !== "process") return;
  assert.equal(answer.steps[0]!.text, "Due Date Reached.");
  assert.equal(answer.steps[1]!.text, "Langkah biasa.");
});

test("F2-08: one pupil's case is never a sure cause, since the bill can't be checked (P0-1)", async () => {
  const graph = await sppGraph();
  const index = await createFixtureSchoolAi().suggestSymptoms({ graph });
  const explain = async (answer: string, title: string, gradeCheck: GradeCheck) => {
    const llm = fakeJsonCall({
      process_help: (request) => {
        const data = JSON.parse((request.content[0] as { text: string }).text);
        return { answer, why: "", steps: data.draf_langkah, parent_reply: "" };
      },
    });
    const result = await explainProcess(
      { llm },
      {
        question: "Nilai UTS Aisyah kok tidak muncul di aplikasi orang tua?",
        process: { documentId: "d", title, version: "1", graph, index },
        match: { documentId: "d", elementId: "Task_LockGrades", symptom: "nilai tidak muncul" },
        gradeCheck,
        teacher: BU_SITI,
      },
    );
    assert.equal(result?.status, "process");
    return result?.status === "process" ? result : null;
  };
  const ask = async (answer: string, title: string, gradeCheck: GradeCheck) =>
    (await explain(answer, title, gradeCheck))?.sentence ?? "";
  const saved: GradeCheck = { status: "saved", student: "Aisyah Putri Wijaya" };

  assert.match(
    await ask("Nilai belum tampil di aplikasi orang tua.", "Alur SPP", saved),
    /Bukan kesalahan Ibu\. Kemungkinan karena alur SPP sekolah: nilai belum tampil di aplikasi orang tua\./u,
  );
  // Sumber says why it's only "kemungkinan": Nemu can't see the bill (F2 · 06).
  for (const gradeCheck of [saved, { status: "unknown" } as const]) {
    const result = await explain("Nilai dikunci.", "Alur SPP", gradeCheck);
    assert.equal(result?.sourceTitle, "Kenapa nilai bisa belum tampil?");
    assert.equal(
      result?.sourceNote,
      "Nemu tidak bisa melihat status tagihan. Pastikan ke bagian keuangan.",
    );
  }
  assert.match(
    await ask("Kemungkinan nilai dikunci.", "Alur SPP", { status: "unknown" }),
    /^Kemungkinan karena alur SPP sekolah: nilai dikunci\./u,
  );
  // A title without "Alur", or one already naming the school, reads as a process of the school.
  assert.match(
    await ask("Nilai dikunci.", "Pembayaran SPP", saved),
    /Kemungkinan karena alur Pembayaran SPP sekolah: nilai dikunci\./u,
  );
  assert.match(
    await ask("Nilai dikunci.", "Alur SPP Sekolah", saved),
    /Kemungkinan karena alur SPP Sekolah: nilai dikunci\./u,
  );
  // The opening said twice is said once.
  assert.match(
    await ask(
      "Kemungkinan karena alur SPP sekolah: menurut alur, nilai dikunci.",
      "Alur SPP",
      saved,
    ),
    /Kemungkinan karena alur SPP sekolah: nilai dikunci\./u,
  );
  // A cause the model gives after "kemungkinan karena" stays.
  assert.match(
    await ask("Kemungkinan karena tagihan lewat jatuh tempo, nilai dikunci.", "Alur SPP", saved),
    /Kemungkinan karena alur SPP sekolah: karena tagihan lewat jatuh tempo, nilai dikunci\./u,
  );
  // A question about the rule names no pupil: the rule is said as the rule.
  assert.match(
    await ask("Menurut alur sekolah, nilai dikunci kalau lewat jatuh tempo.", "Alur SPP", {
      status: "not_asked",
    }),
    /^Menurut alur sekolah, nilai dikunci/u,
  );
  const rule = await explain("Menurut alur sekolah, nilai dikunci.", "Alur SPP", {
    status: "not_asked",
  });
  assert.equal(rule?.sourceTitle, undefined);
  assert.equal(rule?.sourceNote, undefined);
});

test("F3-12: the walk holds up when the live index or match varies", async () => {
  const graph = await sppGraph();
  const index: ProcessIndex = {
    Task_LockGrades: {
      symptoms: ["nilai tidak muncul"],
      wayBack: "Task_UnlockGrades",
      role: "bagian keuangan",
    },
    // No way back of its own, and "bayar tunai" also on the general payment task.
    Task_UpdatePartiallyPaid: { symptoms: ["dibayar sebagian"], wayBack: null, role: null },
    Task_PayInvoice: { symptoms: ["orang tua membayar tunai"], wayBack: null, role: null },
    Boundary_PaidInCash: { symptoms: ["orang tua membayar tunai"], wayBack: null, role: null },
  };
  const llm = fakeJsonCall({
    process_help: () => ({ answer: "", why: "", steps: [], parent_reply: "" }),
  });
  const walk = async (elementId: string, via: SymptomCandidate | null) => {
    const answer = await explainProcess(
      { llm },
      {
        question: "?",
        process: { documentId: "d", title: "Alur SPP", version: "1", graph, index },
        match: { documentId: "d", elementId, symptom: "?" },
        via,
        gradeCheck: { status: "not_asked" },
        teacher: BU_SITI,
      },
    );
    return answer?.status === "process" ? answer.steps.flatMap((step) => step.elementIds) : [];
  };

  // "Sudah bayar sebagian, kok masih terkunci?" matched to the lock, with partial payment named:
  // no path from it to the lock, so she is at partial payment, and the lock's way back stays.
  const partial = await walk("Task_LockGrades", {
    documentId: "d",
    elementId: "Task_UpdatePartiallyPaid",
    symptom: "dibayar sebagian",
  });
  assert.ok(partial.includes("Flow_10") && partial.includes("Task_UnlockGrades"), `${partial}`);
  assert.ok(!partial.includes("Gw_IsRegularInvoice"));

  // Partial payment matched alone: its gateway's other branch to a known way back is the comparison.
  const alone = await walk("Task_UpdatePartiallyPaid", null);
  assert.ok(alone.includes("Flow_12") && alone.includes("Task_UnlockGrades"), `${alone}`);

  // "Bayar tunai" is indexed on two elements: the walk starts at the one nearest the cause, and an
  // opening step has nothing to be compared with.
  const cash = await walk("Task_UnlockGrades", {
    documentId: "d",
    elementId: "Task_PayInvoice",
    symptom: "orang tua membayar tunai",
  });
  assert.equal(cash[0], "Boundary_PaidInCash");
  assert.ok(!cash.includes("Flow_15"), `${cash}`);
});

test("a phrasing call that fails still answers with the code's drafts", async () => {
  const graph = await sppGraph();
  const index = await createFixtureSchoolAi().suggestSymptoms({ graph });
  const answer = await explainProcess(
    {
      llm: async () => {
        throw new Error("OpenRouter Responses API did not contain output text");
      },
    },
    {
      question: "Nilai UTS Aisyah kok tidak muncul?",
      process: { documentId: "d", title: "Alur SPP", version: "1", graph, index },
      match: { documentId: "d", elementId: "Task_LockGrades", symptom: "nilai tidak muncul" },
      gradeCheck: { status: "saved", student: "Aisyah Putri Wijaya" },
      teacher: BU_SITI,
    },
  );
  assert.equal(answer?.status, "process");
  if (answer?.status !== "process") return;
  assert.equal(answer.fixer?.name, "Bu Ratna");
  assert.ok(answer.parentReply && isParentSafe(answer.parentReply));
});

test("routing screens questions in code: clear symptoms and unrelated questions need no model", async () => {
  const ai = createFixtureSchoolAi();
  const candidates = candidatesOf(await ai.suggestSymptoms({ graph: await sppGraph() }));
  assert.equal(screenSymptoms("Kalau bayar tunai, kapan nilainya terbuka?", candidates), "match");
  assert.equal(screenSymptoms("Berapa KKM untuk kelas 4?", candidates), "none");
  assert.equal(screenSymptoms("Nilai remedial paling tinggi berapa?", candidates), "none");
  assert.equal(screenSymptoms("Kalau sudah bayar sebagian kapan terbuka?", candidates), "near");
});
