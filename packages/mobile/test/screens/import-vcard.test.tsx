import { initializeApiClient } from "@orbital/client";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { renderAppRoute } from "../helpers/render";
import { getServerInfo } from "../helpers/server";

const WAIT_OPTIONS = { timeout: 10000 };

// Two cards, so the screen shows the selection list instead of handing off to
// the single-contact add screen. `mock`-prefixed for jest.mock hoisting.
const mockVCard = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Jane Doe",
  "ORG:Acme Inc.;Engineering",
  "TEL;TYPE=CELL:+1-555-1234",
  "TEL;TYPE=WORK:+1-555-9999",
  "ADR;TYPE=WORK:;;123 Main St;Springfield;IL;62704;USA",
  "URL:https://linkedin.com/in/janedoe",
  "NOTE:Met at conf",
  "END:VCARD",
  "",
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Bob Smith",
  "EMAIL:bob@x.com",
  "END:VCARD",
].join("\r\n");

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

const mockBulkCreateContacts = jest.fn();
jest.mock("@orbital/client", () => ({
  ...jest.requireActual("@orbital/client"),
  bulkCreateContacts: (...args: unknown[]) => mockBulkCreateContacts(...args),
}));

beforeAll(() => {
  const { url, token } = getServerInfo();
  initializeApiClient({ baseURL: `${url}/rpc`, getToken: () => token });
});

beforeEach(() => {
  mockBulkCreateContacts.mockReset();
  mockBulkCreateContacts.mockResolvedValue({
    status: 200,
    data: [
      { id: "id-jane", name: "Jane Doe" },
      { id: "id-bob", name: "Bob Smith" },
    ],
    headers: new Headers(),
  });
});

describe("Import screen, multi-card vCard", () => {
  it("sends columns, notes, and links for each card", async () => {
    renderAppRoute({ initialUrl: "/contacts/import?vcfUri=cards.vcf" });

    await waitFor(() => {
      expect(screen.getByText("Import 2 Contacts")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText("Import 2 Contacts"));

    await waitFor(() => {
      expect(mockBulkCreateContacts).toHaveBeenCalled();
    }, WAIT_OPTIONS);

    const [{ contacts }] = mockBulkCreateContacts.mock.calls[0] as [
      { contacts: Record<string, unknown>[] },
    ];

    expect(contacts[0]).toMatchObject({
      name: "Jane Doe",
      phone: "+1-555-1234",
      company: "Acme Inc.",
      links: [{ type: "linkedin", value: "janedoe" }],
    });
    // Only the values without a column of their own.
    expect(contacts[0].notes).toBe(
      "Phone (work): +1-555-9999\n" +
        "Address (work): 123 Main St, Springfield, IL, 62704, USA\n" +
        "Met at conf",
    );

    expect(contacts[1]).toMatchObject({
      name: "Bob Smith",
      email: "bob@x.com",
    });
    expect(contacts[1].notes).toBeUndefined();
    expect(contacts[1].links).toBeUndefined();
  });
});
