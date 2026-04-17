import { render, screen } from '@testing-library/react';
import { Spinner } from '../Spinner';

describe('Spinner', () => {
  it('renders with role="status" and accessible label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('applies the sm size class', () => {
    render(<Spinner size="sm" />);
    const el = screen.getByRole('status');
    expect(el.className).toMatch(/h-4/);
    expect(el.className).toMatch(/w-4/);
  });

  it('applies the md size class (default)', () => {
    render(<Spinner />);
    const el = screen.getByRole('status');
    expect(el.className).toMatch(/h-6/);
    expect(el.className).toMatch(/w-6/);
  });

  it('applies the lg size class', () => {
    render(<Spinner size="lg" />);
    const el = screen.getByRole('status');
    expect(el.className).toMatch(/h-8/);
    expect(el.className).toMatch(/w-8/);
  });

  it('applies animate-spin', () => {
    render(<Spinner />);
    expect(screen.getByRole('status').className).toMatch(/animate-spin/);
  });

  it('merges a custom className', () => {
    render(<Spinner className="text-blue-500" />);
    expect(screen.getByRole('status').className).toMatch(/text-blue-500/);
  });
});
