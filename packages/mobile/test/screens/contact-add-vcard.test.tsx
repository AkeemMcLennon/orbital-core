import { initializeApiClient } from "@orbital/client";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { renderAppRoute } from "../helpers/render";
import { getServerInfo } from "../helpers/server";

const WAIT_OPTIONS = { timeout: 10000 };

// `mock`-prefixed so jest.mock's factory may close over it (hoisting rule).
const mockVCard = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Jane Doe",
  "ORG:Acme Inc.;Engineering",
  "TITLE:CTO",
  "TEL;TYPE=CELL:+1-555-1234",
  "TEL;TYPE=WORK:+1-555-9999",
  "EMAIL;TYPE=WORK:jane@acme.com",
  "NICKNAME:Janey",
  "NOTE:Met at conf",
  "END:VCARD",
].join("\r\n");

// The real parser runs; only the file read is faked.
jest.mock("expo-file-system", () => ({
  File: class {
    text() {
      return Promise.resolve(mockVCard);
    }
    base64() {
      return Promise.resolve("");
    }
  },
  Paths: { cache: "file:///cache" },
  Directory: class {},
}));

const mockCreateContact = jest.fn((..._args: unknown[]) =>
  Promise.resolve({ status: 200, data: { id: "new-contact-1" } }),
);
jest.mock("@orbital/client", () => ({
  ...jest.requireActual("@orbital/client"),
  createContact: (...args: unknown[]) => mockCreateContact(...args),
}));

// A second import source with no notes of its own — used to prove a fresh
// import clears a prior import's notes rather than leaving them stuck.
const mockFetchMetadata = jest.fn((..._args: unknown[]) =>
  Promise.resolve({
    url: "https://example.com/no-notes-here",
    title: "No Notes Site",
    description: null,
    image: null,
  }),
);
jest.mock("../../src/utils/metadata", () => ({
  ...jest.requireActual("../../src/utils/metadata"),
  fetchMetadata: (...args: unknown[]) => mockFetchMetadata(...args),
}));

beforeAll(() => {
  const { url, token } = getServerInfo();
  initializeApiClient({ baseURL: `${url}/rpc`, getToken: () => token });
});

beforeEach(() => {
  mockCreateContact.mockClear();
});

