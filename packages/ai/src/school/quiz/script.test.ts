import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { inflateSync } from "node:zlib";

import { quizScriptResultSchema, type QuizScriptInput } from "@nemu/contracts/quiz";

import { F4_2_READING } from "../fixtures/f4-2-script.js";
import { base64ToBytes, bytesToBase64 } from "../llm.js";
import { createFixtureSchoolAi } from "../runtime.js";
import { fakeJsonCall } from "../test-helpers.js";
import { applyQuizAnswers, moodleXml, SKIP_QUESTION } from "./moodle-xml.js";
import { extractPdfImages } from "./pdf-images.js";
import { assembleQuizScript, type ModelQuizScript, readQuizScript } from "./script.js";

// Richard's F4-2 pack: the script, the Moodle XML it should become, and the key.
const PACK = join(import.meta.dirname, "../../../../../infra/setup/f4-2");
const SECTIONS = ["Umum", "IPAS", "Bahasa Inggris"];
const UTTERANCE =
  "Nemu, masukkan kuis dari naskah ini ke Moodle. Buka Senin 30 November, tutup Kamis 3 Desember.";

async function scriptInput(utterance = UTTERANCE): Promise<QuizScriptInput> {
  const pdf = await readFile(join(PACK, "F4-2_naskah-ipas-10-soal.pdf"));
  return {
    file: {
      name: "F4-2_naskah-ipas-10-soal.pdf",
      mimeType: "application/pdf",
      dataUrl: `data:application/pdf;base64,${bytesToBase64(pdf)}`,
    },
    utterance,
    today: "2026-11-27",
    course: "4A-UJI · Kelas 4A (uji)",
    sections: SECTIONS,
  };
}

/** A PNG's pixels as RGB rows, filters undone, to compare pictures whatever their encoder. */
function pngPixels(bytes: Uint8Array): { width: number; height: number; rgb: Buffer } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let type = 0;
  const idat: Uint8Array[] = [];
  for (let at = 8; at < bytes.length;) {
    const length = view.getUint32(at);
    const name = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (name === "IHDR") {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      type = data[9]!;
    }
    if (name === "IDAT") idat.push(data);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 1;
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x]!;
      const a = x >= bpp ? out[y * stride + x - bpp]! : 0;
      const b = y > 0 ? out[(y - 1) * stride + x]! : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp]! : 0;
      const p = a + b - c;
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c;
      const predicted = [0, a, b, (a + b) >> 1, paeth][filter]!;
      out[y * stride + x] = (value + predicted) & 0xff;
    }
  }
  if (bpp !== 4) return { width, height, rgb: out };
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i += 1) out.copy(rgb, i * 3, i * 4, i * 4 + 3);
  return { width, height, rgb };
}

type ParsedQuestion = {
  name: string;
  text: string;
  answers: { fraction: number; text: string; pixels: string | null }[];
};

/** Each multichoice question of a Moodle XML file, words without markup or punctuation. */
function parseQuestions(xml: string): ParsedQuestion[] {
  const words = (html: string) =>
    html
      .replace(/<[^>]+>/gu, " ")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  return [...xml.matchAll(/<question type="multichoice">([\s\S]*?)<\/question>/gu)].map(
    ([, body]) => ({
      name: body!.match(/<name><text>([^<]*)<\/text><\/name>/u)![1]!,
      text: words(
        body!.match(/<questiontext[^>]*>\s*<text><!\[CDATA\[([\s\S]*?)\]\]><\/text>/u)![1]!,
      ),
      answers: [...body!.matchAll(/<answer fraction="([\d.]+)"[^>]*>([\s\S]*?)<\/answer>/gu)].map(
        ([, fraction, answer]) => {
          const file = answer!.match(/<file [^>]*encoding="base64">([^<]+)<\/file>/u)?.[1];
          const pixels = file ? pngPixels(base64ToBytes(file)) : null;
          return {
            fraction: Number(fraction),
            text: words(answer!.match(/<text><!\[CDATA\[([\s\S]*?)\]\]><\/text>/u)?.[1] ?? ""),
            pixels: pixels
              ? `${pixels.width}x${pixels.height}:${pixels.rgb.toString("base64")}`
              : null,
          };
        },
      ),
    }),
  );
}

