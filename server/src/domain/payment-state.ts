import { BadRequestException } from '@nestjs/common';
import type { PaymentStatus } from '@prisma/client';

const transitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  NOT_CREATED: ['UNPAID'],
  UNPAID: ['PENDING_VERIFICATION', 'EXPIRED'],
  PENDING_VERIFICATION: ['PAID', 'REJECTED', 'EXPIRED'],
  PAID: ['REFUNDED'],
  REJECTED: ['PENDING_VERIFICATION', 'EXPIRED'],
  EXPIRED: ['UNPAID'],
  REFUNDED: [],
};

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!transitions[from].includes(to)) {
    throw new BadRequestException(`Payment transition ${from} to ${to} is not allowed`);
  }
}
