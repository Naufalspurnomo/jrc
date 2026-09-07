import { Injectable } from '@nestjs/common';
import type { CreatePaymentOrderInput, PaymentOrder, PaymentProvider } from './payment-provider';

export interface ManualPaymentConfig {
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  qrisImageUrl: string | null;
}

@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  private readonly config: ManualPaymentConfig;

  constructor(config?: ManualPaymentConfig) {
    if (config) {
      this.config = config;
      return;
    }

    const bankName = process.env.PAYMENT_BANK_NAME?.trim();
    const bankAccountName = process.env.PAYMENT_ACCOUNT_NAME?.trim();
    const bankAccountNumber = process.env.PAYMENT_ACCOUNT_NUMBER?.trim();
    const qrisImageUrl = process.env.PAYMENT_QRIS_IMAGE_URL?.trim() || null;

    if (process.env.NODE_ENV === 'production') {
      if ((process.env.PAYMENT_PROVIDER ?? 'MANUAL') !== 'MANUAL') {
        throw new Error('Only PAYMENT_PROVIDER=MANUAL is currently supported');
      }
      if (!bankName || !bankAccountName || !bankAccountNumber) {
        throw new Error('Manual payment bank configuration is required in production');
      }
    }
    if (qrisImageUrl) {
      const url = new URL(qrisImageUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('PAYMENT_QRIS_IMAGE_URL must be a safe HTTP or HTTPS URL');
      }
    }

    this.config = {
      bankName: bankName ?? 'Configure PAYMENT_BANK_NAME',
      bankAccountName: bankAccountName ?? 'Configure PAYMENT_ACCOUNT_NAME',
      bankAccountNumber: bankAccountNumber ?? 'Configure PAYMENT_ACCOUNT_NUMBER',
      qrisImageUrl,
    };
  }

  createOrder(input: CreatePaymentOrderInput): Promise<PaymentOrder> {
    return Promise.resolve({
      provider: 'MANUAL',
      status: 'UNPAID',
      instructions: {
        provider: 'MANUAL',
        bankName: this.config.bankName,
        bankAccountName: this.config.bankAccountName,
        bankAccountNumber: this.config.bankAccountNumber,
        qrisImageUrl: this.config.qrisImageUrl,
        transferReference: input.registrationNumber,
        amount: String(input.amount),
        currency: input.currency,
        deadline: input.deadline.toISOString(),
        notice: 'Pembayaran hanya dinyatakan lunas setelah diverifikasi oleh tim keuangan.',
      },
    });
  }
}
