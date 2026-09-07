import { describe, expect, it } from 'vitest';
import { ManualPaymentProvider } from '../src/payments/manual-payment.provider';

describe('manual payment provider boundary', () => {
  it('creates instructions without claiming settlement', async () => {
    const provider = new ManualPaymentProvider({
      bankName: 'Bank Example',
      bankAccountName: 'JRC Committee',
      bankAccountNumber: '0000000000',
      qrisImageUrl: null,
    });
    const order = await provider.createOrder({
      registrationNumber: 'JRC14-0001',
      amount: 250000,
      currency: 'IDR',
      deadline: new Date('2026-10-01T00:00:00Z'),
    });
    expect(order.provider).toBe('MANUAL');
    expect(order.status).toBe('UNPAID');
    expect(order.instructions.bankAccountNumber).toBe('0000000000');
  });
});
