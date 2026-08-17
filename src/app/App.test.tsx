import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from './App';

describe('AppRoutes', () => {
  it('renders the public Roman arena experience at the root route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /java robot contest xiv/i })).toBeInTheDocument();
  });

  it('renders the participant login route', () => {
    render(
      <MemoryRouter initialEntries={['/portal/masuk']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /portal peserta/i })).toBeInTheDocument();
  });

  it('renders an arena themed not-found route', () => {
    render(
      <MemoryRouter initialEntries={['/rute-tidak-ada']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /arena tidak ditemukan/i })).toBeInTheDocument();
  });
});
