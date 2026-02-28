import {
  getContacts,
  getSuccessData,
  initializeApiClient,
  listContactRelationships,
} from '@orbital/client';
import { screen, testRouter, waitFor } from 'expo-router/testing-library';
import { renderAppRoute } from '../helpers/render';
import { getServerInfo } from '../helpers/server';

const WAIT_OPTIONS = { timeout: 10000 };

let testContactId: string;
let testContactName: string;
let secondContactId: string;
let secondContactName: string;

beforeAll(async () => {
  const { url, token } = getServerInfo();
  initializeApiClient({
    baseURL: `${url}/rpc`,
    getToken: () => token,
  });

  // Fetch contacts - Contact 1 and Contact 2 have a seeded relationship
  const response = await getContacts({ limit: 5, sort: 'name' });
  const data = getSuccessData(response);
  const contacts = data!.items;

  // Sort by name to get consistent ordering
  const sorted = [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  testContactId = sorted[0].id;
  testContactName = sorted[0].name;
  secondContactId = sorted[1].id;
  secondContactName = sorted[1].name;
});

describe('Contact Relationships Section', () => {
  it('should show the Relationships section header', async () => {
    renderAppRoute({ initialUrl: '/' });

    testRouter.push(`/contacts/${testContactId}`);

    await waitFor(() => {
      expect(screen.getByText('Relationships')).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it('should display seeded relationship for Contact 1', async () => {
    renderAppRoute({ initialUrl: '/' });

    testRouter.push(`/contacts/${testContactId}`);

    await waitFor(() => {
      expect(screen.getByText('Relationships')).toBeTruthy();
    }, WAIT_OPTIONS);

    // Contact 1 has a "friend" relationship with Contact 2
    await waitFor(() => {
      expect(screen.getByText('friend')).toBeTruthy();
      expect(screen.getByText(secondContactName)).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it('should also show the relationship from Contact 2 perspective (mirror)', async () => {
    renderAppRoute({ initialUrl: '/' });

    testRouter.push(`/contacts/${secondContactId}`);

    await waitFor(() => {
      expect(screen.getByText('Relationships')).toBeTruthy();
    }, WAIT_OPTIONS);

    // Contact 2 should see the relationship with Contact 1
    await waitFor(() => {
      expect(screen.getByText('friend')).toBeTruthy();
      expect(screen.getByText(testContactName)).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it('should show "No relationships yet" for contact without relationships', async () => {
    // Contact 3 has no relationships
    const response = await getContacts({ limit: 5, sort: 'name' });
    const data = getSuccessData(response);
    const sorted = [...data!.items].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const contact3 = sorted[2]; // Contact 3

    renderAppRoute({ initialUrl: '/' });

    testRouter.push(`/contacts/${contact3.id}`);

    await waitFor(() => {
      expect(screen.getByText('Relationships')).toBeTruthy();
    }, WAIT_OPTIONS);

    await waitFor(() => {
      expect(screen.getByText('No relationships yet')).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it('should show the add relationship button', async () => {
    renderAppRoute({ initialUrl: '/' });

    testRouter.push(`/contacts/${testContactId}`);

    await waitFor(() => {
      expect(screen.getByText('Relationships')).toBeTruthy();
    }, WAIT_OPTIONS);

    // The add button renders an Ionicons "add" icon (mocked as Text with icon name)
    expect(screen.getByText('add')).toBeTruthy();
  });
});
