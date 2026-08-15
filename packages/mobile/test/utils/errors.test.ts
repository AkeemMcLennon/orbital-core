import {
  ApiError,
  isApiError,
  isNetworkError,
  isRetryableError,
  unwrap,
  unwrapAsync,
  unwrapMutationFn,
} from "@orbital/client";
import { toUserError, toUserMessage } from "../../src/utils/errors";

describe("unwrap", () => {
  it("returns data for a 2xx envelope", () => {
    expect(unwrap({ status: 200, data: { a: 1 } })).toEqual({ a: 1 });
  });

  it("throws ApiError carrying status and server message for a 4xx", () => {
    expect.assertions(4);
    try {
      unwrap({ status: 409, data: { message: "Tag name already exists" } });
    } catch (e) {
      expect(isApiError(e)).toBe(true);
      expect((e as ApiError).status).toBe(409);
      expect((e as ApiError).message).toBe("Tag name already exists");
      expect((e as ApiError).body).toEqual({
        message: "Tag name already exists",
      });
    }
  });

  it("throws ApiError for a 5xx, falling back to a status message", () => {
    try {
      unwrap({ status: 500, data: {} });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as ApiError).status).toBe(500);
      expect((e as ApiError).message).toBe("HTTP 500");
    }
  });

  it("passes through a value that is not an envelope", () => {
    // Keeps unwrap a no-op if the client ever rejects on HTTP errors natively.
    expect(unwrap({ items: [1, 2] } as never)).toEqual({ items: [1, 2] });
    expect(unwrap(null as never)).toBeNull();
    expect(unwrap("plain" as never)).toBe("plain");
  });

  it("normalizes undefined data to null via unwrapAsync", async () => {
    // react-query rejects `undefined` from a queryFn.
    await expect(
      unwrapAsync(Promise.resolve({ status: 200 })),
    ).resolves.toBeNull();
  });

  it("rejects with ApiError via unwrapAsync", async () => {
    await expect(
      unwrapAsync(Promise.resolve({ status: 404, data: { message: "nope" } })),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("unwrapMutationFn", () => {
  it("forwards the mutation variables and unwraps the result", async () => {
    const client = jest.fn(async (body: { name: string }) => ({
      status: 200 as const,
      data: { id: "t1", ...body },
    }));

    const mutationFn = unwrapMutationFn(client);
    await expect(mutationFn({ name: "Work" })).resolves.toEqual({
      id: "t1",
      name: "Work",
    });
    expect(client).toHaveBeenCalledWith({ name: "Work" });
  });

  it("forwards ONLY the variables, never react-query's second argument", async () => {
    // The reason this wrapper exists: react-query v5 calls
    // `mutationFn(variables, context)`, and the generated client functions take
    // an optional `RequestInit` second parameter — so passing a client function
    // directly would hand that context to fetch as request options.
    const client = jest.fn(async (_body: unknown, options?: RequestInit) => ({
      status: 200 as const,
      data: { options },
    }));

    const mutationFn = unwrapMutationFn(client);
    // Simulate react-query invoking with (variables, context).
    await (mutationFn as (...a: unknown[]) => Promise<unknown>)(
      { name: "Work" },
      { client: {}, meta: undefined },
    );

    expect(client).toHaveBeenCalledTimes(1);
    expect(client.mock.calls[0]).toHaveLength(1);
    expect(client.mock.calls[0][1]).toBeUndefined();
  });

  it("rejects with ApiError when the envelope is a non-2xx", async () => {
    const client = async () => ({
      status: 409 as const,
      data: { message: "Tag name already exists" },
    });

    await expect(unwrapMutationFn(client)(undefined)).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message: "Tag name already exists",
    });
  });
});

describe("isApiError", () => {
  it("recognizes a real ApiError", () => {
    expect(isApiError(new ApiError(500, "boom"))).toBe(true);
  });

  it("recognizes a structurally-equivalent error across module instances", () => {
    // Metro + workspace packages can yield duplicate module copies, defeating
    // instanceof, so the duck-check matters.
    expect(isApiError({ name: "ApiError", status: 503, message: "x" })).toBe(
      true,
    );
  });

  it("rejects unrelated errors", () => {
    expect(isApiError(new Error("nope"))).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError({ name: "ApiError" })).toBe(false); // no status
  });
});

describe("isNetworkError", () => {
  it.each([
    "Network request failed",
    "fetch failed",
    "The operation timed out",
    "Aborted",
  ])("treats %p as a network failure", (message) => {
    expect(isNetworkError(new Error(message))).toBe(true);
  });

  it("never classifies an ApiError as a network failure", () => {
    expect(isNetworkError(new ApiError(500, "Network request failed"))).toBe(
      false,
    );
  });
});

describe("isRetryableError", () => {
  it.each([500, 502, 503, 408, 429])("retries %i", (status) => {
    expect(isRetryableError(new ApiError(status, "x"))).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 422])("does not retry %i", (status) => {
    expect(isRetryableError(new ApiError(status, "x"))).toBe(false);
  });

  it("retries network failures", () => {
    expect(isRetryableError(new Error("Network request failed"))).toBe(true);
  });
});

describe("toUserError", () => {
  it("maps a network failure to connection copy", () => {
    const result = toUserError(new Error("Network request failed"));
    expect(result.title).toBe("No connection");
    expect(result.canRetry).toBe(true);
  });

  it.each([
    [401, "Session expired", false],
    [403, "Not allowed", false],
    [404, "Not found", false],
    [408, "Timed out", true],
    [429, "Slow down", true],
    [500, "Something went wrong", true],
    [503, "Something went wrong", true],
  ])("maps %i to %p (canRetry=%p)", (status, title, canRetry) => {
    const result = toUserError(new ApiError(status, "server text"));
    expect(result.title).toBe(title);
    expect(result.canRetry).toBe(canRetry);
  });

  it("surfaces the server message for a 4xx the user can act on", () => {
    expect(toUserMessage(new ApiError(409, "Tag name already exists"))).toBe(
      "Tag name already exists",
    );
  });

  it("does not surface unwrap's 'HTTP <n>' fallback as if it were server copy", () => {
    // A 4xx with a non-JSON body (e.g. a proxy's HTML page) yields an ApiError
    // whose message is unwrap's "HTTP <status>" fallback — readBody keeps the
    // raw snippet off `message`, and this branch keeps the bare status string
    // off the screen too.
    expect(toUserMessage(new ApiError(400, "HTTP 400"))).toBe(
      "Please check your input and try again.",
    );
  });

  it("never surfaces a 5xx body, which may leak internals", () => {
    const message = toUserMessage(
      new ApiError(500, "TypeError: db.users is undefined at line 42"),
    );
    expect(message).not.toContain("TypeError");
    expect(message).toBe("Our server had a problem. Try again in a moment.");
  });

  it("uses the supplied noun in not-found copy", () => {
    expect(toUserMessage(new ApiError(404, "x"), { noun: "contact" })).toBe(
      "This contact no longer exists.",
    );
  });

  it("falls back to generic copy for an unknown error", () => {
    const result = toUserError("something odd");
    expect(result.title).toBe("Something went wrong");
    expect(result.canRetry).toBe(true);
  });
});
