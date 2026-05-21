import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Subscription } from '@/app/lib/billing-schemas';

interface QueryState {
  data: Subscription | undefined;
  isPending: boolean;
  isError: boolean;
}

let subscriptionState: QueryState = {
  data: undefined,
  isPending: true,
  isError: false,
};

jest.mock('@/app/hooks/queries/use-subscription', () => ({
  useSubscription: () => subscriptionState,
}));

import { UpgradeBanner } from '../UpgradeBanner';

const DISMISS_KEY = 'stacksift-upgrade-banner-dismissed';

function setSubscription(data: Subscription | undefined, opts: Partial<QueryState> = {}) {
  subscriptionState = {
    data,
    isPending: opts.isPending ?? data === undefined,
    isError: opts.isError ?? false,
  };
}

describe('UpgradeBanner', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('renders for Free orgs', () => {
    setSubscription({
      plan: 'free',
      status: 'none',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      hasStripeCustomer: false,
    });

    render(<UpgradeBanner />);
    expect(screen.getByText(/You.?re on the Free plan/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view plans/i })).toBeInTheDocument();
  });

  it('hides for Indie orgs', () => {
    setSubscription({
      plan: 'indie',
      status: 'active',
      currentPeriodEnd: '2026-06-15T00:00:00+00:00',
      cancelAtPeriodEnd: false,
      hasStripeCustomer: true,
    });

    const { container } = render(<UpgradeBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('hides for Team orgs', () => {
    setSubscription({
      plan: 'team',
      status: 'active',
      currentPeriodEnd: '2026-06-15T00:00:00+00:00',
      cancelAtPeriodEnd: false,
      hasStripeCustomer: true,
    });

    const { container } = render(<UpgradeBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('hides while subscription query is pending', () => {
    setSubscription(undefined, { isPending: true });
    const { container } = render(<UpgradeBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('writes sessionStorage on dismiss', () => {
    setSubscription({
      plan: 'free',
      status: 'none',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      hasStripeCustomer: false,
    });

    render(<UpgradeBanner />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss upgrade banner/i }));
    expect(window.sessionStorage.getItem(DISMISS_KEY)).toBe('true');
    expect(screen.queryByText(/You.?re on the Free plan/i)).not.toBeInTheDocument();
  });

  it('stays dismissed across remount within same session', () => {
    window.sessionStorage.setItem(DISMISS_KEY, 'true');
    setSubscription({
      plan: 'free',
      status: 'none',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      hasStripeCustomer: false,
    });

    const { container } = render(<UpgradeBanner />);
    expect(container.firstChild).toBeNull();
  });
});
