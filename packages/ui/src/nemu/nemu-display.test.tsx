// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { spokenText } from "../lib/nemu-display";
import { GelembungJawab } from "./gelembung-jawab";
import { GelembungKerja } from "./gelembung-kerja";
import { GelembungTunjuk } from "./gelembung-tunjuk";
import { KartuInfo } from "./kartu-info";
import { KartuPilih } from "./kartu-pilih";

afterEach(cleanup);

describe("Gelembung Kerja", () => {
  const kerja = {
    type: "kerja" as const,
    sentence: "Nemu mengisi nilai Aisyah Putri Wijaya: 85.",
    status: { tone: "working" as const, text: "Nemu mengisi", progress: { done: 13, total: 32 } },
    onSlow: vi.fn(),
    onStop: vi.fn(),
  };

  test("shows its progress in the header, which Nemu doesn't say", () => {
    render(<GelembungKerja {...kerja} />);
    const bubble = screen.getByRole("region", { name: "Nemu bekerja" });
    expect(within(bubble).getByText("Nemu mengisi · 13 dari 32")).toBeTruthy();
    expect(within(bubble).getByRole("progressbar")).toBeTruthy();
    expect(spokenText(kerja)).toBe("Nemu mengisi nilai Aisyah Putri Wijaya: 85.");
  });

  test("always offers Pelan and Berhenti", () => {
    render(<GelembungKerja {...kerja} />);
    fireEvent.click(screen.getByRole("button", { name: "Pelan" }));
    fireEvent.click(screen.getByRole("button", { name: "Berhenti" }));
    expect(kerja.onSlow).toHaveBeenCalledOnce();
    expect(kerja.onStop).toHaveBeenCalledOnce();
  });

  test("marks the word Nemu's voice is on", () => {
    render(<GelembungKerja {...kerja} highlightedWord={3} />);
    const spoken = screen.getByRole("region").querySelector("[data-nemu-spoken]");
    expect(spoken?.textContent).toBe("Aisyah");
  });
});

describe("Gelembung Tunjuk", () => {
  test("has no buttons besides its one link", () => {
    render(
      <GelembungTunjuk
        sentence="Tekan Tampilkan Siswa."
        note={{ kenapa: "Daftar murid muncul setelah tombol ini ditekan." }}
      />,
    );
    const bubble = screen.getByRole("region", { name: "Petunjuk Nemu" });
    expect(
      within(bubble)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Kenapa?"]);
  });
});

describe("Gelembung Jawab", () => {
  test("reads Kenapa? and Sumber only once they are clicked", () => {
    const onRead = vi.fn();
    render(
      <GelembungJawab
        sentence="KKM semua mata pelajaran adalah 75."
        notes={{
          kenapa: "Sekolah menetapkan satu KKM untuk semua mapel.",
          sumber: ["SOP Penilaian SDIT Nusantara · hlm. 2"],
        }}
        onRead={onRead}
      />,
    );
    expect(screen.queryByText("Sekolah menetapkan satu KKM untuk semua mapel.")).toBeNull();
    expect(screen.queryByText("SOP Penilaian SDIT Nusantara · hlm. 2")).toBeNull();
    expect(onRead).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Kenapa?" }));
    expect(screen.getByText("Sekolah menetapkan satu KKM untuk semua mapel.")).toBeTruthy();
    expect(onRead).toHaveBeenLastCalledWith("Sekolah menetapkan satu KKM untuk semua mapel.");

    fireEvent.click(screen.getByRole("button", { name: "Sumber" }));
    expect(screen.getByText("SOP Penilaian SDIT Nusantara · hlm. 2")).toBeTruthy();
    expect(onRead).toHaveBeenLastCalledWith("Sumber: SOP Penilaian SDIT Nusantara · hlm. 2");
  });

  test("says its sentence again when the sentence is clicked", () => {
    const onRepeat = vi.fn();
    render(
      <GelembungJawab
        sentence="KKM semua mata pelajaran adalah 75."
        highlightedWord={1}
        onRepeat={onRepeat}
      />,
    );
    const sentence = screen.getByRole("button", { name: "KKM semua mata pelajaran adalah 75." });
    expect(sentence.querySelector("[data-nemu-spoken]")?.textContent).toBe("semua");
    fireEvent.click(sentence);
    expect(onRepeat).toHaveBeenCalledOnce();
  });

  test("runs its one action", () => {
    const onSelect = vi.fn();
    render(
      <GelembungJawab
        sentence="Nilai belum tersimpan."
        action={{ label: "Buka Rekap Nilai", onSelect }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buka Rekap Nilai" }));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe("Kartu Pilih", () => {
  const choices = [
    { id: "simpan", label: "Tetap simpan", risky: true },
    { id: "periksa", label: "Periksa dulu" },
  ] as const;

  test("puts the safe choice on top and marks the risky one with ⚠", () => {
    render(
      <KartuPilih question="Nilai Bagas 58. Tetap simpan?" choices={choices} onChoose={vi.fn()} />,
    );
    const buttons = within(screen.getByRole("group")).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Periksa dulu",
      "Berisiko: Tetap simpan",
    ]);
    expect(buttons[1]?.querySelector("svg")).toBeTruthy();
    expect(buttons[0]?.querySelector("svg")).toBeNull();
  });

  test("pre-selects nothing: no choice is focused or pressed until the teacher picks", () => {
    const onChoose = vi.fn();
    render(<KartuPilih question="Lanjut?" choices={choices} onChoose={onChoose} />);
    const buttons = within(screen.getByRole("group")).getAllByRole("button");
    for (const button of buttons) {
      expect(document.activeElement).not.toBe(button);
      expect(button.getAttribute("aria-pressed")).toBeNull();
    }
    expect(new Set(buttons.map((button) => button.className)).size).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Periksa dulu" }));
    expect(onChoose).toHaveBeenCalledWith("periksa");
  });
});

describe("Kartu Info", () => {
  test("shows a title, a short list and one Tutup", () => {
    const onClose = vi.fn();
    render(
      <KartuInfo
        title="Catatan langkah"
        items={["32 nilai diisi", "Disimpan pukul 09.12"]}
        onClose={onClose}
      />,
    );
    const card = screen.getByRole("region", { name: "Catatan langkah" });
    expect(within(card).getAllByRole("listitem")).toHaveLength(2);
    expect(within(card).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(within(card).getByRole("button", { name: "Tutup" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
