import { fireEvent, screen, testRouter, waitFor } from 'expo-router/testing-library';

import { renderAppRoute } from '../helpers/render';

const WAIT_OPTIONS = { timeout: 10000 };

describe('Settings Screen', () => {
  it('should render settings options', async () => {
    renderAppRoute({ initialUrl: '/settings' });
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeTruthy();
      expect(screen.getByText('Developer Options')).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it('should navigate to developer options on press', async () => {
    renderAppRoute({ initialUrl: '/settings' });
    await waitFor(() => {
      expect(screen.getByText('Developer Options')).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText('Developer Options'));
    expect(screen).toHavePathname('/developer-options');
  });

  it('should render developer options screen', async () => {
    renderAppRoute({ initialUrl: '/developer-options' });
    await waitFor(() => {
      expect(screen.getByText('Dev Settings')).toBeTruthy();
      expect(screen.getByText('API Base URL')).toBeTruthy();
      expect(screen.getByText('JWT Token')).toBeTruthy();
      expect(screen.getByText('Save Settings')).toBeTruthy();
      expect(screen.getByText('Clear All')).toBeTruthy();
    }, WAIT_OPTIONS);
  });
});
