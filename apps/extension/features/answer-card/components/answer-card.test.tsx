// @vitest-environment happy-dom
import type { NemuResponse } from "@nemu/contracts";
import {
  momentOneResponse,
  momentThreeFollowUpResponse,
  momentThreeResponse,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";
import { cleanup, fireEvent, getDefaultNormalizer, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { AnswerCard } from "./answer-card";

afterEach(cleanup);

function renderCard(response: NemuResponse, onReply = vi.fn(), children?: React.ReactNode) {
  render(
    <AnswerCard response={response} header={null} onReply={onReply}>
      {children}
    </AnswerCard>,
  );
  return { onReply };
}

describe("AnswerCard", () => {
  test.each([
    ["Momen 1", momentOneResponse],
    ["Momen 2", momentTwoResponse],
    ["Momen 3", momentThreeResponse],
    ["Momen 3 follow-up", momentThreeFollowUpResponse],
  ])("renders the %s fixture", (_name, response) => {
    renderCard(response);

    expect(screen.getByText(response.answer.ringkas)).toBeTruthy();
    for (const warning of response.warnings) expect(screen.getByText(warning)).toBeTruthy();
    for (const citation of response.citations) {
      expect(screen.getByRole("button", { name: citation.judul })).toBeTruthy();
    }
    expect(screen.queryAllByRole("button", { name: "Jawab" })).toHaveLength(0);
  });

  test("shows the Momen 2 calculation breakdown", () => {
    renderCard(momentTwoResponse);

    expect(screen.getByText(/30% × Rp745\.000 × 2 malam =/)).toBeTruthy();
    expect(screen.getByText("Rp447.000")).toBeTruthy();
  });

  test("shows the Momen 3 Pertanggungjawaban deadline as a chip", () => {
    renderCard(momentThreeFollowUpResponse);

    expect(screen.getByText("Batas 12 November 2026")).toBeTruthy();
  });

  test("shows no deadline chip without a batas_pertanggungjawaban entry", () => {
    renderCard(momentTwoResponse);

    expect(screen.queryByText(/^Batas /)).toBeNull();
  });

  test("shows what happened after the answer, such as the sent task's status", () => {
    renderCard(momentThreeFollowUpResponse, vi.fn(), <p>ID tugas PJ-PD-2026-0042</p>);

    expect(screen.getByText("ID tugas PJ-PD-2026-0042")).toBeTruthy();
  });

  test("keeps the detail collapsed until asked", () => {
    renderCard(momentOneResponse);
    const detail = momentOneResponse.answer.detail;
    // The Momen 1 checklist keeps one document per line.
    const keepLines = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };

    expect(screen.queryByText(detail, keepLines)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lihat detail" }));
    expect(screen.getByText(detail, keepLines)).toBeTruthy();
  });

  test("opens a citation's full reference when clicked", () => {
    renderCard(momentTwoResponse);

    fireEvent.click(screen.getByRole("button", { name: "PMK 119/2023" }));

    expect(screen.getByText(/PMK 119\/2023, Pasal 8 ayat \(5\), hlm\. 6/)).toBeTruthy();
  });

  test("lets the user answer a clarify question", () => {
    const { onReply } = renderCard({
      ...momentOneResponse,
      status: "clarify",
      answer: { ringkas: "Golonganmu apa?" },
      actions: [],
    });

    expect(screen.getByText("Nemu butuh info tambahan")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Jawab" }));
    expect(onReply).toHaveBeenCalledOnce();
  });

  test("marks a refusal as out of scope", () => {
    renderCard({
      status: "refuse",
      answer: { ringkas: "Saya hanya membantu Perjalanan Dinas." },
      citations: [],
      calc: [],
      actions: [],
      warnings: [],
    });

    expect(screen.getByText("Di luar cakupan Nemu")).toBeTruthy();
    expect(screen.getByText("Saya hanya membantu Perjalanan Dinas.")).toBeTruthy();
  });
});
