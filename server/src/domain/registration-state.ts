import { BadRequestException } from '@nestjs/common';
import type { RegistrationStatus } from '@prisma/client';

const transitions: Record<RegistrationStatus, readonly RegistrationStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'],
  REVISION_REQUESTED: ['SUBMITTED', 'CANCELLED'],
  APPROVED: ['CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
};

export function assertRegistrationTransition(from: RegistrationStatus, to: RegistrationStatus): void {
  if (!transitions[from].includes(to)) {
    throw new BadRequestException(`Registration transition ${from} to ${to} is not allowed`);
  }
}

export function canEditRegistration(status: RegistrationStatus): boolean {
  return status === 'DRAFT' || status === 'REVISION_REQUESTED';
}

export function requiresRegistrationReason(status: RegistrationStatus): boolean {
  return status === 'REVISION_REQUESTED' || status === 'REJECTED' || status === 'CANCELLED';
}
