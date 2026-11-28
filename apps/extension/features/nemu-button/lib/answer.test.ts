import { describe, expect, test } from "vite-plus/test";

import { fromGroundedAnswer, singleSourceFile, type SourceFile, sourceLinkLabel } from "./answer";

describe("fromGroundedAnswer: not in the guide (F3·11)", () => {
  test("says who can answer and offers her question to the operator on WhatsApp", () => {
    expect(
      fromGroundedAnswer({
        status: "not_in_guide",
        answer: "Ini belum ada di panduan sekolah, Bu.",
        detail: "Yang bisa menjawab: Pak Rizal atau kepala sekolah.",
        offerOperator: { name: "Pak Rizal", role: "operator", phone: "6281200000002" },
        waDraft: { phone: "6281200000002", text: "Assalamualaikum Pak Rizal." },
      }),
    ).toEqual({
      kind: "answer",
      text: "Ini belum ada di panduan sekolah, Bu.",
      status: { text: "Belum ada", tone: "muted" },
      detail: "Yang bisa menjawab: Pak Rizal atau kepala sekolah.",
      sources: [],
      next: {
        kind: "whatsapp",
        label: "Siapkan pesan WA",
        url: "https://web.whatsapp.com/send?phone=6281200000002&text=Assalamualaikum%20Pak%20Rizal.",
      },
    });
  });

  test("without an operator there is no button", () => {
    const result = fromGroundedAnswer({
      status: "not_in_guide",
      answer: "Belum ada di panduan sekolah.",
    });
    expect(result).toMatchObject({ kind: "answer", sources: [] });
    expect(result).not.toHaveProperty("next");
  });
});

const SOP: SourceFile = {
  label: "SOP Penilaian SDIT Nusantara · hlm. 2 · 3.2",
  docId: "sop-penilaian-sdit-nusantara",
  title: "SOP Penilaian SDIT Nusantara",
  page: 2,
};

describe("singleSourceFile (F3·09)", () => {
  test("an answer citing one document it can open gets that document", () => {
    expect(singleSourceFile({ sources: [SOP.label], files: [SOP] })).toEqual(SOP);
  });

  test("several sources, a source without a file, or a process keep the Sumber list", () => {
    const other = { ...SOP, label: "SOP Penilaian SDIT Nusantara · hlm. 3 · 4.1", page: 3 };
    expect(singleSourceFile({ sources: [SOP.label, other.label], files: [SOP, other] })).toBeNull();
    expect(singleSourceFile({ sources: ["Kamus Kendala · K-07"] })).toBeNull();
    expect(
      singleSourceFile({
        sources: [SOP.label],
        files: [SOP],
        diagram: { label: "Lihat diagram Alur SPP", href: "https://example.test/diagram" },
      }),
    ).toBeNull();
  });
});

describe("sourceLinkLabel", () => {
  test("names the document without the school's name, and the page it opens at", () => {
    expect(sourceLinkLabel(SOP, "SDIT Nusantara")).toBe("Sumber: SOP Penilaian, hlm. 2");
  });

  test("keeps the whole title when the school is unknown or is the whole title", () => {
    expect(sourceLinkLabel(SOP, null)).toBe("Sumber: SOP Penilaian SDIT Nusantara, hlm. 2");
    expect(sourceLinkLabel({ ...SOP, title: "SDIT Nusantara" }, "SDIT Nusantara")).toBe(
      "Sumber: SDIT Nusantara, hlm. 2",
    );
    expect(sourceLinkLabel({ ...SOP, page: null }, "SDIT Nusantara")).toBe("Sumber: SOP Penilaian");
  });
});
