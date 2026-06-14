import { useRef } from "react";

/**
 * Stable React keys for a controlled list of rows where the data carries no id.
 *
 * Index keys would make React reassign TextInput state/focus to the wrong row
 * when a middle row is removed. Callers drive mutations through `addKey`/
 * `removeKey` (alongside their own onChange) so keys stay attached to rows.
 *
 * `addKey`/`removeKey` keep the internal list in sync before the parent
 * re-renders, so in that flow `length` already matches and no reconciliation
 * happens. The length check only fires when the list is replaced wholesale
 * (e.g. the parent loads a fresh array), regenerating keys for the new rows.
 */
export function useRowKeys(length: number) {
  const keysRef = useRef<number[]>([]);
  const nextRef = useRef(0);

  if (keysRef.current.length !== length) {
    keysRef.current = Array.from({ length }, () => nextRef.current++);
  }

  return {
    keys: keysRef.current,
    addKey: () => {
      keysRef.current.push(nextRef.current++);
    },
    removeKey: (index: number) => {
      keysRef.current.splice(index, 1);
    },
  };
}