test("the script's pictures come out of the PDF as they are: soal 7's three, (c) on page 3", async () => {
  const pdf = await readFile(join(PACK, "F4-2_naskah-ipas-10-soal.pdf"));
  const images = await extractPdfImages(pdf);
  assert.deepEqual(
    images.map((image) => [image.id, image.page, image.width, image.height]),
    [
      ["gambar-1", 2, 240, 150],
      ["gambar-2", 2, 240, 150],
      ["gambar-3", 3, 240, 150],
    ],
  );
  const expected = await readFile(join(PACK, "F4-2_hasil-yang-diharapkan.xml"), "utf8");
  const files = [...expected.matchAll(/encoding="base64">([^<]+)</gu)].map(
    (match) => pngPixels(base64ToBytes(match[1]!)).rgb,
  );
  const extracted = images.map(
    (image) => pngPixels(base64ToBytes(image.dataUrl.split(",")[1]!)).rgb,
  );
  assert.equal(files.length, 3);
  files.forEach((pixels, index) =>
    assert.ok(pixels.equals(extracted[index]!), `gambar ${index + 1}`),
  );
});

test("F4-2 offline: 10/10 questions match the expected XML, IPAS, 30 Nov to 3 Dec, nothing to ask", async () => {
  const result = quizScriptResultSchema.parse(
    await createFixtureSchoolAi().readQuizScript(await scriptInput()),
  );
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(result.questions, []);
  assert.equal(result.draft.name, "Latihan IPAS Kelas 4A");
  assert.equal(result.draft.section, "IPAS");
  assert.equal(result.draft.category, "$course$/top/IPAS 4A/Latihan IPAS Kelas 4A");
  assert.deepEqual(result.draft.opens, { date: "2026-11-30", time: null });
  assert.deepEqual(result.draft.closes, { date: "2026-12-03", time: null });

  const expectedXml = await readFile(join(PACK, "F4-2_hasil-yang-diharapkan.xml"), "utf8");
  const ours = parseQuestions(moodleXml(applyQuizAnswers(result.draft, [], []).draft));
  const expected = parseQuestions(expectedXml);
  assert.equal(ours.length, 10);
  // The script says "Perhatikan gambar berikut!"; the expected file has a full stop there, so
  // the words are compared without punctuation.
  for (const [index, question] of expected.entries())
    assert.deepEqual(ours[index], question, `${question.name} matches`);

  // The key matches F4-2_kunci.csv.
  const key = (await readFile(join(PACK, "F4-2_kunci.csv"), "utf8"))
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.split(",")[2]);
  assert.deepEqual(
    result.draft.questions.map((question) => String.fromCharCode(97 + question.key!)),
    key,
  );
});

test("the real pipeline sends the PDF and each picture by id, and keeps the model's reading", async () => {
  const llm = fakeJsonCall({ quiz_script: F4_2_READING });
  const result = await readQuizScript({ llm }, await scriptInput());
  assert.equal(result.status, "ok");
  const content = llm.calls[0]!.content;
  assert.ok(content.some((part) => part.type === "file" && part.filename.endsWith(".pdf")));
  assert.equal(content.filter((part) => part.type === "image").length, 3);
  assert.ok(
    content.some((part) => part.type === "text" && part.text.includes("gambar-3 (halaman 3)")),
  );
  assert.match(llm.calls[0]!.instructions, /Jangan pernah menulis, memperbaiki, atau menebak/u);
});

