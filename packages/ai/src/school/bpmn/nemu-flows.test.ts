import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";

import { BpmnModdle, type ModdleElement } from "bpmn-moddle";
import camundaDescriptor from "camunda-bpmn-moddle/resources/camunda.json" with { type: "json" };

import { importBpmn } from "./graph.js";

/**
 * F3-09 (#215): Nemu's own F1 Input Nilai and F4 Pasang Kuis flows in `docs/bpmn/`. Each one
 * parses without warnings, has the two teacher tasks the submission asks for, and draws every
 * element and flow, so it opens in bpmn.io.
 */
const DOCS = join(import.meta.dirname, "../../../../../docs/bpmn");
const FILES = ["f1-input-nilai.bpmn", "f4-pasang-kuis.bpmn"];

type Element = ModdleElement & Record<string, unknown>;

function asArray(value: unknown): Element[] {
  return Array.isArray(value) ? (value as Element[]) : [];
}

for (const file of FILES) {
  test(`${file} parses, names the teacher tasks, and draws every element`, async () => {
    const xml = await readFile(join(DOCS, file), "utf8");
    const moddle = new BpmnModdle({ camunda: camundaDescriptor });
    const { rootElement, warnings } = await moddle.fromXML(xml);
    assert.deepEqual(
      warnings.map((warning) => warning.message),
      [],
    );

    const definitions = rootElement as Element;
    const process = asArray(definitions.rootElements).find(
      (element) => element.$type === "bpmn:Process",
    )!;
    const flowElements = asArray(process.flowElements);
    const userTasks = flowElements
      .filter((element) => element.$type === "bpmn:UserTask")
      .map((element) => element.name);
    assert.ok(userTasks.includes("Guru memeriksa"), `${file}: no "Guru memeriksa"`);
    assert.ok(userTasks.includes("Guru menekan Simpan"), `${file}: no "Guru menekan Simpan"`);

    const plane = asArray(definitions.diagrams)[0]?.plane as Element | undefined;
    assert.equal((plane?.bpmnElement as Element | undefined)?.id, process.id);
    const drawn = new Set(
      asArray(plane?.planeElement).map((shape) => (shape.bpmnElement as Element | undefined)?.id),
    );
    const undrawn = flowElements
      .map((element) => element.id as string)
      .filter((id) => !drawn.has(id));
    assert.deepEqual(undrawn, [], `${file}: elements without a shape or edge`);

    // Nemu's own reader (F2/F3) walks it too: one start, every flow connects known nodes.
    const graph = await importBpmn(xml);
    assert.deepEqual(graph.warnings, []);
    assert.equal(graph.startIds.length, 1);
    for (const flow of Object.values(graph.flows)) {
      assert.ok(graph.nodes[flow.source], `${file}: ${flow.id} has no source`);
      assert.ok(graph.nodes[flow.target], `${file}: ${flow.id} has no target`);
    }
    for (const node of Object.values(graph.nodes)) {
      if (node.kind !== "startEvent") assert.ok(node.incoming.length, `${node.id} is unreachable`);
      if (node.kind !== "endEvent") assert.ok(node.outgoing.length, `${node.id} is a dead end`);
    }
  });
}
