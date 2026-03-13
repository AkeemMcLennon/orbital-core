import { initializeApiClient } from '@orbital/client';
import { screen, waitFor } from 'expo-router/testing-library';

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

describe('Memory Reps', () => {
  it('should display memory rep questions from the backend', async () => {
    renderAppRoute({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByText('Where does Contact 1 work?')).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it('should display identify question with "Who is this person?"', async () => {
    renderAppRoute({ initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getAllByText('Who is this person?').length).toBeGreaterThan(0);
    }, WAIT_OPTIONS);
  });

  it('should show answer options for memory reps', async () => {
    renderAppRoute({ initialUrl: '/' });

    await waitFor(() => {
      // Check that seeded options appear
      expect(screen.getByText('Acme Corp')).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it('should show detail question with contact name label', async () => {
    renderAppRoute({ initialUrl: '/' });

    await waitFor(() => {
      // Detail questions show the contact name in uppercase
      expect(screen.getByText('CONTACT 1')).toBeTruthy();
    }, WAIT_OPTIONS);
  });
});
