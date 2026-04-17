import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('applies the destructive variant class', () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/bg-red/);
  });

  it('applies the ghost variant class', () => {
    render(<Button variant="ghost">Cancel</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/ghost|hover:bg-zinc/);
  });

  it('is disabled when the disabled prop is set', async () => {
    const handleClick = jest.fn();
    render(<Button disabled onClick={handleClick}>Submit</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('shows a spinner and disables the button when loading', async () => {
    const handleClick = jest.fn();
    render(<Button loading onClick={handleClick}>Submit</Button>);
    const btn = screen.getByRole('button');
    // Disabled so clicks are blocked.
    expect(btn).toBeDisabled();
    // aria-busy communicates pending state to assistive technology.
    expect(btn).toHaveAttribute('aria-busy', 'true');
    // Spinner is rendered inside the button.
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    await userEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('calls onClick when not disabled or loading', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('accepts a custom className and merges it', () => {
    render(<Button className="mt-4">Styled</Button>);
    expect(screen.getByRole('button').className).toMatch(/mt-4/);
  });
});
