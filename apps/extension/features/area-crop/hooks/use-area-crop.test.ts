// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { useAreaCrop } from "./use-area-crop";

afterEach(cleanup);

const lodgingField = { left: 40, top: 300, width: 520, height: 140 };
const CROP = "data:image/png;base64,AREA";

describe("useAreaCrop", () => {
  test("attaches the crop of exactly the selected box", async () => {
    const capture = vi.fn(async () => CROP);
    const { result } = renderHook(() => useAreaCrop(capture));

    act(() => result.current.start());
    expect(result.current.state.kind).toBe("selecting");

    act(() => result.current.select(lodgingField));
    expect(result.current.state.kind).toBe("capturing");

    await waitFor(() => expect(result.current.crop).toBe(CROP));
    expect(capture).toHaveBeenCalledExactlyOnceWith(lodgingField);
  });

  test("reports a failed capture instead of attaching nothing silently", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useAreaCrop(async () => {
        throw new Error("no permission");
      }),
    );

    act(() => result.current.select(lodgingField));

    await waitFor(() => expect(result.current.state.kind).toBe("failed"));
    expect(result.current.crop).toBeUndefined();
  });

  test("removing the chip detaches the crop", async () => {
    const { result } = renderHook(() => useAreaCrop(async () => CROP));
    act(() => result.current.select(lodgingField));
    await waitFor(() => expect(result.current.crop).toBe(CROP));

    act(() => result.current.clear());

    expect(result.current.state.kind).toBe("none");
    expect(result.current.crop).toBeUndefined();
  });
});
