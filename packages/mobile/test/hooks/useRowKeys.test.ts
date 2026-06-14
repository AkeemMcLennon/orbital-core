import { act, renderHook } from "@testing-library/react-native";
import { useRowKeys } from "../../src/hooks/useRowKeys";

describe("useRowKeys", () => {
  it("produces one unique key per row", () => {
    const { result } = renderHook(({ length }) => useRowKeys(length), {
      initialProps: { length: 3 },
    });
    expect(result.current.keys).toHaveLength(3);
    expect(new Set(result.current.keys).size).toBe(3);
  });

  it("keeps surrounding keys stable when a middle row is removed", () => {
    const { result, rerender } = renderHook(
      ({ length }) => useRowKeys(length),
      {
        initialProps: { length: 3 },
      },
    );
    const [k0, , k2] = result.current.keys;

    act(() => result.current.removeKey(1));
    rerender({ length: 2 });

    expect(result.current.keys).toEqual([k0, k2]);
  });

  it("appends a new unique key when a row is added", () => {
    const { result, rerender } = renderHook(
      ({ length }) => useRowKeys(length),
      {
        initialProps: { length: 2 },
      },
    );
    const original = [...result.current.keys];

    act(() => result.current.addKey());
    rerender({ length: 3 });

    expect(result.current.keys.slice(0, 2)).toEqual(original);
    expect(new Set(result.current.keys).size).toBe(3);
  });

  it("regenerates keys when the list is replaced wholesale", () => {
    const { result, rerender } = renderHook(
      ({ length }) => useRowKeys(length),
      {
        initialProps: { length: 2 },
      },
    );

    // length changes without add/remove — e.g. the parent loads a fresh array
    rerender({ length: 4 });

    expect(result.current.keys).toHaveLength(4);
    expect(new Set(result.current.keys).size).toBe(4);
  });
});
