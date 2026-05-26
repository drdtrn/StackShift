import React from 'react';
import { render, screen } from '@testing-library/react';
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

const mockUpgradeMutate = jest.fn();
const mockPortalMutate = jest.fn();

jest.mock('@/app/hooks/queries/use-subscription', () => ({
  useSubscription: () => subscriptionState,
}));

jest.mock('@/app/hooks/mutations/use-upgrade-plan', () => ({
  useUpgradePlan: () => ({
    mutate: mockUpgradeMutate,
    isPending: false,
    variables: undefined,
  }),
}));

jest.mock('@/app/hooks/mutations/use-billing-portal', () => ({
  useBillingPortal: () => ({
    mutate: mockPortalMutate,
    isPending: false,
    variables: undefined,
  }),
}));

import { BillingPanel } from '../_components/BillingPanel';

function setSubscription(data: Subscription | undefined, opts: Partial<QueryState> = {}) {
  subscriptionState = {
    data,
    isPending: opts.isPending ?? data === undefined,
    isError: opts.isError ?? false,
  };
}

describe('BillingPanel', () => {
  beforeEach(() => {
    mockUpgradeMutate.mockReset();
    mockPortalMutate.mockReset();
  });

  it('Free plan — shows both Upgrade buttons, no Manage', () => {
    setSubscription({
      plan: 'free',
      status: 'none',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      hasStripeCustomer: false,
    });

    render(<BillingPanel />);

    expect(screen.getByText(/Upgrade to Indie/i)).toBeInTheDocument();
    expect(screen.getByText(/Upgrade to Team/i)).toBeInTheDocument();
    expect(screen.queryByText(/Manage subscription/i)).not.toBeInTheDocument();
  });

  it('Active Indie — shows Upgrade to Team and Manage buttons; no Upgrade to Indie', () => {
    setSubscription({
      plan: 'indie',
      status: 'active',
      currentPeriodEnd: '2026-06-15T00:00:00+00:00',
      cancelAtPeriodEnd: false,
      hasStripeCustomer: true,
    });

    render(<BillingPanel />);

    expect(screen.getByText(/Upgrade to Team/i)).toBeInTheDocument();
    expect(screen.getByText(/Manage subscription/i)).toBeInTheDocument();
    expect(screen.queryByText(/Upgrade to Indie/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Renews on/i)).toBeInTheDocument();
  });

  it('Active Indie — clicking Upgrade to Team launches portal with SubscriptionUpdate', () => {
    setSubscription({
      plan: 'indie',
      status: 'active',
      currentPeriodEnd: '2026-06-15T00:00:00+00:00',
      cancelAtPeriodEnd: false,
      hasStripeCustomer: true,
    });

    render(<BillingPanel />);

    screen.getByText(/Upgrade to Team/i).click();
    expect(mockPortalMutate).toHaveBeenCalledWith(
      { flow: 'SubscriptionUpdate' },
      expect.any(Object),
    );
  });

  it('Active Team — shows only Manage button (no further upgrade)', () => {
    setSubscription({
      plan: 'team',
      status: 'active',
      currentPeriodEnd: '2026-07-01T00:00:00+00:00',
      cancelAtPeriodEnd: false,
      hasStripeCustomer: true,
    });

    render(<BillingPanel />);

    expect(screen.getByText(/Manage subscription/i)).toBeInTheDocument();
    expect(screen.queryByText(/Upgrade to Team/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Upgrade to Indie/i)).not.toBeInTheDocument();
  });

  it('PastDue — shows amber payment-failed banner', () => {
    setSubscription({
      plan: 'indie',
      status: 'pastDue',
      currentPeriodEnd: '2026-06-15T00:00:00+00:00',
      cancelAtPeriodEnd: false,
      hasStripeCustomer: true,
    });

    render(<BillingPanel />);

    expect(screen.getByText(/last payment failed/i)).toBeInTheDocument();
  });

  it('Cancel-at-period-end — shows "Cancels on …" line', () => {
    setSubscription({
      plan: 'team',
      status: 'active',
      currentPeriodEnd: '2026-07-01T00:00:00+00:00',
      cancelAtPeriodEnd: true,
      hasStripeCustomer: true,
    });

    render(<BillingPanel />);

    expect(screen.getByText(/Cancels on/i)).toBeInTheDocument();
  });

  it('Loading — does not render Upgrade/Manage buttons', () => {
    setSubscription(undefined, { isPending: true });
    render(<BillingPanel />);
    expect(screen.queryByText(/Upgrade to Indie/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Manage subscription/i)).not.toBeInTheDocument();
  });

  it('Error — shows error copy', () => {
    setSubscription(undefined, { isPending: false, isError: true });
    render(<BillingPanel />);
    expect(screen.getByText(/Could not load subscription/i)).toBeInTheDocument();
  });
});
