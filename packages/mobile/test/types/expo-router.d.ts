import type { Screen } from "@testing-library/react-native";

declare global {
  namespace jest {
    interface Matchers<R> {
      toHavePathname(pathname: string): R;
      toHavePathnameWithParams(pathname: string): R;
    }
  }
}
