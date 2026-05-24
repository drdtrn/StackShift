import React from 'react';
import { render } from '@testing-library/react';
import type { User } from '@/app/types';

const mockReplace = jest.fn();
let currentPathname = '/projects';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => currentPathname,
}));

jest.mock('@/app/hooks/useAuthStore', () => ({
  useAuthStore: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAuthStore } = require('@/app/hooks/useAuthStore') as {
  useAuthStore: jest.Mock;
};

import { OrgGuard } from '@/app/components/providers/OrgGuard';

const baseUser: User = {
  id: 'u1',
  email: 'alice@acme.com',
  displayName: 'Alice',
  avatarUrl: null,
  role: 'owner',
  organizationId: 'org-1',
  createdAt: '2025-01-01T00:00:00.000Z',
  lastLoginAt: null,
};

function setUser(user: User | null): void {
  useAuthStore.mockImplementation((selector: (s: { user: User | null }) => unknown) =>
    selector({ user }),
  );
}

function renderGuard(): void {
  render(
    <OrgGuard>
      <div data-testid="child" />
    </OrgGuard>,
  );
}

beforeEach(() => {
  mockReplace.mockReset();
  currentPathname = '/projects';
});

describe('OrgGuard — state A (has org)', () => {
  it('does not redirect when on a normal dashboard route', () => {
    setUser({ ...baseUser, organizationId: 'org-1' });
    currentPathname = '/projects';
    renderGuard();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('pushes to / when sitting on /onboarding with an org already set', () => {
    setUser({ ...baseUser, organizationId: 'org-1' });
    currentPathname = '/onboarding';
    renderGuard();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('pushes to / when sitting on /waiting with an org already set', () => {
    setUser({ ...baseUser, organizationId: 'org-1' });
    currentPathname = '/waiting';
    renderGuard();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});

describe('OrgGuard — state B (owner, no org)', () => {
  it('redirects to /onboarding from a dashboard route', () => {
    setUser({ ...baseUser, role: 'owner', organizationId: null });
    currentPathname = '/projects';
    renderGuard();
    expect(mockReplace).toHaveBeenCalledWith('/onboarding');
  });

  it('does not redirect when already on /onboarding', () => {
    setUser({ ...baseUser, role: 'owner', organizationId: null });
    currentPathname = '/onboarding';
    renderGuard();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('OrgGuard — state C (non-owner, no org)', () => {
  it.each(['viewer', 'member', 'admin'] as const)(
    '%s without org → /waiting',
    (role) => {
      setUser({ ...baseUser, role, organizationId: null });
      currentPathname = '/projects';
      renderGuard();
      expect(mockReplace).toHaveBeenCalledWith('/waiting');
    },
  );

  it('does not redirect when already on /waiting', () => {
    setUser({ ...baseUser, role: 'viewer', organizationId: null });
    currentPathname = '/waiting';
    renderGuard();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('OrgGuard — no user', () => {
  it('is a no-op when AuthStore.user is null', () => {
    setUser(null);
    currentPathname = '/projects';
    renderGuard();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
