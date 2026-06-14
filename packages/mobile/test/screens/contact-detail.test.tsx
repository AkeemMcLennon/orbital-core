import {
  createContact,
  getContacts,
  getSuccessData,
  initializeApiClient,
} from "@orbital/client";
import { screen, testRouter, waitFor } from "expo-router/testing-library";
import { renderAppRoute } from "../helpers/render";
import { getServerInfo } from "../helpers/server";

const WAIT_OPTIONS = { timeout: 10000 };

let testContactId: string;
let testContactName: string;

beforeAll(async () => {
  const { url, token } = getServerInfo();
  initializeApiClient({
    baseURL: `${url}/rpc`,
    getToken: () => token,
  });

  // Fetch a real contact ID for tests
  const response = await getContacts({ limit: 1 });
  const data = getSuccessData(response);
  const contact = data!.items[0];
  testContactId = contact.id;
  testContactName = contact.name;
});

describe("Contact Detail Screen", () => {
  it("should render contact data", async () => {
    renderAppRoute({ initialUrl: "/" });

    testRouter.push(`/contacts/${testContactId}`);

    await waitFor(() => {
      expect(screen.getByText("Contact Details")).toBeTruthy();
      expect(screen.getByText(testContactName)).toBeTruthy();
    }, WAIT_OPTIONS);

    expect(screen.getByText("Notes")).toBeTruthy();
  });

  it("should show loading state initially", () => {
    // Use an ID that hasn't been fetched yet to see loading state
    renderAppRoute({ initialUrl: "/" });

    testRouter.push("/contacts/some-unfetched-id");

    // The loading text should appear before data resolves
    expect(screen.getByText("Loading contact...")).toBeTruthy();
  });

  it("should show error state for invalid ID", async () => {
    renderAppRoute({ initialUrl: "/" });

    testRouter.push("/contacts/nonexistent-id");

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load contact details. Please try again."),
      ).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it("should navigate to edit screen", async () => {
    renderAppRoute({ initialUrl: "/" });

    testRouter.push(`/contacts/${testContactId}`);

    await waitFor(() => {
      expect(screen.getByText("Contact Details")).toBeTruthy();
    }, WAIT_OPTIONS);

    testRouter.push(`/contacts/${testContactId}/edit`);

    expect(screen).toHavePathname(`/contacts/${testContactId}/edit`);

    await waitFor(() => {
      expect(screen.getByText("Edit Contact")).toBeTruthy();
    }, WAIT_OPTIONS);
  });
});

describe("Contact Detail — Social Links", () => {
  it("should display social link icons for a contact with links", async () => {
    const response = await createContact({
      name: "Social Test Contact",
      links: [
        { type: "linkedin", value: "socialtestuser" },
        { type: "github", value: "socialtestdev" },
      ],
    });
    if (response.status !== 200) throw new Error("Contact creation failed");
    const contactId = response.data.id;

    renderAppRoute({ initialUrl: `/contacts/${contactId}` });

    await waitFor(() => {
      expect(screen.getByText("Contact Details")).toBeTruthy();
    }, WAIT_OPTIONS);

    // Ionicons is mocked as <Text>{iconName}</Text> in the test environment
    await waitFor(() => {
      expect(screen.getByText("logo-linkedin")).toBeTruthy();
      expect(screen.getByText("logo-github")).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it("should not show social link icons for a contact without links", async () => {
    const response = await createContact({ name: "No Links Contact" });
    if (response.status !== 200) throw new Error("Contact creation failed");

    renderAppRoute({ initialUrl: `/contacts/${response.data.id}` });

    await waitFor(() => {
      expect(screen.getByText("Contact Details")).toBeTruthy();
    }, WAIT_OPTIONS);

    expect(screen.queryByText("logo-linkedin")).toBeNull();
    expect(screen.queryByText("logo-github")).toBeNull();
  });
});
