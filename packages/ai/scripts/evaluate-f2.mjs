// F2 "Nemu, ini kenapa?" on the official Kamus Kendala (AI_TECHNICAL_PRD §5.1 and §13, #216).
//
//   pnpm --filter @nemu/ai eval:f2            offline: code matching, the model step answers "none"
//   pnpm --filter @nemu/ai eval:f2 -- --live  the model step on OpenRouter (OPENROUTER_SCHOOL_TEXT_MODEL)
//
// F2-2 and F2-3 as the extension reads the test pack's screens, three screens the kamus doesn't
// cover, and a variant of no. 7 (another subject and class) that only the model step can match.
// Live mode reads apps/server/.env like the server does. Prints each case and the model calls.
import { existsSync, readFileSync } from "node:fs";

import {
  F2_2_PAGE,
  F2_3_PAGE,
  KAMUS_ROWS,
  NOT_IN_GUIDE_PAGES,
} from "../dist/school/fixtures/kamus.js";
import { BU_SITI } from "../dist/school/fixtures/sdit-nusantara.js";
import { explainError } from "../dist/school/help.js";
import { createOpenRouterJsonCaller } from "../dist/school/llm.js";
import { mentionsSecret } from "../dist/school/safety.js";

function loadServerEnv() {
  const path = new URL("../../../apps/server/.env", import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (key && !process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

const live = process.argv.includes("--live");
loadServerEnv();
if (live && !process.env.OPENROUTER_API_KEY) {
  console.error("Live mode needs OPENROUTER_API_KEY (apps/server/.env).");
  process.exit(2);
}

const model = process.env.OPENROUTER_SCHOOL_TEXT_MODEL ?? "anthropic/claude-haiku-5.5";
const real = live
  ? createOpenRouterJsonCaller({
      apiKey: process.env.OPENROUTER_API_KEY,
      model,
      zdr: process.env.OPENROUTER_ZDR === "true",
    })
  : null;
let calls = 0;
const llm = async (request) => {
  calls += 1;
  return real ? real(request) : request.parse({ row_id: null });
};

// Bu Siti and the contacts as 01_profil-sekolah/profil-sekolah.json lists them (WS-06).
const TEACHER = {
  ...BU_SITI,
  name: "Siti Aminah, S.Pd.",
  nip: "197003152000032001",
  contacts: {
    kepsek: { name: "Pak Ahmad", role: "kepsek", phone: "6281200001002" },
    operator: { name: "Pak Rizal", role: "operator", phone: "6281200001003" },
    keuangan: { name: "Bu Ratna", role: "keuangan", phone: "6281200001005" },
  },
};

const VARIANT = {
  ...F2_2_PAGE,
  alerts: [
    "Tidak dapat menampilkan siswa. Anda belum ditugaskan mengampu Matematika di kelas 5A. Hubungi admin sekolah.",
  ],
  headings: ["Isi nilai kelas 5A"],
};

const cases = [
  {
    name: "F2-2 AlurSekolah belum ditugaskan",
    snapshot: F2_2_PAGE,
    check: (r) =>
      r.status === "matched" &&
      r.entryId === "K-07" &&
      r.sentence.startsWith("Bukan kesalahan Ibu.") &&
      r.fixer?.name === "Pak Rizal" &&
      r.waDraft?.phone === "6281200001003" &&
      !!r.waDraft &&
      ["Siti Aminah", "Isi nilai kelas", "IPAS", "4A", "menambahkan penugasan"].every((part) =>
        r.waDraft.text.includes(part),
      ),
  },
  {
    name: "F2-3 Ruang GTK bukan user",
    snapshot: F2_3_PAGE,
    check: (r) =>
      r.status === "matched" &&
      r.entryId === "K-02" &&
      r.canSelfFix &&
      r.guidedTarget === "Sinkro Ruang GTK" &&
      r.waDraft === null,
  },
  ...Object.entries(NOT_IN_GUIDE_PAGES).map(([name, snapshot]) => ({
    name: `not in guide: ${name}`,
    snapshot,
    check: (r) =>
      r.status === "not_in_guide" && r.sentence.startsWith("Belum ada di panduan sekolah."),
  })),
  ...(live
    ? [
        {
          name: "model step: no. 7 for Matematika 5A",
          snapshot: VARIANT,
          check: (r) => r.status === "matched" && r.entryId === "K-07",
        },
      ]
    : []),
];

let failed = 0;
for (const item of cases) {
  const before = calls;
  const started = performance.now();
  const result = await explainError(
    { llm },
    { snapshot: item.snapshot, question: "Nemu, ini kenapa?", kamus: KAMUS_ROWS, teacher: TEACHER },
  );
  const texts = [result.sentence, result.why ?? "", result.waDraft?.text ?? ""];
  const safe = texts.every((text) => !/\bsalah\b/iu.test(text) && !mentionsSecret(text));
  const ok = item.check(result) && safe;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "✔" : "✘"} ${item.name}: ${result.status}${result.entryId ? ` ${result.entryId}` : ""} · ` +
      `"${result.sentence}" · model calls ${calls - before} · ${Math.round(performance.now() - started)} ms`,
  );
  if (result.waDraft) console.log(`    WA ${result.waDraft.phone}: ${result.waDraft.text}`);
}
console.log(
  `${cases.length - failed}/${cases.length} pass · ${live ? `live (${model})` : "offline"} · ${calls} model calls`,
);
process.exit(failed ? 1 : 0);
