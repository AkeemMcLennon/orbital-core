import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react-native';
import { renderRouter, type RenderRouterOptions } from 'expo-router/testing-library';
import React from 'react';

/**
 * Renders a screen wrapped in a fresh QueryClientProvider.
 * Retries are disabled so tests fail fast on network errors.
 */
export function renderScreen(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Renders the real app/ route tree using expo-router/testing-library.
 * Layout modules are mocked in setup.ts to use minimal <Slot /> wrappers.
 * All real route components (index, contacts/[id], etc.) are loaded from app/.
 */
export function renderAppRoute(options: RenderRouterOptions = {}) {
  return renderRouter('./app', options);
}
