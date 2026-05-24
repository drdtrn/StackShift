import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuthGuard } from '../AuthGuard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/dashboard',
}));

const mockUseSession = jest.fn();

jest.mock('@/app/hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPush.mockReset();
});

describe('AuthGuard — loading state', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({ isLoading: true, isAuthenticated: false, user: null });
  });

  it('renders children while loading', () => {
    render(
      <AuthGuard>
        <p data-testid="child">Dashboard content</p>
      </AuthGuard>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders the loading overlay', () => {
    render(<AuthGuard><div /></AuthGuard>);
    expect(screen.getByLabelText(/checking authentication/i)).toBeInTheDocument();
  });

  it('overlay is marked aria-busy="true"', () => {
    render(<AuthGuard><div /></AuthGuard>);
    const overlay = screen.getByLabelText(/checking authentication/i);
    expect(overlay).toHaveAttribute('aria-busy', 'true');
  });

  it('does not redirect while loading', () => {
    render(<AuthGuard><div /></AuthGuard>);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('AuthGuard — unauthenticated', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({ isLoading: false, isAuthenticated: false, user: null });
  });

  it('renders nothing (null) when unauthenticated', () => {
    const { container } = render(
      <AuthGuard>
        <p data-testid="child">Secret content</p>
      </AuthGuard>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('redirects to /landing with the current pathname as ?next param', () => {
    render(<AuthGuard><div /></AuthGuard>);
    // Redirect fires in useEffect — it runs synchronously in the test environment
    expect(mockPush).toHaveBeenCalledWith(
      `/landing?next=${encodeURIComponent('/dashboard')}`,
    );
  });
});

describe('AuthGuard — authenticated', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { id: 'usr-1', name: 'Jane Doe', email: 'jane@example.com', organizationId: 'org-1' },
    });
  });

  it('renders children when authenticated', () => {
    render(
      <AuthGuard>
        <p data-testid="child">Dashboard</p>
      </AuthGuard>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('does not render the loading overlay', () => {
    render(<AuthGuard><div /></AuthGuard>);
    expect(screen.queryByLabelText(/checking authentication/i)).not.toBeInTheDocument();
  });

  it('does not redirect when authenticated', () => {
    render(<AuthGuard><div /></AuthGuard>);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
