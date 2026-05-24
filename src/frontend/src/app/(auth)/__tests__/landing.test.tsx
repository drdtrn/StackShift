import React from 'react';
import { render, screen } from '@testing-library/react';
import LandingPage from '../landing/page';

describe('LandingPage', () => {
  it('renders the welcome heading', () => {
    render(<LandingPage />);
    expect(
      screen.getByRole('heading', { name: /welcome to stacksift/i }),
    ).toBeInTheDocument();
  });

  it('links "Create an account" to /register', () => {
    render(<LandingPage />);
    const link = screen.getByRole('link', { name: /create an account/i });
    expect(link).toHaveAttribute('href', '/register');
  });

  it('links "Sign in" to /login', () => {
    render(<LandingPage />);
    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link).toHaveAttribute('href', '/login');
  });
});
