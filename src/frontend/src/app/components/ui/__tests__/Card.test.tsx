import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardBody, CardFooter } from '../Card';

describe('Card', () => {
  it('renders children in the card body', () => {
    render(<Card><p>Hello</p></Card>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders CardHeader content', () => {
    render(
      <Card>
        <CardHeader><h2>Incident #1042</h2></CardHeader>
        <CardBody>Body text</CardBody>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Incident #1042' })).toBeInTheDocument();
  });

  it('renders CardBody content', () => {
    render(
      <Card>
        <CardBody>Body content here</CardBody>
      </Card>,
    );
    expect(screen.getByText('Body content here')).toBeInTheDocument();
  });

  it('renders CardFooter content', () => {
    render(
      <Card>
        <CardFooter><button>Resolve</button></CardFooter>
      </Card>,
    );
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
  });

  it('applies hoverable classes when hoverable=true', () => {
    render(<Card hoverable data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toMatch(/cursor-pointer/);
  });

  it('does not apply cursor-pointer when hoverable is not set', () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId('card').className).not.toMatch(/cursor-pointer/);
  });

  it('accepts a custom className', () => {
    render(<Card className="p-8" data-testid="card">Content</Card>);
    expect(screen.getByTestId('card').className).toMatch(/p-8/);
  });
});
