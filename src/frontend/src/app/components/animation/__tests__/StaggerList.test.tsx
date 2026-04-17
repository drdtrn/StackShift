import React from 'react';
import { render, screen } from '@testing-library/react';
import { StaggerList, StaggerItem } from '../StaggerList';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseReducedMotion = jest.fn<boolean, []>().mockReturnValue(false);

jest.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      variants: _v,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
      <div {...props}>{children}</div>
    ),
  },
  useReducedMotion: () => mockUseReducedMotion(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StaggerList', () => {
  beforeEach(() => mockUseReducedMotion.mockReturnValue(false));

  it('renders children', () => {
    render(
      <StaggerList>
        <StaggerItem>
          <span data-testid="item-1">Item 1</span>
        </StaggerItem>
        <StaggerItem>
          <span data-testid="item-2">Item 2</span>
        </StaggerItem>
      </StaggerList>,
    );
    expect(screen.getByTestId('item-1')).toBeInTheDocument();
    expect(screen.getByTestId('item-2')).toBeInTheDocument();
  });

  it('renders all items in correct order', () => {
    render(
      <StaggerList>
        {['Alpha', 'Beta', 'Gamma'].map((label) => (
          <StaggerItem key={label}>
            <span>{label}</span>
          </StaggerItem>
        ))}
      </StaggerList>,
    );
    const items = screen.getAllByText(/Alpha|Beta|Gamma/);
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe('Alpha');
    expect(items[1].textContent).toBe('Beta');
    expect(items[2].textContent).toBe('Gamma');
  });

  it('accepts a custom className on StaggerList', () => {
    const { container } = render(
      <StaggerList className="grid grid-cols-3">
        <StaggerItem>item</StaggerItem>
      </StaggerList>,
    );
    const list = container.firstChild as HTMLElement;
    expect(list.className).toMatch(/grid/);
    expect(list.className).toMatch(/grid-cols-3/);
  });

  it('accepts a custom className on StaggerItem', () => {
    const { container } = render(
      <StaggerList>
        <StaggerItem className="p-4 custom-item">item</StaggerItem>
      </StaggerList>,
    );
    // StaggerList is the first div; StaggerItem is its first child div
    const item = (container.firstChild as HTMLElement).firstChild as HTMLElement;
    expect(item.className).toMatch(/custom-item/);
  });
});

describe('StaggerList — reduced motion', () => {
  beforeEach(() => mockUseReducedMotion.mockReturnValue(true));

  it('renders all children when reduced motion is active', () => {
    render(
      <StaggerList>
        <StaggerItem>
          <span data-testid="rm-item">content</span>
        </StaggerItem>
      </StaggerList>,
    );
    expect(screen.getByTestId('rm-item')).toBeInTheDocument();
  });
});
