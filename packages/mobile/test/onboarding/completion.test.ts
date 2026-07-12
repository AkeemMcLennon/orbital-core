import {
  readOnboardingCompleted,
  markOnboardingCompleted,
  onboardingCompletedCached,
  __resetOnboardingCache,
} from "../../src/onboarding/completion";
import { __resetStorage } from "../mocks/storage";

// The `*/utils/storage` module is mapped to the in-memory mock (jest.config.js),
// so completion.ts and this test share the same store.

beforeEach(() => {
  __resetStorage();
  __resetOnboardingCache();
});

describe("onboarding completion", () => {
  it("reads false when the flag is unset", async () => {
    expect(await readOnboardingCompleted()).toBe(false);
  });

  it("reads true once marked", async () => {
    await markOnboardingCompleted();
    expect(await readOnboardingCompleted()).toBe(true);
  });

  it("exposes the cached value synchronously after a read", async () => {
    expect(onboardingCompletedCached()).toBeNull();
    await readOnboardingCompleted();
    expect(onboardingCompletedCached()).toBe(false);
  });

  it("stays completed in-session even if storage is cleared (no re-prompt)", async () => {
    await markOnboardingCompleted();
    __resetStorage(); // persistence lost, but the session cache remains
    expect(onboardingCompletedCached()).toBe(true);
    expect(await readOnboardingCompleted()).toBe(true);
  });
});
