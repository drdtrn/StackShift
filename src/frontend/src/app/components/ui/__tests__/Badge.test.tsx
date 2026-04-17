import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>CRITICAL</Badge>);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('renders as a <span> element', () => {
    render(<Badge>HIGH</Badge>);
    expect(screen.getByText('HIGH').tagName).toBe('SPAN');
  });

  it('applies severity-critical colour class for the critical variant', () => {
    render(<Badge variant="critical">CRITICAL</Badge>);
    expect(screen.getByText('CRITICAL').className).toMatch(/severity-critical/);
  });

  it('applies severity-high colour class for the high variant', () => {
    render(<Badge variant="high">HIGH</Badge>);
    expect(screen.getByText('HIGH').className).toMatch(/severity-high/);
  });

  it('applies severity-medium colour class for the medium variant', () => {
    render(<Badge variant="medium">MEDIUM</Badge>);
    expect(screen.getByText('MEDIUM').className).toMatch(/severity-medium/);
  });

  it('applies severity-low colour class for the low variant', () => {
    render(<Badge variant="low">LOW</Badge>);
    expect(screen.getByText('LOW').className).toMatch(/severity-low/);
  });

  it('applies sm size classes', () => {
    render(<Badge size="sm">SM</Badge>);
    expect(screen.getByText('SM').className).toMatch(/text-xs/);
  });

  it('applies a custom className', () => {
    render(<Badge className="uppercase">LABEL</Badge>);
    expect(screen.getByText('LABEL').className).toMatch(/uppercase/);
  });
});
