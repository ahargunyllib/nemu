import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";

import type { NarrationSegment, RecordedEvent } from "@nemu/contracts/school";

import { instantiateProcedure } from "../procedures.js";
import { createFixtureSchoolAi } from "../runtime.js";
import { importBpmn } from "./graph.js";
import { procedureToBpmn } from "./procedure-bpmn.js";

/** F3-3 (#214): "Rekam cara" by Pak Rizal → steps with parameters → BPMN → 5 replays. */
const FIXTURES = join(import.meta.dirname, "../../../src/school/fixtures");

async function recording() {
  return JSON.parse(await readFile(join(FIXTURES, "F3-3_rekaman.json"), "utf8")) as {
    title: string;
    recordedBy: string;
    events: RecordedEvent[];
    narration: NarrationSegment[];
  };
}

async function compiled() {
  const { title, events, narration, recordedBy } = await recording();
  const procedure = await createFixtureSchoolAi().compileProcedure({ title, events, narration });
  return { ...procedure, recordedBy };
}

test("F3-3: the recording compiles to the expected 11 steps; Simpan ujian is the teacher's", async () => {
  const procedure = await compiled();
  const expected = JSON.parse(
    await readFile(join(FIXTURES, "F3-3_langkah-yang-diharapkan.json"), "utf8"),
  ) as Array<Record<string, unknown>>;
  assert.deepEqual(
    procedure.steps.map((step) => ({
      order: step.order,
      action: step.action,
      target: step.locator.label,
      valueTemplate: step.valueTemplate,
      requiresHumanAction: step.requiresHumanAction,
    })),
    expected,
  );
  assert.equal(procedure.steps.at(-1)?.instruction, "Silakan tekan Simpan ujian.");
  assert.deepEqual(
    procedure.parameters.map((parameter) => parameter.name),
    ["kelas", "murid", "jenis_ujian", "tanggal_ujian", "fashohah", "tartil", "tajwid", "adab"],
  );
});

test("F3-3: 5/5 replays from the CSV fill every value and stop at the teacher's Simpan", async () => {
  const procedure = await compiled();
  const [header, ...rows] = (await readFile(join(FIXTURES, "F3-3_putaran-ulang.csv"), "utf8"))
    .trim()
    .split("\n");
  const keys = header!.split(",");
  let passed = 0;
  for (const line of rows) {
    const values = Object.fromEntries(line.split(",").map((value, i) => [keys[i]!, value]));
    const run = instantiateProcedure(procedure, values);
    assert.equal(run.status, "ok");
    if (run.status !== "ok") continue;
    const filled = run.steps.filter((step) => step.value !== null);
    assert.deepEqual(
      filled.map((step) => step.value),
      procedure.parameters.map((parameter) => values[parameter.name]),
    );
    assert.equal(run.steps.at(-1)?.requiresHumanAction, true);
    passed += 1;
  }
  assert.equal(passed, 5);
});

test("F3-03: the export is BPMN 2.0 with a user task per step, form fields and a layout", async () => {
  const procedure = await compiled();
  const xml = await procedureToBpmn(procedure);
  const graph = await importBpmn(xml);
  assert.deepEqual(graph.warnings, []);
  assert.equal(graph.name, "Catat ujian tahfidz");
  const tasks = Object.values(graph.nodes).filter((node) => node.kind === "task");
  assert.equal(tasks.length, 11);
  assert.ok(tasks.every((node) => node.bpmnType === "bpmn:UserTask"));
  assert.equal(graph.nodes.Task_Langkah11?.name, "Guru menekan Simpan ujian");
  assert.deepEqual(
    tasks.flatMap((node) => node.formFields.map((field) => [field.id, field.label])),
    [
      ["kelas", "Kelas"],
      ["murid", "Murid"],
      ["jenis_ujian", "Jenis ujian"],
      ["tanggal_ujian", "Tanggal ujian"],
      ["fashohah", "Fashohah"],
      ["tartil", "Tartil"],
      ["tajwid", "Tajwid"],
      ["adab", "Adab"],
    ],
  );
  assert.equal(graph.nodes.Start_Rekaman?.name, "Rekaman Pak Rizal");
  // bpmn-auto-layout drew every element, so bpmn.io and Camunda Modeler can open it.
  const shapes = xml.match(/<bpmndi:BPMNShape /gu)?.length ?? 0;
  const edges = xml.match(/<bpmndi:BPMNEdge /gu)?.length ?? 0;
  assert.equal(shapes, 13);
  assert.equal(edges, 12);
  assert.match(xml, /xmlns:camunda="http:\/\/camunda.org\/schema\/1.0\/bpmn"/u);
});
