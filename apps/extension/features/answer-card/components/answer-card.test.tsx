// @vitest-environment happy-dom
import type { NemuResponse } from "@nemu/contracts";
import {
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

function renderCard(response: NemuResponse, children?: React.ReactNode) {
  const onClose = vi.fn();
  render(
    <AnswerCard
      response={response}
      header={<AnswerCardHeader onClose={onClose} />}
      reply={<p>Balas</p>}
    >
      {children}
    </AnswerCard>,
  );
  return { onClose };
}

/** Each button by its accessible name, in order. */
function buttonNames() {
  return screen
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent);
}

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
    for (const citation of response.citations) {
      expect(screen.getByRole("button", { name: citation.judul })).toBeTruthy();
    }
    expect(screen.getByText("Balas")).toBeTruthy();
  });

  test("has no button but ×, Rincian, the sources and Salin", () => {
    renderCard(momentTwoResponse);

    expect(buttonNames()).toEqual(["Tutup", "Salin", "Rincian", "PMK 119/2023"]);
  });

  test("closes from the ×", () => {
    const { onClose } = renderCard(momentTwoResponse);

    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  test("says the Momen 2 calculation as a sentence", () => {
    renderCard(momentTwoResponse);

    expect(
      screen.getByText("Lumpsum penginapan: 30% × Rp745.000 × 2 malam = Rp447.000."),
    ).toBeTruthy();
  });

  test("says the Momen 3 Pertanggungjawaban deadline as a sentence", () => {
    renderCard(momentThreeFollowUpResponse);

    expect(
      screen.getByText(
        "Batas Pertanggungjawaban: 5 hari kerja setelah 5 November 2026 = 12 November 2026.",
      ),
    ).toBeTruthy();
  });

  test("copies the Momen 2 lodging value as the form field takes it", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    renderCard(momentTwoResponse);

    expect(screen.getByText("Rp447.000")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salin" })));

    expect(writeText).toHaveBeenCalledWith("447000");
    expect(screen.getByRole("button", { name: "Tersalin" })).toBeTruthy();
  });

  test("keeps Salin when the page denies the clipboard", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")));
    renderCard(momentTwoResponse);

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

  test("keeps the detail and the rate's source collapsed until asked", () => {
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

  test("names the rate's source in the detail", () => {
    renderCard(momentTwoResponse);

    fireEvent.click(screen.getByRole("button", { name: "Rincian" }));

    expect(
      screen.getByText("Tarif: SBM TA 2026 - Sulawesi Selatan - Hotel Golongan III"),
    ).toBeTruthy();
  });

  test("opens a citation's full reference when clicked", () => {
    renderCard(momentTwoResponse);

    expect(screen.getByText(/^Sumber:/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "PMK 119/2023" }));

    expect(screen.getByText(/PMK 119\/2023, Pasal 8 ayat \(5\), hlm\. 6/)).toBeTruthy();
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
