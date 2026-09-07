import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PaymentStatusNotice } from '../../../components/portal/PaymentStatusNotice';

describe('PaymentStatusNotice', () => {
  it('states that an uploaded proof still awaits verification', () => {
    render(<PaymentStatusNotice status="PENDING_VERIFICATION" />);

    expect(screen.getByRole('status')).toHaveTextContent('Menunggu verifikasi');
    expect(screen.getByRole('status')).toHaveTextContent('belum dinyatakan lunas');
    expect(screen.queryByText(/^Lunas$/i)).not.toBeInTheDocument();
  });
});