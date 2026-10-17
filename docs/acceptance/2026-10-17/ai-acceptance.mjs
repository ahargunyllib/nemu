// Acceptance run of Momen 1–3 against the real AI Responder (NEMU_RESPONDER=ai).
// Usage: node ai-acceptance.mjs <repo-root> <out-dir> [rounds]
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [repo, outDir, roundsArg = "3"] = process.argv.slice(2);
const require = createRequire(path.join(repo, "apps/extension/package.json"));
const { chromium } = require("playwright-core");

const EXT = path.join(repo, "apps/extension/.output/chrome-mv3-dev");
const DOCS = path.join(repo, "apps/mock-alurkerja/sample-documents");
const APP = "http://localhost:3001";
const SERVER = "http://localhost:3000";
const ROUNDS = Number(roundsArg);
const AI_TIMEOUT = 120_000;

const PROMPTS = {
  m1: "Saya dapat tugas rapat ke Makassar 3 hari, mulai dari mana?",
  m2: "Saya menginap di rumah saudara, ini diisi apa?",
  m3: "Saya sudah pulang kemarin, sekarang apa?",
};

await mkdir(outDir, { recursive: true });
const ctx = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
ctx.setDefaultTimeout(20_000);
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
const overlay = page.locator("nemu-overlay");
const card = overlay.locator('[data-slot="card"]').first();

async function openComposer() {
  const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  await overlay.waitFor({ state: "attached" });
  await worker.evaluate(
    async ({ url }) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((t) => t.url === url);
      await chrome.tabs.sendMessage(tab.id, { type: "nemu:open-composer" });
    },
    { url: page.url() },
  );
  return page.getByRole("textbox", { name: "Pertanyaan untuk Nemu" });
}

