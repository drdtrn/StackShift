import { render } from '@testing-library/react';
import { Skeleton } from '../Skeleton';

// ---------------------------------------------------------------------------
// Framer Motion mock
// Both the gradient-sweep path (motion.span inner overlay) and the reduced-
// motion path (outer motion.span) render as plain <span> elements in jsdom.
// useReducedMotion is mocked to control which path is exercised.
// ---------------------------------------------------------------------------

const mockUseReducedMotion = jest.fn<boolean, []>().mockReturnValue(false);

jest.mock('framer-motion', () => ({
  motion: {
    span: ({
      children,
      animate: _a,
      transition: _t,
      ...props
    }: React.HTMLAttributes<HTMLSpanElement> & { animate?: unknown; transition?: unknown }) => (
      <span {...props}>{children}</span>
    ),
  },
  useReducedMotion: () => mockUseReducedMotion(),
}));

const getRoot = (ui: React.ReactElement) => {
  const { container } = render(ui);
  return container.firstChild as HTMLElement;
};

// ---------------------------------------------------------------------------
// Default path — gradient sweep shimmer
// ---------------------------------------------------------------------------

describe('Skeleton (default — gradient sweep)', () => {
  beforeEach(() => mockUseReducedMotion.mockReturnValue(false));

  it('renders a span element with aria-hidden', () => {
    const el = getRoot(<Skeleton />);
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a circle shape with rounded-full class', () => {
    const el = getRoot(<Skeleton shape="circle" />);
    expect(el.className).toMatch(/rounded-full/);
  });

  it('renders a rectangle shape (rounded-md, not full)', () => {
    const el = getRoot(<Skeleton shape="rectangle" />);
    expect(el.className).not.toMatch(/rounded-full/);
    expect(el.className).toMatch(/rounded-md/);
  });

  it('applies explicit width and height via inline style', () => {
    const el = getRoot(<Skeleton width="200px" height="40px" />);
    expect(el).toHaveStyle({ width: '200px', height: '40px' });
  });

  it('is hidden from screen readers via aria-hidden', () => {
    const el = getRoot(<Skeleton />);
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('accepts a custom className', () => {
    const el = getRoot(<Skeleton className="opacity-30" />);
    expect(el.className).toMatch(/opacity-30/);
  });

  it('renders an inner shimmer overlay span', () => {
    const { container } = render(<Skeleton />);
    // The outer plain span contains an inner motion.span (shimmer sweep)
    const inner = container.querySelector('span > span');
    expect(inner).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Reduced-motion path — opacity pulse
// ---------------------------------------------------------------------------

describe('Skeleton (reduced-motion — opacity pulse)', () => {
  beforeEach(() => mockUseReducedMotion.mockReturnValue(true));

  it('renders a single span with aria-hidden', () => {
    const el = getRoot(<Skeleton />);
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not render an inner shimmer overlay', () => {
    const { container } = render(<Skeleton />);
    const inner = container.querySelector('span > span');
    expect(inner).not.toBeInTheDocument();
  });

  it('applies shape classes correctly', () => {
    const el = getRoot(<Skeleton shape="circle" />);
    expect(el.className).toMatch(/rounded-full/);
  });
});
