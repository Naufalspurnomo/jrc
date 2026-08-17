export const REGISTRATION_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'revision_requested',
  'verified',
  'rejected',
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
export type DemoRole = 'participant' | 'admin';

export const PORTAL_COMPETITIONS = [
  { id: 'transporter-sd', level: 'SD', name: 'Donatopia · Transporter' },
  { id: 'rescue-smp', level: 'SMP', name: 'Nightmaze · Rescue Transporter' },
  { id: 'shooter-sma', level: 'SMA', name: 'Pirate Clash · Transporter Shooter' },
  { id: 'line-follower', level: 'Umum', name: 'Wacky Rally · Line Follower Mikro' },
  { id: 'sumo', level: 'Umum', name: 'Ring Rumble · Sumo' },
  { id: 'soccer', level: 'Umum', name: 'Goal Rush · Soccer' },
] as const;

export interface DemoSession {
  role: DemoRole;
  name: string;
  registrationId?: string;
}

export interface PortalFileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'leader' | 'member';
}

export interface RegistrationDraft {
  teamName: string;
  institution: string;
  competitionId: string;
  members: TeamMember[];
  documents: PortalFileMetadata[];
}

export interface ReviewEntry {
  id: string;
  createdAt: string;
  author: string;
  note: string;
  status: RegistrationStatus;
}

export interface Registration extends RegistrationDraft {
  id: string;
  status: RegistrationStatus;
  updatedAt: string;
  submittedAt?: string;
  reviews: ReviewEntry[];
}

export interface RegistrationFilters {
  status?: RegistrationStatus | 'all';
  competitionId?: string;
  query?: string;
}

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

interface PortalState {
  version: 1;
  session: DemoSession | null;
  registrations: Registration[];
}

const STORAGE_KEY = 'jrc-xiv.portal.v1';

const seedRegistrations = (): Registration[] => [
  ['reg-aurora', 'Aurora Mechanica', 'SMAN 1 Surabaya', 'transporter-sd', 'draft'],
  ['reg-victoria', 'Victoria Prime', 'SMPN 6 Surabaya', 'rescue-smp', 'submitted'],
  ['reg-legion', 'Legion 14', 'PENS', 'line-follower', 'under_review'],
  ['reg-roma', 'Roma Invicta', 'ITS', 'sumo', 'verified'],
].map(([id, teamName, institution, competitionId, status]) => ({
  id,
  teamName,
  institution,
  competitionId,
  status: status as RegistrationStatus,
  members: [],
  documents: [],
  reviews: [],
  updatedAt: '2026-08-17T00:00:00.000Z',
}));

const initialState = (): PortalState => ({
  version: 1,
  session: null,
  registrations: seedRegistrations(),
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const isMember = (value: unknown) => isRecord(value)
  && typeof value.id === 'string'
  && typeof value.name === 'string'
  && typeof value.email === 'string'
  && typeof value.phone === 'string'
  && (value.role === 'leader' || value.role === 'member');

const isDocument = (value: unknown) => isRecord(value)
  && typeof value.name === 'string'
  && typeof value.size === 'number'
  && typeof value.type === 'string'
  && typeof value.lastModified === 'number';

const isReview = (value: unknown) => isRecord(value)
  && typeof value.id === 'string'
  && typeof value.createdAt === 'string'
  && typeof value.author === 'string'
  && typeof value.note === 'string'
  && typeof value.status === 'string'
  && REGISTRATION_STATUSES.includes(value.status as RegistrationStatus);

const isPortalState = (value: unknown): value is PortalState => {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.registrations)) return false;
  const sessionValid = value.session === null || (
    isRecord(value.session)
    && (value.session.role === 'participant' || value.session.role === 'admin')
    && typeof value.session.name === 'string'
  );
  const registrationsValid = value.registrations.every((registration) => (
    isRecord(registration)
    && typeof registration.id === 'string'
    && typeof registration.teamName === 'string'
    && typeof registration.institution === 'string'
    && typeof registration.competitionId === 'string'
    && typeof registration.status === 'string'
    && REGISTRATION_STATUSES.includes(registration.status as RegistrationStatus)
    && typeof registration.updatedAt === 'string'
    && (registration.submittedAt === undefined || typeof registration.submittedAt === 'string')
    && Array.isArray(registration.members) && registration.members.every(isMember)
    && Array.isArray(registration.documents) && registration.documents.every(isDocument)
    && Array.isArray(registration.reviews) && registration.reviews.every(isReview)
  ));
  return sessionValid && registrationsValid;
};

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
};

const sessionMemoryStorage = createMemoryStorage();

const browserStorage = (): Storage => {
  try {
    const candidate = typeof window === 'undefined' ? undefined : window.localStorage;
    return candidate && typeof candidate.getItem === 'function' ? candidate : sessionMemoryStorage;
  } catch {
    return sessionMemoryStorage;
  }
};

export class LocalPortalRepository implements PortalRepository {
  private state: PortalState;
  private storage: Storage;

