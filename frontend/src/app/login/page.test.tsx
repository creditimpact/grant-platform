import { render, screen } from '@testing-library/react';
import Login from './page';

describe('Login page', () => {
  it('renders login button', () => {
    render(<Login />);
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });
});
