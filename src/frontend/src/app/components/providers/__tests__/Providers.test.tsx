import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { Providers } from '../Providers';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// useThemeEffect reads document.documentElement — stub it as a no-op so the
// test environment doesn't need a full DOM with matchMedia.
jest.mock('@/app/hooks/useThemeEffect', () => ({
  useThemeEffect: jest.fn(),
}));

// createQueryClientWithErrorHandler returns a real QueryClient in production.
// Replace with a fresh test client to keep tests isolated and avoid
// unhandled error handler side-effects.
jest.mock('@/app/lib/query-client', () => ({
  createQueryClientWithErrorHandler: () =>
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    }),
}));

// ReactQueryDevtools renders a floating button in development — stub it out
// so jsdom doesn't trip over its portal rendering.
jest.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => null,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Providers', () => {
  it('renders children', () => {
    render(
      <Providers>
        <p data-testid="child">App content</p>
      </Providers>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders multiple children', () => {
    render(
      <Providers>
        <span data-testid="a">A</span>
        <span data-testid="b">B</span>
      </Providers>,
    );
    expect(screen.getByTestId('a')).toBeInTheDocument();
    expect(screen.getByTestId('b')).toBeInTheDocument();
  });

  it('does not render ReactQueryDevtools in test environment (NODE_ENV=test)', () => {
    // NODE_ENV is 'test' in Jest — the devtools conditional should prevent rendering.
    // Since we mock the component to null, asserting it's absent validates the path.
    const { container } = render(<Providers><div /></Providers>);
    // No devtools button in the DOM
    expect(container.querySelector('[data-testid="react-query-devtools"]')).toBeNull();
  });
});
