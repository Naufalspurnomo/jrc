import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PublicTicketResult } from '../../../components/ticket/PublicTicketResult';
import { normalizePublicTicket } from '../publicTicket';

describe('public ticket verification', () => {
  it('renders only allowlisted public identity fields', () => {
    const result = normalizePublicTicket({
      result: 'VALID',
      teamName: 'Garuda Robotika',
      institution: 'PENS',
      competition: 'Sumo',
      registrationNumber: 'JRC-0142',
      event: { name: 'JRC XIV', edition: 'Imperium Machina' },
      email: 'private@example.test',
      phone: '081234567890',
      members: [{ name: 'Private Member' }],
      payment: { amount: 900000 },
    });

    render(<PublicTicketResult verification={result} />);

    expect(screen.getByText('Garuda Robotika')).toBeInTheDocument();
    expect(screen.getByText('JRC-0142')).toBeInTheDocument();
    expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('081234567890')).not.toBeInTheDocument();
    expect(screen.queryByText('Private Member')).not.toBeInTheDocument();
    expect(screen.queryByText('900000')).not.toBeInTheDocument();
  });
});