  constructor(storage: Storage = browserStorage()) {
    this.storage = storage;
    let stored: string | null;
    try {
      stored = this.storage.getItem(STORAGE_KEY);
    } catch {
      this.storage = sessionMemoryStorage;
      stored = this.storage.getItem(STORAGE_KEY);
    }
    let recovered = !stored;
    try {
      const parsed: unknown = stored ? JSON.parse(stored) : null;
      if (isPortalState(parsed)) {
        this.state = parsed;
      } else {
        this.state = initialState();
        recovered = true;
      }
    } catch {
      this.state = initialState();
      recovered = true;
    }
    if (recovered) this.persist();
  }

  getSession(): DemoSession | null {
    return this.state.session;
  }

  startSession(session: DemoSession): DemoSession {
    this.state.session = { ...session };
    this.persist();
    return { ...this.state.session };
  }

  endSession(): void {
    this.state.session = null;
    this.persist();
  }

  getRegistration(id: string): Registration | null {
    const registration = this.state.registrations.find((item) => item.id === id);
    return registration ? structuredClone(registration) : null;
  }

  saveDraft(id: string, draft: RegistrationDraft): Registration {
    const index = this.state.registrations.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Pendaftaran tidak ditemukan.');
    const current = this.state.registrations[index];
    if (!['draft', 'revision_requested'].includes(current.status)) {
      throw new Error('Pendaftaran tidak dapat diedit pada status saat ini.');
    }
    const saved: Registration = {
      ...current,
      ...structuredClone(draft),
      updatedAt: new Date().toISOString(),
    };
    this.state.registrations[index] = saved;
    this.persist();
    return structuredClone(saved);
  }

  submitRegistration(id: string): Registration {
    const index = this.state.registrations.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Pendaftaran tidak ditemukan.');
    const registration = this.state.registrations[index];
    if (!registration.teamName.trim() || !registration.institution.trim() || !registration.competitionId
      || registration.members.length === 0 || registration.documents.length === 0) {
      throw new Error('Lengkapi data tim sebelum mengirim pendaftaran.');
    }
    if (!['draft', 'revision_requested'].includes(registration.status)) {
      throw new Error('Pendaftaran tidak dapat dikirim pada status saat ini.');
    }
    const submittedAt = new Date().toISOString();
    const submitted = { ...registration, status: 'submitted' as const, submittedAt, updatedAt: submittedAt };
    this.state.registrations[index] = submitted;
    this.persist();
    return structuredClone(submitted);
  }

  reviewRegistration(
    id: string,
    status: RegistrationStatus,
    note: string,
    author = 'Panitia JRC',
  ): Registration {
    const index = this.state.registrations.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Pendaftaran tidak ditemukan.');
    const current = this.state.registrations[index];
    const transitions: Partial<Record<RegistrationStatus, RegistrationStatus[]>> = {
      submitted: ['under_review'],
      under_review: ['revision_requested', 'verified', 'rejected'],
    };
    if (!transitions[current.status]?.includes(status)) {
      throw new Error(`Transisi status ${current.status} ke ${status} tidak diizinkan.`);
    }
    if (!note.trim()) throw new Error('Catatan review wajib diisi.');
    const updatedAt = new Date().toISOString();
    const reviewed: Registration = {
      ...current,
      status,
      updatedAt,
      reviews: [...current.reviews, {
        id: globalThis.crypto?.randomUUID?.() ?? `review-${Date.now()}`,
        createdAt: updatedAt,
        author,
        note: note.trim(),
        status,
      }],
    };
    this.state.registrations[index] = reviewed;
    this.persist();
    return structuredClone(reviewed);
  }

  exportRegistrationsCsv(filters: RegistrationFilters = {}): string {
    const escapeCell = (value: string | number) => {
      let cell = String(value);
      if (/^[=+\-@]/.test(cell)) cell = `'${cell}`;
      return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
    };
    const rows = this.listRegistrations(filters).map((item) => [
      item.id,
      item.teamName,
      item.institution,
      item.competitionId,
      item.status,
      item.members.length,
      item.updatedAt,
    ].map(escapeCell).join(','));
    return ['ID,Tim,Institusi,Kategori,Status,Anggota,Diperbarui', ...rows].join('\r\n');
  }

  listRegistrations(filters: RegistrationFilters = {}): Registration[] {
    const query = filters.query?.trim().toLocaleLowerCase('id');
    const matches = this.state.registrations.filter((registration) => {
      if (filters.status && filters.status !== 'all' && registration.status !== filters.status) return false;
      if (filters.competitionId && registration.competitionId !== filters.competitionId) return false;
      if (query && !`${registration.teamName} ${registration.institution}`.toLocaleLowerCase('id').includes(query)) return false;
      return true;
    });
    return structuredClone(matches);
  }

  private persist(): void {
    const serialized = JSON.stringify(this.state);
    try {
      this.storage.setItem(STORAGE_KEY, serialized);
    } catch {
      this.storage = sessionMemoryStorage;
      this.storage.setItem(STORAGE_KEY, serialized);
    }
  }
}

export const createPortalRepository = (storage?: Storage) => new LocalPortalRepository(storage);
export const portalRepository = createPortalRepository();
