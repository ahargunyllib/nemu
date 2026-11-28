import { describe, expect, test } from "vite-plus/test";

import { singleSourceFile, type SourceFile, sourceLinkLabel } from "./answer";

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
