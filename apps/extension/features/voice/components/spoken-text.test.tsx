// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { SpokenText } from "./spoken-text";

afterEach(cleanup);

const text = "KKM seluruh mata pelajaran adalah 75. Nilai di bawahnya ikut remedial.";

describe("SpokenText", () => {
  test("highlights the word being spoken and keeps the rest of the bubble", () => {
    render(
      <SpokenText
        text={text}
        voice={{
          sentence: "KKM seluruh mata pelajaran adalah 75.",
          words: ["KKM", "seluruh", "mata", "pelajaran", "adalah", "75."],
          activeIndex: 3,
          status: "speaking",
        }}
        onRepeat={() => {}}
      />,
    );
    const button = screen.getByRole("button");
    expect(button.textContent).toBe(text);
    expect(button.querySelector("[aria-current='true']")?.textContent).toBe("pelajaran");
  });

  test("a click on the text asks Nemu to say it again", () => {
    const onRepeat = vi.fn();
    render(<SpokenText text={text} voice={null} onRepeat={onRepeat} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onRepeat).toHaveBeenCalledOnce();
    expect(screen.getByRole("button").querySelector("[aria-current]")).toBeNull();
  });
});
