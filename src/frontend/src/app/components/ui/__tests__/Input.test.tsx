import { render, screen } from '@testing-library/react';
import { Input } from '../Input';

describe('Input', () => {
  it('renders the input element', () => {
    render(<Input placeholder="Search logs…" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders a visible label linked to the input', () => {
    render(<Input label="API Key" />);
    const label = screen.getByText('API Key');
    const input = screen.getByRole('textbox');
    // The label's htmlFor must match the input's id.
    expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
  });

  it('renders helper text below the input when no error', () => {
    render(<Input helperText="Your unique API key" />);
    expect(screen.getByText('Your unique API key')).toBeInTheDocument();
  });

  it('renders an error message with role="alert"', () => {
    render(<Input errorMessage="Required field" />);
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Required field');
  });

  it('hides helper text when an error message is present', () => {
    render(<Input helperText="Some hint" errorMessage="Too short" />);
    expect(screen.queryByText('Some hint')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Too short');
  });

  it('sets aria-invalid when errorMessage is provided', () => {
    render(<Input errorMessage="Bad value" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when there is no error', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it('renders left icon content', () => {
    render(<Input leftIcon={<span data-testid="left-icon">🔍</span>} />);
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
  });

  it('renders right icon content', () => {
    render(<Input rightIcon={<span data-testid="right-icon">✕</span>} />);
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('is disabled when the disabled prop is set', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
