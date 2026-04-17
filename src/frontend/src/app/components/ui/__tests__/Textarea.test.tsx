import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from '../Textarea';

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea placeholder="Describe the issue…" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders a visible label linked to the textarea', () => {
    render(<Textarea label="Description" />);
    const label = screen.getByText('Description');
    const textarea = screen.getByRole('textbox');
    expect(label.getAttribute('for')).toBe(textarea.getAttribute('id'));
  });

  it('renders helper text when no error is present', () => {
    render(<Textarea helperText="Up to 500 characters" />);
    expect(screen.getByText('Up to 500 characters')).toBeInTheDocument();
  });

  it('renders an error message with role="alert"', () => {
    render(<Textarea errorMessage="Cannot be empty" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot be empty');
  });

  it('displays a character counter when maxLength is set', () => {
    render(<Textarea maxLength={200} defaultValue="Hello" />);
    expect(screen.getByText('5/200')).toBeInTheDocument();
  });

  it('updates the character counter as user types', async () => {
    render(<Textarea maxLength={50} />);
    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'abc');
    expect(screen.getByText('3/50')).toBeInTheDocument();
  });

  it('is disabled when the disabled prop is set', () => {
    render(<Textarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
