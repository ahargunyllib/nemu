import { describe, expect, test } from "vite-plus/test";

import { operatorRequest } from "./operator-request";

const RIZAL = "rizal.operator@sditnusantara.sch.id";
const PAGE = { name: "Beranda", url: "http://localhost:3003/#/beranda" };

function textOf(url: string) {
  return new URL(url).searchParams.get("text");
}

describe("operatorRequest (ID-02)", () => {
  test("opens WhatsApp Web to the WS-06 operator with a ready request to register the account", () => {
    const request = operatorRequest(
      {
        status: "unregistered",
        message: "Akun Ibu belum didaftarkan di Nemu.",
        email: RIZAL,
        operator: { name: "Pak Rizal", phone: "6281200001003" },
      },
      PAGE,
    );

    expect(request?.detail).toBe("Yang bisa mendaftarkan: Pak Rizal, operator sekolah.");
    expect(request?.label).toBe("Siapkan pesan WA");
    expect(request?.url.startsWith("https://web.whatsapp.com/send?phone=6281200001003&")).toBe(
      true,
    );
    expect(textOf(request!.url)).toBe(
      [
        "Assalamualaikum Pak Rizal.",
        "Mohon daftarkan akun saya di Nemu.",
        `Email akun: ${RIZAL}`,
        "Halaman: Beranda (http://localhost:3003/#/beranda)",
        "Terima kasih.",
      ].join("\n"),
    );
  });

  test("offers nothing without an operator in WS-06, or for any other reason Nemu can't help", () => {
    expect(
      operatorRequest({ status: "unregistered", message: "…", email: RIZAL, operator: null }, PAGE),
    ).toBeUndefined();
    expect(operatorRequest({ status: "signed_out", message: "…" }, PAGE)).toBeUndefined();
    expect(
      operatorRequest({ status: "registered", name: "Siti Aminah, S.Pd.", honorific: "Bu" }, PAGE),
    ).toBeUndefined();
  });

  test("names whichever operator WS-06 lists", () => {
    const request = operatorRequest(
      {
        status: "unregistered",
        message: "…",
        email: RIZAL,
        operator: { name: "Bu Wulan", phone: "6281200009999" },
      },
      PAGE,
    );
    expect(request?.detail).toBe("Yang bisa mendaftarkan: Bu Wulan, operator sekolah.");
    expect(textOf(request!.url)).toContain("Assalamualaikum Bu Wulan.");
  });

  test("names the page by its address alone when it has no heading", () => {
    const request = operatorRequest(
      {
        status: "unregistered",
        message: "…",
        email: RIZAL,
        operator: { name: "Pak Rizal", phone: "6281200001003" },
      },
      { name: "", url: "http://localhost:3003/#/nilai" },
    );
    expect(textOf(request!.url)).toContain("Halaman: http://localhost:3003/#/nilai\n");
  });
});
