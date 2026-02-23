import { getContacts, getSuccessData, initializeApiClient } from '@orbital/client';
import { screen, testRouter, waitFor } from 'expo-router/testing-library';

import { renderAppRoute } from '../helpers/render';
import { getServerInfo } from '../helpers/server';

const WAIT_OPTIONS = { timeout: 10000 };

beforeAll(() => {
  const { url, token } = getServerInfo();
  initializeApiClient({
    baseURL: `${url}/rpc`,
    getToken: () => token,
  });
});

describe('Home Screen', () => {
  it('should display contacts from the backend', async () => {
    renderAppRoute({ initialUrl: '/' });

    expect(screen.getByText("Today's People")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getAllByText('Contact 1').length).toBeGreaterThan(0);
    }, WAIT_OPTIONS);

    expect(screen.getAllByText('Contact 2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Contact 3').length).toBeGreaterThan(0);
  });

  it('should show the Orbital header', () => {
    renderAppRoute({ initialUrl: '/' });
    expect(screen.getByText('Orbital')).toBeTruthy();
  });

  it('should navigate to contact detail and show contact data', async () => {
    // Fetch a real contact ID from the backend
    const response = await getContacts({ limit: 1 });
    const data = getSuccessData(response);
    const contact = data!.items[0];

    renderAppRoute({ initialUrl: '/' });

    // Wait for home screen contacts to load
    await waitFor(() => {
      expect(screen.getAllByText(contact.name).length).toBeGreaterThan(0);
    }, WAIT_OPTIONS);

    // Navigate to the contact detail page
    testRouter.push(`/contacts/${contact.id}`);

    // Assert the route changed
    expect(screen).toHavePathname(`/contacts/${contact.id}`);

    // Assert the detail screen renders correct contact data
    await waitFor(() => {
      expect(screen.getByText('Contact Details')).toBeTruthy();
      expect(screen.getByText(contact.name)).toBeTruthy();
    }, WAIT_OPTIONS);
  });
});
