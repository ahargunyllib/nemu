// @vitest-environment happy-dom
import type { NemuResponse } from "@nemu/contracts";
import {
  momentOneFollowUpResponse,
  momentOneResponse,
  momentThreeFollowUpResponse,
  momentThreeResponse,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";
import {
  act,
  cleanup,
  fireEvent,
  getDefaultNormalizer,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { asSentence } from "../lib/sentence";
import { AnswerCard } from "./answer-card";
import { AnswerCardHeader } from "./answer-card-header";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderCard(
  response: NemuResponse,
  children?: React.ReactNode,
  slots: Pick<React.ComponentProps<typeof AnswerCard>, "kicker" | "fill"> = {},
) {
  const onClose = vi.fn();
  render(
    <AnswerCard
      response={response}
      header={<AnswerCardHeader onClose={onClose} />}
      reply={<p>Balas</p>}
      {...slots}
    >
      {children}
    </AnswerCard>,
  );
  return { onClose };
}

function openRincian() {
  fireEvent.click(screen.getByRole("button", { name: "Rincian" }));
}

/** Each button by its accessible name, in order. */
function buttonNames() {
  return screen
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent);
}

/** Momen 2 as an answer that only computes the amount, without a confirmed `fill`. */
const withoutFill: NemuResponse = {
  ...momentTwoResponse,
  actions: momentTwoResponse.actions.filter((action) => action.type !== "fill"),
};

const withDailyAllowance: NemuResponse = {
  ...momentTwoResponse,
  calc: [
    ...momentTwoResponse.calc,
    { fungsi: "uang_harian", input: { hari: 3, tarif: 580_000 }, hasil: 1_740_000 },
  ],
};

function stubClipboard(writeText: (text: string) => Promise<void>) {
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
}

describe("AnswerCard", () => {
  test.each([
    ["Momen 1", momentOneResponse],
    ["Momen 2", momentTwoResponse],
    ["Momen 3", momentThreeResponse],
    ["Momen 3 follow-up", momentThreeFollowUpResponse],
  ])("renders the %s fixture as plain text", (_name, response) => {
    renderCard(response);

    expect(screen.getByText(response.answer.ringkas)).toBeTruthy();
    for (const warning of response.warnings)
      expect(screen.getByText(asSentence(warning))).toBeTruthy();
    expect(screen.getByText("Balas")).toBeTruthy();
  });

  test("collapsed, shows only the answer, its warning and Rincian", () => {
    renderCard(momentThreeFollowUpResponse);

    expect(buttonNames()).toEqual(["Tutup", "Rincian"]);
    expect(screen.queryByRole("region", { name: "Sumber" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Perhitungan" })).toBeNull();
  });

  test("shows the guide's progress above the answer, beside the ×", () => {
    renderCard(momentOneFollowUpResponse, undefined, { kicker: <p>Langkah 2 dari 6</p> });

    const kicker = screen.getByText("Langkah 2 dari 6");
    const answer = screen.getByText(momentOneFollowUpResponse.answer.ringkas);
    expect(kicker.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("closes from the ×", () => {
    const { onClose } = renderCard(momentTwoResponse);

    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  test("shows the Momen 2 formula in Rincian", () => {
    renderCard(momentTwoResponse);

    expect(screen.queryByText("30% × Rp745.000 × 2 malam = Rp447.000")).toBeNull();
    openRincian();

    expect(screen.getByText("30% × Rp745.000 × 2 malam = Rp447.000")).toBeTruthy();
  });

  test("names what each formula computes when there are several", () => {
    renderCard(withDailyAllowance);
    openRincian();

    expect(
      screen.getByText("Lumpsum penginapan: 30% × Rp745.000 × 2 malam = Rp447.000"),
    ).toBeTruthy();
  });

  test("shows the Momen 3 Pertanggungjawaban deadline in Rincian", () => {
    renderCard(momentThreeFollowUpResponse);
    openRincian();

    expect(
      screen.getByText("5 hari kerja setelah 5 November 2026 = 12 November 2026"),
    ).toBeTruthy();
  });

  test("offers the Isi strip instead of Salin for an answer that fills the value", () => {
    renderCard(momentTwoResponse, undefined, { fill: <button type="button">Isi</button> });

    expect(buttonNames()).toEqual(["Tutup", "Isi", "Rincian"]);
  });

  test("never offers Salin for an answer that fills the value, even once it was filled", () => {
    renderCard(momentTwoResponse);

    expect(screen.queryByRole("button", { name: "Salin" })).toBeNull();
  });

  test("copies a computed amount the answer doesn't fill as the form field takes it", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    renderCard(withoutFill);

    expect(screen.getByText("Rp447.000")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salin" })));

    expect(writeText).toHaveBeenCalledWith("447000");
    expect(screen.getByRole("button", { name: "Tersalin" })).toBeTruthy();
  });

  test("keeps Salin when the page denies the clipboard", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")));
    renderCard(withoutFill);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salin" })));

    expect(screen.getByRole("button", { name: "Salin" })).toBeTruthy();
  });

  test("offers no value to copy without a computed amount", () => {
    renderCard(momentThreeFollowUpResponse);

    expect(screen.queryByRole("button", { name: "Salin" })).toBeNull();
  });

  test("shows what happened after the answer, such as the sent task's status", () => {
    renderCard(momentThreeFollowUpResponse, <p>ID tugas PJ-PD-2026-0042</p>);

    expect(screen.getByText("ID tugas PJ-PD-2026-0042")).toBeTruthy();
  });

  test("keeps the detail collapsed until asked", () => {
    renderCard(momentOneResponse);
    const detail = momentOneResponse.answer.detail;
    // The Momen 1 checklist keeps one document per line, written 1. 2. 3.
    const keepLines = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };

    expect(screen.queryByText(detail, keepLines)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Rincian" }));
    expect(screen.getByText(detail, keepLines)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tutup rincian" }));
    expect(screen.queryByText(detail, keepLines)).toBeNull();
  });

  test("lists the Momen 2 pasal and rate's source in the Sumber line in Rincian", () => {
    renderCard(momentTwoResponse);
    openRincian();

    expect(screen.getByRole("region", { name: "Sumber" }).textContent).toBe(
      "Sumber: PMK 119/2023 Pasal 8 ayat (5) · SBM TA 2026 - Sulawesi Selatan - Hotel Golongan III",
    );
  });

  test("keeps a section such as an SOP's Butir by its own name", () => {
    renderCard(momentOneFollowUpResponse);
    openRincian();

    expect(screen.getByRole("region", { name: "Sumber" }).textContent).toBe(
      "Sumber: SOP-PD-01 Perjalanan Dinas Butir 4.1, 4.2",
    );
  });

  test("names each source in the Sumber line once", () => {
    const sbm = "SBM TA 2026 - Sulawesi Selatan - Hotel Golongan III";
    renderCard({
      ...momentTwoResponse,
      calc: [
        ...momentTwoResponse.calc,
        { fungsi: "lookup_sbm", input: {}, hasil: 745_000, sumber: sbm },
        { fungsi: "lookup_sbm", input: {}, hasil: null, sumber: "PMK 119/2023" },
      ],
    });
    openRincian();
    const sumber = screen.getByRole("region", { name: "Sumber" }).textContent ?? "";

    expect(sumber.match(/PMK 119\/2023/g)).toHaveLength(1);
    expect(sumber.split(sbm)).toHaveLength(2);
  });

  test("shows a refusal as plain text", () => {
    renderCard({
      status: "refuse",
      answer: { ringkas: "Saya hanya membantu Perjalanan Dinas." },
      citations: [],
      calc: [],
      actions: [],
      warnings: [],
    });

    expect(screen.getByText("Saya hanya membantu Perjalanan Dinas.")).toBeTruthy();
    expect(buttonNames()).toEqual(["Tutup"]);
  });
});
