import { initializeApiClient } from '@orbital/client';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

const mockRequestAccountDeletion = jest.fn();
jest.mock('@orbital/client', () => ({
  ...jest.requireActual('@orbital/client'),
  requestAccountDeletion: (...args: any[]) => mockRequestAccountDeletion(...args),
}));

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

describe('Settings Screen — Delete Account', () => {
  beforeEach(() => {
    mockRequestAccountDeletion.mockReset();
  });

  it('renders the Danger Zone and Delete Account button', async () => {
    renderAppRoute({ initialUrl: '/settings' });

    await waitFor(() => {
      expect(screen.getByText('Danger Zone')).toBeTruthy();
      expect(screen.getByText('Delete Account')).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it('opens the confirmation modal when Delete Account is pressed', async () => {
    renderAppRoute({ initialUrl: '/settings' });

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText('Delete Account'));

    await waitFor(() => {
      expect(screen.getByText('Delete Your Account')).toBeTruthy();
      expect(screen.getByText(/permanently delete your account/i)).toBeTruthy();
    }, WAIT_OPTIONS);
  });

  it('does not call the API when confirm is pressed without typing DELETE', async () => {
    mockRequestAccountDeletion.mockResolvedValue({ status: 200, data: {} });

    renderAppRoute({ initialUrl: '/settings' });

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText('Delete Account'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('DELETE')).toBeTruthy();
    }, WAIT_OPTIONS);

    // Type wrong phrase
    fireEvent.changeText(screen.getByPlaceholderText('DELETE'), 'delete');

    // Press confirm button — should be disabled so nothing happens
    const confirmButtons = screen.getAllByText('Delete Account');
    fireEvent.press(confirmButtons[confirmButtons.length - 1]);

    expect(mockRequestAccountDeletion).not.toHaveBeenCalled();
  });

  it('enables the confirm button only after typing DELETE exactly', async () => {
    renderAppRoute({ initialUrl: '/settings' });

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText('Delete Account'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('DELETE')).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.changeText(screen.getByPlaceholderText('DELETE'), 'DELETE');

    const confirmButtons = screen.getAllByText('Delete Account');
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    // Parent Pressable should not be disabled
    expect(confirmButton.parent?.props.disabled).toBeFalsy();
  });

  it('shows success message and logs out after confirming deletion', async () => {
    mockRequestAccountDeletion.mockResolvedValue({
      status: 200,
      data: {
        scheduledDeleteAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        message: 'Your account will be permanently deleted in 14 days.',
      },
    });

    renderAppRoute({ initialUrl: '/settings' });

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.press(screen.getByText('Delete Account'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('DELETE')).toBeTruthy();
    }, WAIT_OPTIONS);

    fireEvent.changeText(screen.getByPlaceholderText('DELETE'), 'DELETE');

    const confirmButtons = screen.getAllByText('Delete Account');
    fireEvent.press(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Deletion Requested')).toBeTruthy();
      expect(screen.getByText(/14 days/i)).toBeTruthy();
    }, WAIT_OPTIONS);

    expect(mockRequestAccountDeletion).toHaveBeenCalledTimes(1);
  });
});
