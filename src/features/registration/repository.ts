import type {
  DemoSession,
  Registration,
  RegistrationDraft,
  RegistrationFilters,
  RegistrationStatus,
} from './model';

export interface PortalRepository {
  getSession(): DemoSession | null;
  startSession(session: DemoSession): DemoSession;
  endSession(): void;
  getRegistration(id: string): Registration | null;
  saveDraft(id: string, draft: RegistrationDraft): Registration;
  submitRegistration(id: string): Registration;
  reviewRegistration(id: string, status: RegistrationStatus, note: string, author?: string): Registration;
  exportRegistrationsCsv(filters?: RegistrationFilters): string;
  listRegistrations(filters?: RegistrationFilters): Registration[];
}
