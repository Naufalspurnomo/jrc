import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LocalPortalRepository } from '../../data/portal';
import AdminDashboardPage from './AdminDashboardPage';

const storage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null, key: (i) => [...values.keys()][i] ?? null,
    removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value),
  };
};

describe('AdminDashboardPage', () => {
  it('opens a demo admin command desk and filters registrations', async () => {
    const repository = new LocalPortalRepository(storage());
    render(<MemoryRouter><AdminDashboardPage repository={repository} /></MemoryRouter>);

    await userEvent.click(screen.getByRole('button', { name: /masuk sebagai admin/i }));
    expect(screen.getByRole('heading', { name: /meja komando pendaftaran/i })).toBeInTheDocument();
    expect(screen.getByText('Victoria Prime')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ekspor csv/i })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Filter status'), 'submitted');
    expect(screen.getByText('Victoria Prime')).toBeInTheDocument();
    expect(screen.queryByText('Legion 14')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /tinjau victoria prime/i })).toHaveAttribute(
      'href', '/admin/pendaftaran/reg-victoria',
    );
  });
});
