import { Alert } from "react-native";
import { ApiError } from "@orbital/client";
import {
  mutationErrorToast,
  notifyError,
  notifySuccess,
} from "../../src/utils/notify";
import { setToastHandler } from "../../src/utils/toast-ref";

describe("notify", () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setToastHandler(null);
    jest.restoreAllMocks();
  });

  describe("with a toast provider mounted", () => {
    it("routes errors to the toast, not an alert", () => {
      const shown: unknown[] = [];
      setToastHandler((payload) => shown.push(payload));

      notifyError(new ApiError(500, "boom"));

      expect(shown).toEqual([
        {
          title: "Something went wrong",
          message: "Our server had a problem. Try again in a moment.",
          kind: "error",
        },
      ]);
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it("routes successes to the toast", () => {
      const shown: unknown[] = [];
      setToastHandler((payload) => shown.push(payload));

      notifySuccess("Settings saved");

      expect(shown).toEqual([
        { title: "Done", message: "Settings saved", kind: "success" },
      ]);
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it("honours explicit title/message overrides", () => {
      const shown: any[] = [];
      setToastHandler((payload) => shown.push(payload));

      notifyError(new ApiError(500, "boom"), {
        title: "Update Failed",
        message: "Could not save your preference.",
      });

      expect(shown[0]).toMatchObject({
        title: "Update Failed",
        message: "Could not save your preference.",
      });
    });
  });

  describe("with no toast provider mounted", () => {
    it("falls back to Alert.alert so the error is never swallowed", () => {
      notifyError(new ApiError(404, "missing"), { noun: "contact" });

      expect(alertSpy).toHaveBeenCalledWith(
        "Not found",
        "This contact no longer exists.",
      );
    });

    it("falls back to Alert.alert for successes too", () => {
      notifySuccess("Saved", "All set");
      expect(alertSpy).toHaveBeenCalledWith("All set", "Saved");
    });
  });

  describe("mutationErrorToast", () => {
    it("builds an onError handler that reports through notifyError", () => {
      const shown: any[] = [];
      setToastHandler((payload) => shown.push(payload));

      const onError = mutationErrorToast("tags:create", "Couldn't create tag");
      onError(new ApiError(409, "Tag name already exists"));

      expect(shown[0]).toMatchObject({
        title: "Couldn't create tag",
        // A 4xx message is authored for humans, so it reaches the user.
        message: "Tag name already exists",
        kind: "error",
      });
    });

    it("passes the noun through to the copy mapping", () => {
      const shown: any[] = [];
      setToastHandler((payload) => shown.push(payload));

      mutationErrorToast(
        "tags:delete",
        "Couldn't delete tag",
        "tag",
      )(new ApiError(404, "gone"));

      expect(shown[0].message).toBe("This tag no longer exists.");
    });
  });

  it("logs every error through the logging funnel", () => {
    const logSpy = console.error as unknown as jest.SpyInstance;
    setToastHandler(() => {});

    notifyError(new ApiError(503, "unavailable"), { context: "tags:create" });

    expect(logSpy).toHaveBeenCalledWith(
      "[error] tags:create",
      expect.objectContaining({ status: 503 }),
    );
  });
});
