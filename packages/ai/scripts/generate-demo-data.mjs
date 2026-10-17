import { readFile, writeFile } from "node:fs/promises";

const repositoryData = new URL("../../../data/", import.meta.url);
const outputFile = new URL("../src/demo.generated.ts", import.meta.url);

async function readText(relativePath) {
  return readFile(new URL(relativePath, repositoryData), "utf8");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.length)) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...values] = rows;
  return values.map((valuesRow) =>
    Object.fromEntries(headers.map((header, index) => [header, valuesRow[index] ?? ""])),
  );
}

function inferArticle(text, fallback) {
  const match = text.match(/Pasal\s+(\d+[A-Z]?)(?:\s+ayat\s+\((\d+)\))?/iu);
  if (!match) {
    return fallback;
  }
  return match[2] ? `${match[1]} ayat (${match[2]})` : match[1];
}

function makeChunk(document, text, suffix, page, fallbackArticle) {
  return {
    id: `${document.doc_id}-${suffix}`,
    docId: document.doc_id,
    title: document.judul,
    version: document.berlaku_untuk ?? document.berlaku_mulai ?? "1.0",
    article: inferArticle(text, fallbackArticle),
    ...(page ? { page } : {}),
    active: document.status === "aktif",
    text: text.trim(),
  };
}

function chunkDocument(document, markdown) {
  const pageMarkers = [...markdown.matchAll(/^\[Halaman (\d+)\]\s*$/gmu)];
  if (pageMarkers.length) {
    return pageMarkers
      .map((marker, index) => {
        const start = (marker.index ?? 0) + marker[0].length;
        const end = pageMarkers[index + 1]?.index ?? markdown.length;
        const page = Number(marker[1]);
        return makeChunk(document, markdown.slice(start, end), `page-${page}`, page);
      })
      .filter((chunk) => chunk.text.length > 0);
  }

  const headings = [...markdown.matchAll(/^##\s+(.+)$/gmu)];
  if (!headings.length) {
    return [makeChunk(document, markdown, "document")];
  }

  return headings.map((heading, index) => {
    const start = heading.index ?? 0;
    const end = headings[index + 1]?.index ?? markdown.length;
    return makeChunk(
      document,
      markdown.slice(start, end),
      `section-${index + 1}`,
      undefined,
      heading[1],
    );
  });
}

const registry = JSON.parse(await readText("01_knowledge_rag/document_registry.json"));
const knowledgeChunks = (
  await Promise.all(
    registry.map(async (document) => {
      const markdown = await readText(document.berkas);
      return chunkDocument(document, markdown);
    }),
  )
).flat();

const accommodationRows = parseCsv(await readText("02_tabel/sbm2026_penginapan_dalam_negeri.csv"));
const dailyAllowanceRows = parseCsv(
  await readText("02_tabel/sbm2026_uang_harian_dalam_negeri.csv"),
);
const ticketRows = parseCsv(await readText("02_tabel/sbm2026_tiket_pesawat_pp_dalam_negeri.csv"));
const airportTransportRows = parseCsv(
  await readText("02_tabel/sbm2026_transport_terminal_bandara.csv"),
);
const sbmRows = [
  ...accommodationRows.flatMap((row) => [
    {
      province: row.provinsi,
      component: "hotel",
      grade: "IV",
      value: Number(row.eselon_III_golongan_IV),
      source: row.sumber,
    },
    {
      province: row.provinsi,
      component: "hotel",
      grade: "III",
      value: Number(row.eselon_IV_golongan_III_II_I),
      source: row.sumber,
    },
  ]),
  ...dailyAllowanceRows.map((row) => ({
    province: row.provinsi,
    component: "uang_harian",
    grade: "*",
    value: Number(row.luar_kota),
    source: row.sumber,
  })),
  ...ticketRows.flatMap((row) => [
    {
      province: `${row.kota_asal} - ${row.kota_tujuan}`,
      component: "tiket_pesawat",
      grade: "bisnis",
      value: Number(row.bisnis_pp),
      source: "PMK 32/2025 Lampiran II angka 17",
    },
    {
      province: `${row.kota_asal} - ${row.kota_tujuan}`,
      component: "tiket_pesawat",
      grade: "ekonomi",
      value: Number(row.ekonomi_pp),
      source: "PMK 32/2025 Lampiran II angka 17",
    },
  ]),
  ...airportTransportRows.map((row) => ({
    province: row.provinsi,
    component: "transport_bandara",
    grade: "*",
    value: Number(row.besaran_per_orang_per_kali),
    source: row.sumber,
  })),
];

const holidays = parseCsv(await readText("02_tabel/kalender_libur_2026.csv")).map(
  (row) => row.tanggal,
);

const output = `// Generated by scripts/generate-demo-data.mjs from data/01_knowledge_rag and data/02_tabel.
// Do not edit this file directly.
import type { KnowledgeChunk } from "./knowledge.js";
import type { SbmRow } from "./tools.js";

export const GENERATED_KNOWLEDGE_CHUNKS = ${JSON.stringify(knowledgeChunks, null, 2)} satisfies readonly KnowledgeChunk[];

export const GENERATED_SBM_ROWS = ${JSON.stringify(sbmRows, null, 2)} satisfies readonly SbmRow[];

export const GENERATED_HOLIDAYS_2026 = ${JSON.stringify(holidays, null, 2)} satisfies readonly string[];
`;

await writeFile(outputFile, output, "utf8");