test("unreadable parts become questions for the teacher; nothing is guessed", async () => {
  const input = await scriptInput("Nemu, masukkan kuis ini.");
  const model: ModelQuizScript = structuredClone(F4_2_READING);
  const soal = (number: number) => model.questions.find((question) => question.number === number)!;
  soal(2).text = null;
  soal(2).text_candidates = ["Contoh gaya otot adalah ....", "Contoh gaya gesek adalah ...."];
  soal(4).key = null;
  soal(7).choices[2]!.image = null;
  soal(7).choices[2]!.image_missing = true;
  soal(9).choices[1]!.text = null;
  model.subject = "Sains";
  model.title = "Latihan Sains";

  const result = assembleQuizScript(input, model, [], "Bu");
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(
    result.questions.map((question) => [question.id, question.kind, question.prompt]),
    [
      ["text-2", "text", "Kalimat soal 2 tidak terbaca. Bunyinya apa, Bu?"],
      ["key-4", "key", "Kunci jawaban soal 4 tidak ada di naskah. Yang benar yang mana, Bu?"],
      // No pictures were taken out here, so (a) and (b) can't be placed either.
      [
        "image-7-a",
        "image",
        "Gambar pilihan a soal 7 tidak bisa Nemu ambil dari naskah. Lanjut bagaimana, Bu?",
      ],
      [
        "image-7-b",
        "image",
        "Gambar pilihan b soal 7 tidak bisa Nemu ambil dari naskah. Lanjut bagaimana, Bu?",
      ],
      [
        "image-7-c",
        "image",
        "Gambar pilihan c soal 7 tidak bisa Nemu ambil dari naskah. Lanjut bagaimana, Bu?",
      ],
      ["text-9-b", "text", "Pilihan b soal 9 tidak terbaca. Bunyinya apa, Bu?"],
      ["section", "section", "Kuis ini masuk ke bagian mana, Bu?"],
    ],
  );
  // Options are what the model saw, never pre-selected; the section's are the course's own.
  assert.deepEqual(result.questions[0]!.options, [
    "Contoh gaya otot adalah ....",
    "Contoh gaya gesek adalah ....",
  ]);
  assert.deepEqual(result.questions.at(-1)!.options, ["IPAS", "Bahasa Inggris", "Umum"]);
  assert.equal(result.draft.section, null);
  assert.equal(result.draft.opens, null);
  assert.equal(result.draft.questions.find((question) => question.number === 4)!.key, null);
  assert.equal(result.draft.questions.find((question) => question.number === 2)!.text, "");

  // Without her answers there is no XML.
  assert.throws(() => applyQuizAnswers(result.draft, result.questions, []));

  const { draft, skipped } = applyQuizAnswers(result.draft, result.questions, [
    { questionId: "text-2", answer: "Contoh gaya otot adalah ...." },
    { questionId: "key-4", answer: "d" },
    { questionId: "image-7-a", answer: SKIP_QUESTION },
    { questionId: "image-7-b", answer: SKIP_QUESTION },
    { questionId: "image-7-c", answer: SKIP_QUESTION },
    { questionId: "text-9-b", answer: "jumlah pohon" },
    { questionId: "section", answer: "IPAS" },
  ]);
  assert.deepEqual(skipped, [7]);
  assert.equal(draft.section, "IPAS");
  const xml = moodleXml(draft);
  const parsed = parseQuestions(xml);
  assert.equal(parsed.length, 9);
  assert.ok(!parsed.some((question) => question.name === "Soal 07"));
  assert.equal(parsed.find((question) => question.name === "Soal 04")!.answers[3]!.fraction, 100);
  assert.equal(
    parsed.find((question) => question.name === "Soal 09")!.answers[1]!.text,
    "jumlah pohon",
  );
});

test("a picture she'll add later stays an empty image, so the F4-1 check points at it", async () => {
  const input = await scriptInput();
  const model: ModelQuizScript = structuredClone(F4_2_READING);
  model.questions.find((question) => question.number === 7)!.choices[2]!.image_missing = true;
  model.questions.find((question) => question.number === 7)!.choices[2]!.image = null;
  const images = await extractPdfImages(base64ToBytes(input.file.dataUrl.split(",")[1]!));
  const result = assembleQuizScript(input, model, images);
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(
    result.questions.map((question) => question.id),
    ["image-7-c"],
  );
  const { draft } = applyQuizAnswers(result.draft, result.questions, [
    { questionId: "image-7-c", answer: "Gambarnya saya pasang nanti" },
  ]);
  const xml = moodleXml(draft);
  assert.match(xml, /<img src="@@PLUGINFILE@@\/gambar-belum-ada-7-c\.png"/u);
  assert.doesNotMatch(xml, /<file name="gambar-belum-ada-7-c\.png"/u);
});

test("offline, any other file reads as no questions instead of invented ones", async () => {
  const input = await scriptInput();
  const other = {
    ...input,
    file: { ...input.file, dataUrl: "data:application/pdf;base64,JVBERi0xLjQK" },
  };
  assert.deepEqual(await createFixtureSchoolAi().readQuizScript(other), {
    status: "unreadable",
    message: "Nemu tidak menemukan soal di berkas ini, Bu.",
  });
});
