import type { HelpExplanation } from "@nemu/contracts/school";
import { describe, expect, test } from "vite-plus/test";

import { fromExplanation } from "./explanation";
import { whatsAppUrl } from "./whatsapp";

const CITATION = {
  chunkId: "kamus-k02",
  docId: "kamus-kendala",
  title: "Kamus Kendala",
  page: null,
  article: "K-02",
  quote: "Guru cukup membuka menu E-Kinerja dan menekan tombol Sinkro Ruang GTK",
};

const RIZAL = { name: "Pak Rizal", role: "operator", phone: "6281200001003" };

describe("fromExplanation", () => {
  test("F2-3: the teacher can fix it, so Nemu offers cara 2 and no WhatsApp", () => {
    const explanation: HelpExplanation = {
      status: "matched",
      entryId: "K-02",
      sentence: "Ibu bisa memperbaikinya sendiri, saya tunjukkan caranya.",
      why: "Akun Ibu belum ditandai sebagai User Ruang GTK.",
      teacherFault: false,
      canSelfFix: true,
      fixer: null,
      guidedTarget: "Sinkro Ruang GTK",
      citation: CITATION,
      waDraft: null,
    };
    expect(fromExplanation(explanation)).toEqual({
      kind: "answer",
      text: "Ibu bisa memperbaikinya sendiri, saya tunjukkan caranya.",
      why: "Akun Ibu belum ditandai sebagai User Ruang GTK.",
      sources: ["Kamus Kendala · K-02"],
      next: { kind: "fix", target: "Sinkro Ruang GTK", how: CITATION.quote, entryId: "K-02" },
    });
  });

  test("not in the guide: says so and offers to message the operator", () => {
    const result = fromExplanation({
      status: "not_in_guide",
      sentence: "Belum ada di panduan sekolah. Mau saya bantu tanyakan ke Pak Rizal?",
      offerOperator: RIZAL,
      waDraft: { phone: "6281200001003", text: "Assalamualaikum Pak Rizal." },
    });
    expect(result).toMatchObject({
      kind: "answer",
      text: "Belum ada di panduan sekolah. Mau saya bantu tanyakan ke Pak Rizal?",
      sources: [],
      next: { kind: "whatsapp", label: "Ya, tanyakan ke Pak Rizal" },
    });
  });
});

describe("whatsAppUrl", () => {
  test("opens WhatsApp Web to the contact's number with the whole message", () => {
    const url = new URL(
      whatsAppUrl({
        phone: "+62 812-0000-1003",
        text: "Saya Siti (NIP 1970). Terima kasih & salam.",
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe("https://web.whatsapp.com/send");
    expect(url.searchParams.get("phone")).toBe("6281200001003");
    expect(url.searchParams.get("text")).toBe("Saya Siti (NIP 1970). Terima kasih & salam.");
  });

  test("a local number starting with 0 gets Indonesia's 62", () => {
    expect(whatsAppUrl({ phone: "081200001003", text: "Halo" })).toContain("phone=6281200001003&");
  });
});