async function chatLog() {
  const body = await page.evaluate(async (server) => {
    const r = await fetch(`${server}/rpc/listChatLog`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return r.json();
  }, SERVER);
  return body.json ?? [];
}

/** Waits until `count` new Chat Log entries exist after `beforeId`, newest first. */
async function newEntries(beforeId, count = 1) {
  const deadline = Date.now() + AI_TIMEOUT;
  for (;;) {
    const log = await chatLog();
    const idx = beforeId ? log.findIndex((e) => e.id === beforeId) : log.length;
    const fresh = idx === -1 ? log : log.slice(0, idx);
    if (fresh.length >= count) return fresh.slice(0, count).reverse();
    if (Date.now() > deadline) throw new Error(`no answer within ${AI_TIMEOUT / 1000}s`);
    await page.waitForTimeout(500);
  }
}

const newestId = async () => (await chatLog())[0]?.id;
const summarize = (e) => ({
  status: e.status,
  result: e.result,
  durationMs: e.durationMs,
  actions: e.actions.map((a) => `${a.type}:${a.target}`),
  citations: e.citations.map((c) => `${c.judul}${c.pasal ? ` ${c.pasal}` : ""}`),
});
const close = async () => {
  const tutup = page.getByRole("button", { name: "Tutup" });
  if (await tutup.isVisible().catch(() => false)) await tutup.click();
};

async function reset() {
  await page.goto(APP);
  await page.getByRole("button", { name: "Panel demo" }).click();
  await page.getByRole("button", { name: "Reset data demo" }).click();
  await page.getByText("Data demo dikembalikan", { exact: false }).waitFor();
  await page.keyboard.press("Escape");
}

const results = [];
function check(round, momen, name, ok, detail) {
  results.push({ round, momen, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "✔" : "✘"} R${round} ${momen} ${name}${detail ? ` — ${detail}` : ""}`);
}

await page.goto(`${APP}/login`);
await page.getByRole("button", { name: /Masuk sebagai Rina/ }).click();
await page.getByRole("heading", { name: "Beranda" }).waitFor();

for (let r = 1; r <= ROUNDS; r++) {
  await reset();
  const round = { round: r };

  // Momen 1: Beranda → Nemu clicks Ajukan Perjalanan Dinas and lists documents.
  try {
    await page.goto(APP);
    await page.getByRole("heading", { name: "Beranda" }).waitFor();
    const before = await newestId();
    const t0 = Date.now();
    const box = await openComposer();
    await box.fill(PROMPTS.m1);
    await box.press("Enter");
    const [e] = await newEntries(before);
    round.m1 = { ...summarize(e), wallMs: Date.now() - t0 };
    check(r, "M1", "answered", e.status === "answer", `${e.status}, ${e.durationMs} ms`);
    check(
      r,
      "M1",
      "click on menu-ajukan-perjalanan-dinas",
      e.actions.some((a) => a.type === "click" && a.target === "menu-ajukan-perjalanan-dinas"),
      round.m1.actions.join(", ") || "no actions",
    );
    await page.waitForURL(`${APP}/perdin/baru`, { timeout: 8_000 }).catch(() => {});
    check(r, "M1", "form opened", page.url() === `${APP}/perdin/baru`, page.url());
    check(r, "M1", "has a citation", e.citations.length > 0, round.m1.citations.join("; "));
    await card.waitFor().catch(() => {});
    await page.waitForTimeout(800);
    await shot(`r${r}-m1`);
    await close();
  } catch (error) {
    check(r, "M1", "ran", false, String(error).split("\n")[0]);
    await shot(`r${r}-m1-failed`).catch(() => {});
  }

  // Momen 2: on the form, Area Crop of the lodging fields → highlight both, Rp447.000.
  try {
    await page.goto(`${APP}/perdin/baru`);
    await page.getByRole("heading", { name: "Ajukan Perjalanan Dinas" }).waitFor();
    const before = await newestId();
    const box = await openComposer();
    await box.fill(PROMPTS.m2);
    const targets = ["opt-penginapan-tidak-hotel", "input-nominal-penginapan"].map((id) =>
      page.locator(`[data-nemu-id="${id}"]`).first(),
    );
    await targets[0].scrollIntoViewIfNeeded();
    const boxes = await Promise.all(targets.map((t) => t.boundingBox()));
    const m = 12;
    const left = Math.min(...boxes.map((b) => b.x)) - m;
    const top = Math.min(...boxes.map((b) => b.y)) - m;
    const right = Math.max(...boxes.map((b) => b.x + b.width)) + m;
    const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + m;
    await page.getByRole("button", { name: "Pilih area" }).click();
    await page.getByRole("application", { name: "Pilih area" }).waitFor();
    await page.mouse.move(left, top);
    await page.mouse.down();
    await page.mouse.move(right, bottom, { steps: 8 });
    await page.mouse.up();
    await page.getByRole("img", { name: "Area Crop" }).waitFor();
    if (r === 1) await shot(`r${r}-m2-crop`);
    const t0 = Date.now();
    await box.press("Enter");
    const [e] = await newEntries(before);
    round.m2 = { ...summarize(e), wallMs: Date.now() - t0, hasAreaCrop: e.hasAreaCrop };
    check(r, "M2", "answered", e.status === "answer", `${e.status}, ${e.durationMs} ms`);
    check(r, "M2", "Area Crop attached", e.hasAreaCrop);
    for (const id of ["opt-penginapan-tidak-hotel", "input-nominal-penginapan"]) {
      check(
        r,
        "M2",
        `highlight ${id}`,
        e.actions.some((a) => a.type === "highlight" && a.target === id),
        round.m2.actions.join(", ") || "no actions",
      );
    }
    check(
      r,
      "M2",
      "no click/fill on the form",
      !e.actions.some((a) => a.type === "click"),
      round.m2.actions.join(", "),
    );
    await card.waitFor();
    await page.waitForTimeout(1500);
    const text = (await card.innerText()).replace(/\s+/g, " ");
    check(r, "M2", "Rp447.000 on the card", /447[.,]000/.test(text), text.slice(0, 160));
    check(
      r,
      "M2",
      "cites PMK 119/2023",
      e.citations.some((c) => c.judul.includes("119/2023")),
      round.m2.citations.join("; "),
    );
    await shot(`r${r}-m2`);
    await close();
  } catch (error) {
    check(r, "M2", "ran", false, String(error).split("\n")[0]);
    await shot(`r${r}-m2-failed`).catch(() => {});
  }

  // Momen 3: Beranda → opens the task, follow-up rings uploads + Kirim, deadline 12 Nov 2026.
  try {
    await page.goto(APP);
    await page.getByRole("heading", { name: "Beranda" }).waitFor();
    const before = await newestId();
    const t0 = Date.now();
    const box = await openComposer();
    await box.fill(PROMPTS.m3);
    await box.press("Enter");
    const [first] = await newEntries(before);
    round.m3 = { first: summarize(first) };
    check(
      r,
      "M3",
      "answered",
      first.status === "answer",
      `${first.status}, ${first.durationMs} ms`,
    );
    check(
      r,
      "M3",
      "click on task-pertanggungjawaban",
      first.actions.some((a) => a.type === "click" && a.target === "task-pertanggungjawaban"),
      round.m3.first.actions.join(", ") || "no actions",
    );
    const taskUrl = `${APP}/perdin/task/PD-2026-0042`;
    await page.waitForURL(taskUrl, { timeout: 10_000 }).catch(() => {});
    check(r, "M3", "task opened", page.url() === taskUrl, page.url());
    if (page.url() === taskUrl) {
      const [, follow] = await newEntries(before, 2);
      round.m3.followUp = { ...summarize(follow), wallMs: Date.now() - t0 };
      check(
        r,
        "M3",
        "follow-up answered",
        follow.status === "answer",
        `${follow.status}, ${follow.durationMs} ms`,
      );
      for (const id of ["upload-laporan-perjalanan", "upload-boarding-pass-pulang"]) {
        check(
          r,
          "M3",
          `highlight ${id}`,
          follow.actions.some((a) => a.type === "highlight" && a.target === id),
          round.m3.followUp.actions.join(", ") || "no actions",
        );
      }
      check(
        r,
        "M3",
        "confirm on button-kirim",
        follow.actions.some((a) => a.type === "confirm" && a.target === "button-kirim"),
        round.m3.followUp.actions.join(", "),
      );
      await card.waitFor();
      await page.waitForTimeout(1500);
      const text = (await card.innerText()).replace(/\s+/g, " ");
      check(
        r,
        "M3",
        "deadline 12 November 2026 on the card",
        /12 November 2026/.test(text),
        text.slice(0, 160),
      );
      await shot(`r${r}-m3-task`);
      for (const [id, file] of [
        ["upload-laporan-perjalanan", "laporan-perjalanan-makassar.pdf"],
        ["upload-boarding-pass-pulang", "boarding-pass-pulang-upg-cgk.pdf"],
      ]) {
        await page.locator(`[data-nemu-id="${id}"]`).setInputFiles(path.join(DOCS, file));
        await page.getByText(`${file} terunggah`).first().waitFor();
        await page.waitForTimeout(1000); // let the task refetch (see the Kirim race in the report)
      }
      await page.locator('[data-nemu-id="button-kirim"]').click();
      const status = overlay.getByRole("region", { name: "Status tugas" });
      const sent = await status
        .getByText("Verifikasi", { exact: true })
        .waitFor()
        .then(() => true)
        .catch(() => false);
      check(r, "M3", "Kirim → Verifikasi on the card", sent);
      await shot(`r${r}-m3-sent`);
    }
    await close();
  } catch (error) {
    check(r, "M3", "ran", false, String(error).split("\n")[0]);
    await shot(`r${r}-m3-failed`).catch(() => {});
  }
  results.push({ round: r, entries: round });
}

await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
await ctx.close();
const fails = results.filter((x) => x.ok === false).length;
console.log(`\n${fails === 0 ? "ALL PASSED" : `${fails} check(s) failed`}`);
process.exit(fails ? 1 : 0);
