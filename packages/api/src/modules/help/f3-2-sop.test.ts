import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createFixtureSchoolAi, createSchoolAi } from "@nemu/ai/school/runtime";
import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { createSchoolContext } from "../../testing/school";
import { helpRouter } from "./router";

// F3-2 (PRD §11): the five questions on the official SOP Penilaian, asked as Bu Siti through
// helpAsk over the seeded W-SEKOLAH knowledge. Offline it checks the cited page and point with the
// fixture responder; NEMU_LIVE_EVAL=1 asks the configured text model (apps/server/.env) and also
// checks each answer against the key:
//   NEMU_LIVE_EVAL=1 pnpm --filter @nemu/api exec vp test run src/modules/help/f3-2-sop.test.ts

const FIXTURES = join(import.meta.dirname, "../../../../ai/src/school/fixtures");
const SOP = "sop-penilaian-sdit-nusantara";
const live = process.env.NEMU_LIVE_EVAL === "1";

type Case = { no: string; question: string; page: number | null; point: string | null };

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (quoted && char === '"' && line[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else cell += char;
  }
  return [...cells, cell];
}

/** "SOP Penilaian SDIT Nusantara, hlm. 2, poin 3.2" → page 2, point 3.2; "Tidak ada" → none. */
function loadCases(): Case[] {
  const [, ...rows] = readFileSync(join(FIXTURES, "F3-2_pertanyaan-dan-kunci.csv"), "utf8")
    .trim()
    .split(/\r?\n/u);
  return rows.map((row) => {
    const [no, question, , source] = parseCsvLine(row);
    const location = source!.match(/hlm\. (\d+), poin ([\d.]+)/u);
    return {
      no: no!,
      question: question!,
      page: location ? Number(location[1]) : null,
      point: location?.[2] ?? null,
    };
  });
}

/** What the key's "lulus jika" asks the answer to say, beyond the cited page and point. */
const ANSWER_MUST: Record<string, RegExp[]> = {
  "1": [/\b75\b/u],
  "2": [/\b2\b|\bdua\b/iu, /\b75\b/u],
  "3": [/\b7\b|\btujuh\b/iu, /hari kerja/iu],
  "4": [/\b0\b|\bnol\b/iu, /kosong/iu, /tidak hadir/iu],
  "5": [/belum ada di panduan sekolah/iu],
};

function liveAi() {
  for (const line of readFileSync(
    join(import.meta.dirname, "../../../../../apps/server/.env"),
    "utf8",
  ).split(/\r?\n/u)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/u);
    if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.trim();
  }
  return createSchoolAi({
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    zdr: process.env.OPENROUTER_ZDR === "true",
    models: {
      readA: "",
      readB: "",
      reread: "",
      text: process.env.OPENROUTER_SCHOOL_TEXT_MODEL ?? "anthropic/claude-haiku-5.5",
      transcription: "",
      speech: "",
      speechVoice: "",
    },
  });
}

describe(`F3-2: the official SOP Penilaian answers with its page and point (${live ? "live" : "fixture"})`, () => {
  const cases = loadCases();

  it("has the five questions of the test pack", () => {
    expect(cases.map(({ no, page, point }) => [no, page, point])).toEqual([
      ["1", 2, "3.2"],
      ["2", 2, "3.3"],
      ["3", 3, "4.1"],
      ["4", 3, "4.3"],
      ["5", null, null],
    ]);
  });

  it.each(cases)(
    "$no. $question",
    async ({ no, question, page, point }) => {
      const context = await createSchoolContext(
        undefined,
        live ? liveAi() : createFixtureSchoolAi(),
      );
      const answer = await call(helpRouter.helpAsk, { question }, { context });
      if (live) {
        const cited =
          answer.status === "answered"
            ? answer.citations.map((c) => `${c.title} hlm. ${c.page} poin ${c.article}`).join("; ")
            : "-";
        console.info(`F3-2 #${no} [${answer.status}] ${answer.answer} | ${cited}`);
      }

      if (point === null) {
        expect(answer).toEqual({ status: "not_in_guide", answer: "Belum ada di panduan sekolah." });
        return;
      }
      expect(answer.status).toBe("answered");
      if (answer.status !== "answered") return;
      expect(answer.citations[0]).toMatchObject({ docId: SOP, page, article: point });
      if (live) for (const pattern of ANSWER_MUST[no]!) expect(answer.answer).toMatch(pattern);
    },
    live ? 60_000 : 5_000,
  );
});
