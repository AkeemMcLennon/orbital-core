import { initializeApiClient } from "@orbital/client";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { renderAppRoute } from "../helpers/render";
import { getServerInfo } from "../helpers/server";

const WAIT_OPTIONS = { timeout: 10000 };

// Mock expo-contacts with controllable data for import tests
jest.mock("expo-contacts", () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: "granted" }),
  ),
  getContactsAsync: jest.fn(() =>
    Promise.resolve({
      data: [
        {
          id: "device-1",
          name: "Alice Smith",
          emails: [{ email: "alice@example.com" }],
          phoneNumbers: [],
          company: "Acme",
        },
        {
          id: "device-2",
          name: "Bob Jones",
          emails: [],
          phoneNumbers: [{ number: "+1234567890" }],
          company: undefined,
        },
      ],
    }),
  ),
  Fields: {
    PhoneNumbers: "phoneNumbers",
    Emails: "emails",
    Image: "image",
    Company: "company",
  },
}));

// Provide bulkCreateContacts since it is not in the main repo's generated client yet
const mockBulkCreateContacts = jest.fn();
jest.mock("@orbital/client", () => ({
  ...jest.requireActual("@orbital/client"),
  bulkCreateContacts: (...args: unknown[]) => mockBulkCreateContacts(...args),
}));

beforeAll(() => {
  const { url, token } = getServerInfo();
  initializeApiClient({
    baseURL: `${url}/rpc`,
    getToken: () => token,
  });
});

beforeEach(() => {
  mockBulkCreateContacts.mockReset();
});

describe("Import Contacts Screen", () => {
  it("renders the import sources screen", async () => {
    renderAppRoute({ initialUrl: "/contacts/import" });

    await waitFor(() => {
      expect(screen.getByText("Import Contacts")).toBeTruthy();
    }, WAIT_OPTIONS);

    expect(screen.getByText("Sync Device Contacts")).toBeTruthy();
    expect(screen.getByText("Select Device Contacts")).toBeTruthy();
    expect(screen.getByText("Google Contacts")).toBeTruthy();
  });

  it("shows device contacts after pressing Select Device Contacts", async () => {
    renderAppRoute({ initialUrl: "/contacts/import" });

    await waitFor(() => {
      expect(screen.getByText("Select Device Contacts")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText("Select Device Contacts"));

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeTruthy();
      expect(screen.getByText("Bob Jones")).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it("navigates to contact detail after importing a single contact", async () => {
    mockBulkCreateContacts.mockResolvedValue({
      status: 200,
      data: [{ id: "new-contact-id", name: "Alice Smith" }],
      headers: new Headers(),
    });

    renderAppRoute({ initialUrl: "/contacts/import" });

    await waitFor(() => {
      expect(screen.getByText("Select Device Contacts")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText("Select Device Contacts"));

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeTruthy();
    }, WAIT_OPTIONS);

    // Select Alice Smith
    fireEvent.press(screen.getByText("Alice Smith"));

    await waitFor(() => {
      expect(screen.getByText("Import 1 Contact")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText("Import 1 Contact"));

    await waitFor(() => {
      expect(screen).toHavePathname("/contacts/new-contact-id");
    }, WAIT_OPTIONS);
  });

  it("navigates to contacts list after importing multiple contacts", async () => {
    mockBulkCreateContacts.mockResolvedValue({
      status: 200,
      data: [
        { id: "id-alice", name: "Alice Smith" },
        { id: "id-bob", name: "Bob Jones" },
      ],
      headers: new Headers(),
    });

    renderAppRoute({ initialUrl: "/contacts/import" });

    await waitFor(() => {
      expect(screen.getByText("Select Device Contacts")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText("Select Device Contacts"));

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeTruthy();
      expect(screen.getByText("Bob Jones")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText("Alice Smith"));
    fireEvent.press(screen.getByText("Bob Jones"));

    await waitFor(() => {
      expect(screen.getByText("Import 2 Contacts")).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText("Import 2 Contacts"));

    await waitFor(() => {
      expect(screen).toHavePathname("/contacts");
    }, WAIT_OPTIONS);
  });
});
