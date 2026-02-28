import { initializeApiClient } from '@orbital/client';
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

describe('Add Contact Screen', () => {
  it('should render add contact form', async () => {
    renderAppRoute({ initialUrl: '/' });

    testRouter.push('/contact-add');

    await waitFor(() => {
      expect(screen.getAllByText('Add Contact').length).toBeGreaterThanOrEqual(2);
    }, WAIT_OPTIONS);

    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Notes')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('should show import banner', async () => {
    renderAppRoute({ initialUrl: '/' });

    testRouter.push('/contact-add');

    await waitFor(() => {
      expect(screen.getAllByText('Add Contact').length).toBeGreaterThanOrEqual(1);
    }, WAIT_OPTIONS);

    expect(screen.getByText('Import from Phone or Google')).toBeTruthy();
  });

  it('should show search input', async () => {
    renderAppRoute({ initialUrl: '/' });

    testRouter.push('/contact-add');

    await waitFor(() => {
      expect(screen.getAllByText('Add Contact').length).toBeGreaterThanOrEqual(1);
    }, WAIT_OPTIONS);

    expect(screen.getByPlaceholderText('Search contacts...')).toBeTruthy();
  });
});
