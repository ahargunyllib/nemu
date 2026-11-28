import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { dataUrlBytes, fileKind, fileMeta, pdfPageCount } from "./script-file";

const SCRIPT = resolve(import.meta.dirname, "../../../../../infra/setup/f4-2");

describe("the script on the start card (F4·06)", () => {
  test("Richard's F4-2 script has 4 pages", () => {
    const bytes = readFileSync(resolve(SCRIPT, "F4-2_naskah-ipas-10-soal.pdf"));
    expect(pdfPageCount(new Uint8Array(bytes))).toBe(4);
  });

  test("a nested page tree counts every page once, from its root", () => {
    const pdf = [
      "1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj",
      "2 0 obj <</Type /Pages /Kids [3 0 R 4 0 R] /Count 3>> endobj",
      "3 0 obj <</Type /Pages /Parent 2 0 R /Kids [5 0 R 6 0 R] /Count 2>> endobj",
      "4 0 obj <</Type /Page /Parent 2 0 R>> endobj",
      "5 0 obj <</Type /Page /Parent 3 0 R>> endobj",
      "6 0 obj <</Type /Page /Parent 3 0 R>> endobj",
    ].join("\n");
    expect(pdfPageCount(new TextEncoder().encode(pdf))).toBe(3);
  });

  test("a PDF whose page tree can't be read gets no page count", () => {
    expect(pdfPageCount(new TextEncoder().encode("%PDF-1.7 compressed"))).toBeNull();
  });

  test("the chip names the type and the pages only when they are known", () => {
    expect(fileKind("naskah-ipas-10-soal.pdf", "application/pdf")).toBe("PDF");
    expect(fileKind("soal.docx", "")).toBe("DOCX");
    expect(fileKind("IMG_0412.jpg", "image/jpeg")).toBe("FOTO");
    expect(fileMeta(10, 4)).toBe("10 soal · 4 halaman");
    expect(fileMeta(10, null)).toBe("10 soal");
  });

  test("a data URL's bytes, as FileReader gives them", () => {
    expect([...dataUrlBytes("data:text/plain;base64,TmVtdQ==")]).toEqual([78, 101, 109, 117]);
  });
});
