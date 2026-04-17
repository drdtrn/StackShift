import { render, screen } from '@testing-library/react';
import { Separator } from '../Separator';

describe('Separator', () => {
  it('renders a horizontal separator by default', () => {
    render(<Separator />);
    const el = screen.getByRole('separator');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('renders a vertical separator', () => {
    render(<Separator orientation="vertical" />);
    const el = screen.getByRole('separator');
    expect(el).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('renders horizontal as an <hr> element', () => {
    render(<Separator />);
    expect(screen.getByRole('separator').tagName).toBe('HR');
  });

  it('renders vertical as a <div> element', () => {
    render(<Separator orientation="vertical" />);
    expect(screen.getByRole('separator').tagName).toBe('DIV');
  });

  it('merges a custom className', () => {
    render(<Separator className="my-4" />);
    expect(screen.getByRole('separator').className).toMatch(/my-4/);
  });
});