describe("Add Contact screen, vCard prefill", () => {
  it("hides the detail fields until an import fills them", async () => {
    renderAppRoute({ initialUrl: "/contact-add" });

    await waitFor(() => {
      expect(screen.getByText("Notes")).toBeTruthy();
    }, WAIT_OPTIONS);

    expect(screen.queryByText("Phone")).toBeNull();
    expect(screen.queryByText("Company")).toBeNull();
    expect(screen.queryByText("Job Title")).toBeNull();
    expect(screen.queryByText("Birthday")).toBeNull();
  });

  it("reveals and prefills only the fields the card supplied", async () => {
    renderAppRoute({ initialUrl: "/contact-add?vcfUri=jane.vcf" });

    await waitFor(() => {
      expect(screen.getByDisplayValue("+1-555-1234")).toBeTruthy();
    }, WAIT_OPTIONS);

    expect(screen.getByDisplayValue("Acme Inc.")).toBeTruthy();
    expect(screen.getByDisplayValue("CTO")).toBeTruthy();
    // The card carries no BDAY, so that input stays hidden.
    expect(screen.queryByText("Birthday")).toBeNull();
  });

  it("keeps the phone in its own field and out of the notes", async () => {
    renderAppRoute({ initialUrl: "/contact-add?vcfUri=jane.vcf" });

    await waitFor(() => {
      expect(screen.getByDisplayValue("+1-555-1234")).toBeTruthy();
    }, WAIT_OPTIONS);

    // The second phone has no column, so it belongs in the notes — the first
    // one does not.
    const notes = screen.getByPlaceholderText("Add notes about this person...");
    expect(notes.props.value).toBe(
      "Phone (work): +1-555-9999\nNickname: Janey\nMet at conf",
    );
  });

  it("keeps a cleared field on screen instead of unmounting it mid-edit", async () => {
    renderAppRoute({ initialUrl: "/contact-add?vcfUri=jane.vcf" });

    await waitFor(() => {
      expect(screen.getByDisplayValue("+1-555-1234")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.changeText(screen.getByDisplayValue("+1-555-1234"), "");
    expect(screen.getByLabelText("Phone")).toBeTruthy();
  });

  it("keeps imported details when the name is edited, and sends them", async () => {
    renderAppRoute({ initialUrl: "/contact-add?vcfUri=jane.vcf" });

    await waitFor(() => {
      expect(screen.getByDisplayValue("+1-555-1234")).toBeTruthy();
    }, WAIT_OPTIONS);

    // Correcting a typo in the imported name must not discard the rest of the
    // import — those values would otherwise vanish silently from the create.
    fireEvent.changeText(screen.getByDisplayValue("Jane Doe"), "Jane Doh");

    expect(screen.getByDisplayValue("+1-555-1234")).toBeTruthy();
    expect(screen.getByDisplayValue("Acme Inc.")).toBeTruthy();
    expect(screen.getByDisplayValue("CTO")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Add Contact to network"));

    await waitFor(() => {
      expect(mockCreateContact).toHaveBeenCalled();
    }, WAIT_OPTIONS);

    expect(mockCreateContact.mock.calls[0][0]).toMatchObject({
      name: "Jane Doh",
      phone: "+1-555-1234",
      company: "Acme Inc.",
      jobTitle: "CTO",
    });
  });

  it("still drops imported details when the contact is dismissed outright", async () => {
    renderAppRoute({ initialUrl: "/contact-add?vcfUri=jane.vcf" });

    await waitFor(() => {
      expect(screen.getByDisplayValue("+1-555-1234")).toBeTruthy();
    }, WAIT_OPTIONS);

    // The X on the selected-contact card is the explicit "wrong person" action.
    fireEvent.press(screen.getByLabelText("Clear selected contact"));

    expect(screen.queryByLabelText("Phone")).toBeNull();
    expect(screen.queryByLabelText("Company")).toBeNull();
    expect(screen.queryByLabelText("Job Title")).toBeNull();
  });

  it("sends the imported fields as columns on create", async () => {
    renderAppRoute({ initialUrl: "/contact-add?vcfUri=jane.vcf" });

    await waitFor(() => {
      expect(screen.getByDisplayValue("+1-555-1234")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByLabelText("Add Contact to network"));

    await waitFor(() => {
      expect(mockCreateContact).toHaveBeenCalled();
    }, WAIT_OPTIONS);

    const payload = mockCreateContact.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      name: "Jane Doe",
      email: "jane@acme.com",
      phone: "+1-555-1234",
      company: "Acme Inc.",
      jobTitle: "CTO",
    });
    expect(payload.notes).not.toContain("+1-555-1234");
  });

  it("clears a prior import's notes when a later import has none of its own", async () => {
    renderAppRoute({ initialUrl: "/contact-add?vcfUri=jane.vcf" });

    const notesInput = () =>
      screen.getByPlaceholderText("Add notes about this person...");

    await waitFor(() => {
      expect(notesInput().props.value).toContain("Met at conf");
    }, WAIT_OPTIONS);

    // Typing over the imported name clears the selection, which is what lets
    // a second, independent import (a pasted URL here) take over the form.
    fireEvent.changeText(
      screen.getByDisplayValue("Jane Doe"),
      "https://example.com/no-notes-here",
    );

    await waitFor(() => {
      expect(screen.getByText("No Notes Site")).toBeTruthy();
    }, WAIT_OPTIONS);
    fireEvent.press(screen.getByText("No Notes Site"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("No Notes Site")).toBeTruthy();
    }, WAIT_OPTIONS);
    // The stale "Met at conf" from Jane's vCard must not survive onto a
    // contact whose own source had no notes at all.
    expect(notesInput().props.value).toBe("");
  });
});
