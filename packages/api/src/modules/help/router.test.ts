import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { createSchoolContext } from "../../testing/school";
import { speechRouter } from "../speech/router";
import { helpRouter } from "./router";

const SNAPSHOT = {
  title: "Ruang GTK - Pengelolaan Kinerja",
  url: "https://ruang.gtk.example/kinerja",
  alerts: ["Data Perencanaan (SKP) belum bisa diajukan karena RHK atasan belum tersedia."],
  headings: [],
  fields: [],
  screenshotBase64: null,
};

describe("F2 and school questions through the API (seeded kamus and SOP)", () => {
  it("explains a kamus error with the fixer from the teacher's profile and a WhatsApp draft", async () => {
    const context = await createSchoolContext();
    const result = await call(
      helpRouter.helpExplain,
      { snapshot: SNAPSHOT, question: "Nemu, ini kenapa?" },
      { context },
    );
    expect(result).toMatchObject({
      status: "matched",
      sentence: "Bukan kesalahan Ibu. Yang bisa memperbaiki: Pak Ahmad (kepsek).",
      citation: { docId: "kamus-kendala", article: "K-01" },
      waDraft: { phone: "6281200000001" },
    });
  });

  it("F2-2: an unassigned subject on AlurSekolah is Pak Rizal's to fix, from Kamus Kendala K-07", async () => {
    const context = await createSchoolContext();
    const result = await call(
      helpRouter.helpExplain,
      {
        snapshot: {
          title: "AlurSekolah (tiruan)",
          url: "http://localhost:3003/#/nilai",
          alerts: [
            "Tidak dapat menampilkan siswa\nAnda belum ditugaskan mengampu IPAS di kelas 4A. Hubungi admin sekolah.",
          ],
          headings: ["Isi nilai kelas"],
          fields: [
            { label: "Kelas", value: "4A" },
            { label: "Mata pelajaran", value: "IPAS" },
          ],
          screenshotBase64: null,
        },
        question: "Nemu, ini kenapa?",
      },
      { context },
    );
    expect(result).toMatchObject({
      status: "matched",
      sentence: "Bukan kesalahan Ibu. Yang bisa memperbaiki: Pak Rizal (operator).",
      canSelfFix: false,
      citation: { docId: "kamus-kendala", article: "K-07" },
      waDraft: { phone: "6281200000002" },
    });
  });

  it("F2-3: the Ruang GTK sync error is the teacher's to fix with Sinkro Ruang GTK (K-02), no WhatsApp", async () => {
    const context = await createSchoolContext();
    const result = await call(
      helpRouter.helpExplain,
      {
        snapshot: {
          ...SNAPSHOT,
          alerts: [
            "Data Perencanaan (SKP) Anda gagal dialirkan ke E-Kinerja\nAlasan: Tidak ditandai sebagai User Ruang GTK.",
          ],
        },
        question: "ini kenapa?",
      },
      { context },
    );
    expect(result).toMatchObject({
      status: "matched",
      canSelfFix: true,
      guidedTarget: "Sinkro Ruang GTK",
      waDraft: null,
      citation: { article: "K-02" },
    });
  });

  it("answers the KKM from the SOP with page and point, and abstains on what the SOP doesn't cover", async () => {
    const context = await createSchoolContext();
    const kkm = await call(helpRouter.helpAsk, { question: "KKM nilai berapa?" }, { context });
    expect(kkm).toMatchObject({
      status: "answered",
      citations: [{ docId: "sop-penilaian-sdit-nusantara", page: 2, article: "3.2" }],
    });
    await expect(
      call(helpRouter.helpAsk, { question: "Cuti melahirkan berapa bulan?" }, { context }),
    ).resolves.toEqual({
      status: "not_in_guide",
      answer: "Belum ada di panduan sekolah.",
    });
  });

  it("'berhenti' is a control, recognized without the model", async () => {
    const context = await createSchoolContext();
    await expect(
      call(helpRouter.helpRoute, { utterance: "berhenti" }, { context }),
    ).resolves.toEqual({ kind: "control", control: "berhenti" });
  });

  it("speech: transcript for the bubble, and text + timings for the local voice when no TTS is configured", async () => {
    const context = await createSchoolContext();
    await expect(
      call(speechRouter.speechTranscribe, { audioBase64: "UklGRg==", format: "wav" }, { context }),
    ).resolves.toEqual({
      text: "masukkan nilai UTS Matematika 4B",
    });
    const speech = await call(
      speechRouter.speechSynthesize,
      { text: "Silakan Ibu tekan Simpan." },
      { context },
    );
    expect(speech).toMatchObject({
      audioBase64: "",
      text: "Silakan Ibu tekan Simpan.",
      timing: "estimated",
    });
  });
});
