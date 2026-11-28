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

  test("shows its progress in the heading, which Nemu doesn't say", () => {
    render(<GelembungKerja {...kerja} />);
    const bubble = screen.getByRole("region", { name: "Nemu bekerja" });
    expect(within(bubble).getByText("Nemu mengisi")).toBeTruthy();
    expect(within(bubble).getByText("13 dari 32")).toBeTruthy();
    expect(within(bubble).getByRole("progressbar").getAttribute("aria-label")).toBe(
      "Nemu mengisi · 13 dari 32",
    );
    expect(spokenText(kerja)).toBe("Nemu mengisi nilai Aisyah Putri Wijaya: 85.");
  });

  test("offers Pelan then Berhenti in one row, words only", () => {
    render(<GelembungKerja {...kerja} />);
    const row = screen.getByRole("region").querySelector("[data-nemu-actions]");
    const buttons = within(row as HTMLElement).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Pelan", "Berhenti"]);
    for (const button of buttons) expect(button.querySelector("svg")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pelan" }));
    fireEvent.click(screen.getByRole("button", { name: "Berhenti" }));
    expect(kerja.onSlow).toHaveBeenCalledOnce();
    expect(kerja.onStop).toHaveBeenCalledOnce();
  });

  test("has only Berhenti when Nemu can't slow down", () => {
    const { onSlow: _, ...withoutSlow } = kerja;
    render(<GelembungKerja {...withoutSlow} />);
    expect(
      within(screen.getByRole("region"))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Berhenti"]);
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

  test("shows a chip under its text and a cancel link at the bottom, still no buttons", () => {
    const onSelect = vi.fn();
    render(
      <GelembungTunjuk
        status={{ text: "Giliran Ibu" }}
        sentence="Tombol Hapus ada di sini, Bu."
        detail="Nemu tidak menghapus apa pun."
        chip="Belum tersimpan"
        cancel={{ label: "Batal, jangan hapus", onSelect }}
      />,
    );
    const bubble = screen.getByRole("region", { name: "Petunjuk Nemu" });
    const chip = within(bubble).getByText("Belum tersimpan");
    expect(follows(within(bubble).getByText("Nemu tidak menghapus apa pun."), chip)).toBe(true);
    const cancel = within(bubble).getByRole("button", { name: "Batal, jangan hapus" });
    expect(follows(chip, cancel)).toBe(true);
    expect(within(bubble).getAllByRole("button")).toEqual([cancel]);
    fireEvent.click(cancel);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  test("puts a link to a card of its own under the chip, such as Lihat ringkasan (F1·11)", () => {
    const onSelect = vi.fn();
    render(
      <GelembungTunjuk
        status={{ text: "Giliran Ibu" }}
        sentence="Silakan Ibu tekan Simpan."
        chip="Belum tersimpan"
        link={{ label: "Lihat ringkasan", onSelect }}
      />,
    );
    const bubble = screen.getByRole("region", { name: "Petunjuk Nemu" });
    const link = within(bubble).getByRole("button", { name: "Lihat ringkasan" });
    expect(follows(within(bubble).getByText("Belum tersimpan"), link)).toBe(true);
    expect(within(bubble).getAllByRole("button")).toEqual([link]);
    fireEvent.click(link);
    expect(onSelect).toHaveBeenCalledOnce();
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

  test("opens a source that has its document, and reads its name with the others", () => {
    const onRead = vi.fn();
    const onOpen = vi.fn();
    render(
      <GelembungJawab
        sentence="KKM semua mata pelajaran adalah 75."
        notes={{
          sumber: [
            { label: "SOP Penilaian SDIT Nusantara · hlm. 2 · 3.2", onOpen },
            "Rekaman Pak Rizal, langkah 4 dari 4",
          ],
        }}
        onRead={onRead}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sumber" }));
    expect(onRead).toHaveBeenLastCalledWith(
      "Sumber: SOP Penilaian SDIT Nusantara · hlm. 2 · 3.2; Rekaman Pak Rizal, langkah 4 dari 4",
    );
    expect(
      screen.queryByRole("button", { name: "Rekaman Pak Rizal, langkah 4 dari 4" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "SOP Penilaian SDIT Nusantara · hlm. 2 · 3.2" }),
    );
    expect(onOpen).toHaveBeenCalledOnce();
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

  test("puts its links on the left and its action on the right of one row", () => {
    render(
      <GelembungJawab
        sentence="Bukan kesalahan Ibu."
        notes={{ kenapa: "Nilai masuk lewat alur SPP.", sumber: ["Alur SPP sekolah"] }}
        action={{ label: "Siapkan balasan", onSelect: vi.fn() }}
        onClose={vi.fn()}
      />,
    );
    const row = screen.getByRole("region").querySelector("[data-nemu-actions]");
    expect(
      within(row as HTMLElement)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Kenapa?", "Sumber", "Siapkan balasan"]);
    // What Kenapa? opens shows under the whole row, not inside it.
    fireEvent.click(screen.getByRole("button", { name: "Kenapa?" }));
    expect(row?.contains(screen.getByText("Nilai masuk lewat alur SPP."))).toBe(false);
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

describe("Kartu Pilih for W5 and the inbox", () => {
  test("shows the photo crop and a quiet note; still nothing pre-selected", () => {
    render(
      <KartuPilih
        question="Nilai Alya: 86 atau 88?"
        choices={[
          { id: "86", label: "86" },
          { id: "88", label: "88" },
          { id: "lain", label: "Angka lain" },
        ]}
        onChoose={vi.fn()}
        image={{ src: "data:image/jpeg;base64,AA", alt: "Foto buku nilai, baris 3" }}
        note="Pertanyaan 1 dari 10."
      />,
    );
    expect(screen.getByRole("img", { name: "Foto buku nilai, baris 3" })).toBeTruthy();
    expect(screen.getByText("Pertanyaan 1 dari 10.")).toBeTruthy();
    const buttons = within(screen.getByRole("group")).getAllByRole("button");
    expect(buttons).toHaveLength(3);
    for (const button of buttons) expect(document.activeElement).not.toBe(button);
  });

  test("the compact card puts its two choices side by side", () => {
    const onChoose = vi.fn();
    render(
      <KartuPilih
        compact
        question="Foto dari WhatsApp"
        choices={[
          { id: "mulai", label: "Mulai" },
          { id: "nanti", label: "Nanti" },
        ]}
        onChoose={onChoose}
      />,
    );
    expect(screen.getByRole("group").className).not.toMatch(/flex-col/u);
    fireEvent.click(screen.getByRole("button", { name: "Mulai" }));
    expect(onChoose).toHaveBeenCalledWith("mulai");
  });

  test("the compact photo card shows the thumbnail beside its title, a skeleton while it loads (#278)", () => {
    const card = (src?: string) => (
      <KartuPilih
        compact
        question="Foto dari WhatsApp"
        choices={[
          { id: "mulai", label: "Mulai" },
          { id: "nanti", label: "Nanti" },
        ]}
        onChoose={vi.fn()}
        image={{ src, alt: "Foto buku nilai dari WhatsApp" }}
      />
    );
    const { container, rerender } = render(card());
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("[data-slot=card-header] [data-slot=skeleton]")).toBeTruthy();

    rerender(card("data:image/jpeg;base64,AA"));
    const thumbnail = screen.getByRole("img", { name: "Foto buku nilai dari WhatsApp" });
    expect(thumbnail.closest("[data-slot=card-header]")).toBeTruthy();
    expect(container.querySelector("[data-slot=skeleton]")).toBeNull();
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

  test("numbers its items 1, 2, 3 under their label", () => {
    render(
      <KartuInfo
        status={{ tone: "muted", text: "Mikrofon terblokir" }}
        title="Nemu belum bisa mendengar Ibu."
        itemsLabel="Buka lagi dengan 3 langkah ini"
        items={[
          "Klik ikon gembok di kiri alamat situs",
          "Pada Mikrofon, pilih Izinkan",
          "Klik Muat ulang di bagian atas",
        ]}
        onClose={vi.fn()}
      />,
    );
    const list = screen.getByRole("list", { name: "Buka lagi dengan 3 langkah ini" });
    expect(list.tagName).toBe("OL");
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector("[data-nemu-step]")?.textContent)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(items[1]?.textContent).toBe("2Pada Mikrofon, pilih Izinkan");
  });

  test("puts its one link and Tutup in one row, the link first", () => {
    render(
      <KartuInfo
        title="Catatan langkah"
        items={["32 nilai diisi"]}
        link={{ label: "Coba sendiri", onSelect: vi.fn() }}
        onClose={vi.fn()}
      />,
    );
    const row = screen.getByRole("region").querySelector("[data-nemu-actions]");
    expect(
      within(row as HTMLElement)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Coba sendiri", "Tutup"]);
  });

  test("names its button Kembali when it goes back to a bubble (F1·11a)", () => {
    const onClose = vi.fn();
    render(
      <KartuInfo
        status={{ text: "Ringkasan" }}
        title="31 dari 32 terisi, belum tersimpan."
        itemsLabel="Ringkasan · Matematika 4B, UTS"
        items={["Terisi: 31 murid"]}
        onClose={onClose}
        closeLabel="Kembali"
      />,
    );
    const card = screen.getByRole("region", { name: "31 dari 32 terisi, belum tersimpan." });
    expect(
      within(card)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Kembali"]);
    fireEvent.click(within(card).getByRole("button", { name: "Kembali" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("The heading", () => {
  test("labels Kartu Pilih and Kartu Info too, with a count and no progress bar", () => {
    render(
      <>
        <KartuPilih
          status={{ tone: "muted", text: "Nemu berhenti", count: "3 dari 32" }}
          question="Ibu mau isi sendiri?"
          choices={[
            { id: "ya", label: "Ya, saya isi sendiri" },
            { id: "lanjut", label: "Nemu saja yang lanjut" },
          ]}
          onChoose={vi.fn()}
        />
        <KartuInfo
          status={{ tone: "muted", text: "Mikrofon terblokir" }}
          title="Nemu belum bisa mendengar Ibu."
          items={["Klik ikon gembok di kiri alamat situs"]}
          onClose={vi.fn()}
        />
      </>,
    );
    const pilih = screen.getByRole("region", { name: "Pilihan Nemu" });
    expect(within(pilih).getByText("Nemu berhenti")).toBeTruthy();
    expect(within(pilih).getByText("3 dari 32")).toBeTruthy();
    expect(within(pilih).queryByRole("progressbar")).toBeNull();
    const info = screen.getByRole("region", { name: "Nemu belum bisa mendengar Ibu." });
    expect(within(info).getByText("Mikrofon terblokir")).toBeTruthy();
    // The heading comes first, above the title.
    expect(
      follows(within(info).getByText("Mikrofon terblokir"), within(info).getByText(/belum bisa/u)),
    ).toBe(true);
  });

  test("takes its tone from the situation; the older tones keep their meaning", () => {
    const tones = [
      [undefined, "nemu"],
      ["working", "nemu"],
      ["unsaved", "nemu"],
      ["saved", "success"],
      ["danger", "danger"],
      ["warning", "warning"],
    ] as const;
    for (const [tone, drawn] of tones) {
      const { container, unmount } = render(
        <GelembungTunjuk status={{ tone, text: "Giliran Ibu" }} sentence="Tekan Simpan." />,
      );
      expect(container.querySelector("[data-nemu-status]")?.getAttribute("data-nemu-status")).toBe(
        drawn,
      );
      unmount();
    }
  });

  test("a warning or success heading changes the mascot too, so colour isn't the only signal", () => {
    const { container, rerender } = render(
      <GelembungJawab
        status={{ tone: "warning", text: "Hati-hati" }}
        sentence="Kuis ini dipakai."
      />,
    );
    expect(container.querySelector("[data-nemu-mascot]")?.getAttribute("data-nemu-mascot")).toBe(
      "warning",
    );
    rerender(
      <GelembungJawab status={{ tone: "success", text: "Sudah dicek" }} sentence="Tersimpan." />,
    );
    expect(container.querySelector("[data-nemu-mascot]")?.getAttribute("data-nemu-mascot")).toBe(
      "success",
    );
  });

  test("is never said", () => {
    expect(
      spokenText({
        type: "info",
        status: { text: "Hasil pemeriksaan" },
        title: "Ada 2 hal yang perlu Ibu perbaiki.",
        items: [],
        onClose: vi.fn(),
      }),
    ).toBe("Ada 2 hal yang perlu Ibu perbaiki.");
  });
});

/** True when `later` comes after `earlier` in the document. */
function follows(earlier: Node, later: Node) {
  return Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("The detail line", () => {
  test("sits under a bubble's sentence and is never said", () => {
    const tunjuk = {
      type: "tunjuk" as const,
      sentence: "Tombol Hapus ada di sini, Bu.",
      detail: "Nemu tidak menghapus apa pun.",
    };
    render(<GelembungTunjuk {...tunjuk} />);
    expect(
      follows(
        screen.getByText("Tombol Hapus ada di sini, Bu."),
        screen.getByText("Nemu tidak menghapus apa pun."),
      ),
    ).toBe(true);
    expect(spokenText(tunjuk)).toBe("Tombol Hapus ada di sini, Bu.");
  });

  test("on Gelembung Kerja and Gelembung Jawab too, outside the sentence Nemu repeats", () => {
    render(
      <>
        <GelembungKerja
          sentence="Alya Nur Fitri, 90."
          detail="Klik atau ketik kalau Ibu mau isi sendiri."
          status={{ tone: "working", text: "Nemu mengisi" }}
          onSlow={vi.fn()}
          onStop={vi.fn()}
        />
        <GelembungJawab
          sentence="Bukan kesalahan Ibu."
          detail="Nilai UTS Aisyah sudah tersimpan."
          onRepeat={vi.fn()}
        />
      </>,
    );
    const kerja = screen.getByRole("region", { name: "Nemu bekerja" });
    expect(within(kerja).getByText("Klik atau ketik kalau Ibu mau isi sendiri.")).toBeTruthy();
    const jawab = screen.getByRole("region", { name: "Jawaban Nemu" });
    expect(within(jawab).getByText("Nilai UTS Aisyah sudah tersimpan.")).toBeTruthy();
    expect(within(jawab).getByRole("button", { name: "Bukan kesalahan Ibu." })).toBeTruthy();
  });

  test("on Kartu Pilih, between the question and the choices; only the question is said", () => {
    const pilih = {
      type: "pilih" as const,
      question: "Ibu mau isi sendiri?",
      detail: "Pilih salah satu, Nemu menunggu.",
      choices: [
        { id: "ya", label: "Ya, saya isi sendiri" },
        { id: "lanjut", label: "Nemu saja yang lanjut" },
      ] as const,
      onChoose: vi.fn(),
    };
    render(<KartuPilih {...pilih} />);
    const detail = screen.getByText("Pilih salah satu, Nemu menunggu.");
    expect(follows(screen.getByText("Ibu mau isi sendiri?"), detail)).toBe(true);
    expect(follows(detail, screen.getByRole("group"))).toBe(true);
    expect(spokenText(pilih)).toBe("Ibu mau isi sendiri?");
  });

  test("on Kartu Info, under the title; only the title is said", () => {
    const info = {
      type: "info" as const,
      title: "Ada 2 hal yang perlu Ibu perbaiki.",
      detail: "Yang lain sudah benar: 15 soal, kelas 4A.",
      items: ["Soal 15: gambar (3) belum ada.", "Soal 7: belum ada kunci jawaban."],
      onClose: vi.fn(),
    };
    render(<KartuInfo {...info} />);
    const card = screen.getByRole("region", { name: "Ada 2 hal yang perlu Ibu perbaiki." });
    const detail = within(card).getByText("Yang lain sudah benar: 15 soal, kelas 4A.");
    expect(follows(detail, within(card).getByRole("list"))).toBe(true);
    expect(spokenText(info)).toBe("Ada 2 hal yang perlu Ibu perbaiki.");
  });
});
