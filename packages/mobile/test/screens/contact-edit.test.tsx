import { getContacts, getSuccessData, initializeApiClient } from '@orbital/client';
import { screen, testRouter, waitFor } from 'expo-router/testing-library';
import { renderAppRoute } from '../helpers/render';
import { getServerInfo } from '../helpers/server';

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

describe('Edit Contact Screen', () => {
  it('should render edit form with contact data', async () => {
    renderAppRoute({ initialUrl: '/' });

    testRouter.push(`/contacts/${testContactId}/edit`);

    await waitFor(() => {
      expect(screen.getByText('Edit Contact')).toBeTruthy();
      expect(screen.getByText('Name *')).toBeTruthy();
    }, WAIT_OPTIONS);

    // Verify the contact name is populated in the TextInput
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue(testContactName);
      expect(nameInput).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it('should show all form fields', async () => {
    renderAppRoute({ initialUrl: '/' });

    testRouter.push(`/contacts/${testContactId}/edit`);

    await waitFor(() => {
      expect(screen.getByText('Edit Contact')).toBeTruthy();
    }, WAIT_OPTIONS);

    expect(screen.getByText('Name *')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Phone')).toBeTruthy();
    expect(screen.getByText('Job Title')).toBeTruthy();
    expect(screen.getByText('Company')).toBeTruthy();
    expect(screen.getByText('Group')).toBeTruthy();
    expect(screen.getByText('Notes')).toBeTruthy();
  });

  it('should show cancel and save buttons', async () => {
    renderAppRoute({ initialUrl: '/' });

    testRouter.push(`/contacts/${testContactId}/edit`);

    await waitFor(() => {
      expect(screen.getByText('Edit Contact')).toBeTruthy();
    }, WAIT_OPTIONS);

    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Save Changes')).toBeTruthy();
  });
});
