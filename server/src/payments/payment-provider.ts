import type { PaymentStatus } from '@prisma/client';

export interface CreatePaymentOrderInput {
  registrationNumber: string;
  amount: number;
  currency: string;
  deadline: Date;
}

export interface PaymentOrder {
  provider: string;
  status: PaymentStatus;
  instructions: Record<string, string | null>;
}

export interface PaymentProvider {
  createOrder(input: CreatePaymentOrderInput): Promise<PaymentOrder>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
