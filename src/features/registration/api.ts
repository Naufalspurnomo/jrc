export const API_PATHS = {
  auth: {
    csrf: '/api/auth/csrf',
    me: '/api/auth/me',
    register: '/api/auth/register',
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    verifyEmail: '/api/auth/email-verification/verify',
    resendEmailVerification: '/api/auth/email-verification/resend',
  },
  competitions: '/api/competitions',
  registrations: {
    root: '/api/registrations',
    byId: (registrationId: string) => `/api/registrations/${encodeURIComponent(registrationId)}`,
    members: (registrationId: string) => `/api/registrations/${encodeURIComponent(registrationId)}/members`,
    member: (registrationId: string, memberId: string) =>
      `/api/registrations/${encodeURIComponent(registrationId)}/members/${encodeURIComponent(memberId)}`,
    submit: (registrationId: string) => `/api/registrations/${encodeURIComponent(registrationId)}/submit`,
    invoice: (registrationId: string) => `/api/registrations/${encodeURIComponent(registrationId)}/invoice`,
    ticket: (registrationId: string) => `/api/registrations/${encodeURIComponent(registrationId)}/ticket`,
    documents: (registrationId: string) => `/api/registrations/${encodeURIComponent(registrationId)}/documents`,
  },
  invoices: {
    proof: (invoiceId: string) => `/api/invoices/${encodeURIComponent(invoiceId)}/proof`,
  },
  tickets: {
    verify: '/api/tickets/verify',
  },
  gate: {
    inspect: '/api/gate/inspect',
    redeem: '/api/gate/redeem',
  },
  admin: {
    registrations: {
      root: '/api/admin/registrations',
      exportCsv: '/api/admin/registrations/export.csv',
      byId: (registrationId: string) => `/api/admin/registrations/${encodeURIComponent(registrationId)}`,
      review: (registrationId: string) => `/api/admin/registrations/${encodeURIComponent(registrationId)}/review`,
    },
    invoices: {
      verify: (invoiceId: string) => `/api/admin/invoices/${encodeURIComponent(invoiceId)}/verify`,
    },
    finance: {
      invoices: {
        root: '/api/admin/finance/invoices',
        proof: (invoiceId: string) => `/api/admin/finance/invoices/${encodeURIComponent(invoiceId)}/proof`,
      },
    },
  },
} as const;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type RequestBody = FormData | unknown;

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  body?: RequestBody;
  csrf?: boolean;
}

interface ApiErrorPayload {
  code?: unknown;
  message?: unknown;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
    if (Array.isArray(payload.message)) {
      const messages = payload.message.filter((item): item is string => typeof item === 'string');
      if (messages.length > 0) return messages.join(', ');
    }
  }
  if (typeof payload === 'string' && payload.trim()) return payload;
  return `Request failed with status ${status}`;
}

export class ApiError<TDetails = unknown> extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details: TDetails;

  constructor(status: number, details: TDetails, message = errorMessage(details, status)) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    const payload = isRecord(details) ? details as ApiErrorPayload : undefined;
    this.code = typeof payload?.code === 'string' ? payload.code : undefined;
  }
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined;
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.toLowerCase().includes('json')) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
  const text = await response.text();
  return text || undefined;
}

export class ApiClient {
  private csrfToken: string | null = null;
  private csrfRequest: Promise<string> | null = null;

  constructor(private readonly fetcher: Fetcher = globalThis.fetch.bind(globalThis)) {}

  clearCsrfToken(): void {
    this.csrfToken = null;
    this.csrfRequest = null;
  }

  private async loadCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    if (!this.csrfRequest) {
      this.csrfRequest = this.fetcher(API_PATHS.auth.csrf, {
        method: 'GET',
        credentials: 'include',
      }).then(async (response) => {
        const payload = await parseResponse(response);
        if (!response.ok) throw new ApiError(response.status, payload);
        if (!isRecord(payload) || typeof payload.csrfToken !== 'string' || !payload.csrfToken) {
          throw new Error('The CSRF endpoint returned no token');
        }
        this.csrfToken = payload.csrfToken;
        return payload.csrfToken;
      }).finally(() => {
        this.csrfRequest = null;
      });
    }
    return this.csrfRequest;
  }

  async request<T = unknown>(path: string, init: ApiRequestInit = {}): Promise<T> {
    const { body: requestBody, csrf, ...requestInit } = init;
    const method = (init.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const formDataBody = requestBody instanceof FormData;
    const shouldUseCsrf = csrf ?? MUTATING_METHODS.has(method);

    if (shouldUseCsrf && MUTATING_METHODS.has(method)) {
      headers['X-CSRF-Token'] = await this.loadCsrfToken();
    }

    let body: BodyInit | undefined;
    if (requestBody !== undefined) {
      if (formDataBody) {
        body = requestBody as FormData;
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === 'content-type') delete headers[key];
        }
      } else {
        body = JSON.stringify(requestBody);
        if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    const response = await this.fetcher(path, {
      ...requestInit,
      body,
      credentials: 'include',
      headers,
      method,
    });
    const payload = await parseResponse(response);
    if (!response.ok) throw new ApiError(response.status, payload);
    return payload as T;
  }
}

export type AuthRole =
  | 'PARTICIPANT'
  | 'SUPER_ADMIN'
  | 'REGISTRATION_REVIEWER'
  | 'FINANCE'
  | 'GATE_STAFF'
  | 'SUPPORT';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: AuthRole;
  active?: boolean;
  emailVerified: boolean;
}

export interface AuthSession {
  user: AuthUser;
  expiresAt?: string;
}

export interface AuthProbe {
  user: AuthUser | null;
  expiresAt?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
}

export type RegistrationState =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'REVISION_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type PaymentState =
  | 'NOT_CREATED'
  | 'UNPAID'
  | 'PENDING_VERIFICATION'
  | 'PAID'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REFUNDED';

export interface TeamMemberRecord {
  id: string;
  name: string;
  studentId?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: 'LEADER' | 'MEMBER';
}

export interface CompetitionRecord {
  id: string;
  slug?: string;
  name: string;
  level?: string | null;
  description?: string | null;
  eventId?: string;
  eventName?: string;
  fee?: number;
  currency?: string;
  registrationDeadline?: string;
  active?: boolean;
}

export interface RegistrationDocumentRecord {
  id: string;
  category: string;
  originalName: string;
  mimeType: string;
  size: number;
  downloadUrl?: string | null;
  createdAt?: string;
}

export interface RegistrationRecord {
  id: string;
  registrationNumber: string;
  competitionId: string;
  teamName: string;
  institution: string;
  phone?: string | null;
  status: RegistrationState;
  competition?: Pick<CompetitionRecord, 'id' | 'name' | 'eventId' | 'eventName'>;
  members?: TeamMemberRecord[];
  documents?: RegistrationDocumentRecord[];
  reviewReason?: string | null;
  submittedAt?: string | null;
  paymentStatus?: PaymentState;
  invoice?: Pick<InvoiceRecord, 'id' | 'paymentStatus'> | null;
  ticketStatus?: 'INACTIVE' | 'ACTIVE' | 'CHECKED_IN' | 'REVOKED';
  ticket?: {
    id?: string;
    status: 'INACTIVE' | 'ACTIVE' | 'CHECKED_IN' | 'REVOKED';
    issuedAt?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationPersonInput {
  name: string;
  studentId?: string;
  email?: string;
  phone?: string;
  role?: 'LEADER' | 'MEMBER';
}

export interface RegistrationInput {
  competitionId: string;
  teamName: string;
  institution: string;
  phone?: string;
  leader?: RegistrationPersonInput;
}

export type TeamMemberInput = RegistrationPersonInput;

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  provider: string;
  instructions: Record<string, string | null>;
  paymentStatus: PaymentState;
  deadline: string;
}

export interface FinanceInvoiceRecord {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  paymentStatus: PaymentState;
  deadline: string;
  proof: {
    originalName: string | null;
    mimeType: string | null;
    size: number | null;
  } | null;
  verificationReason: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  registration: {
    id: string;
    registrationNumber: string;
    teamName: string;
    institution: string;
    owner: {
      displayName: string;
    };
    competition: {
      id: string;
      name: string;
    };
  };
}

export interface TicketRecord {
  token: string;
  verificationUrl: string;
  status?: 'INACTIVE' | 'ACTIVE' | 'CHECKED_IN' | 'REVOKED';
  teamName?: string;
  registrationNumber?: string;
  competitionName?: string;
  eventName?: string;
  issuedAt?: string;
}

export type TicketResult =
  | 'VALID'
  | 'CHECKED_IN'
  | 'ALREADY_CHECKED_IN'
  | 'REVOKED'
  | 'UNKNOWN'
  | 'NOT_PAID'
  | 'WRONG_EVENT';

export interface TicketRequest {
  token: string;
  eventId: string;
}

export interface TicketVerification {
  result: TicketResult;
  teamName?: string;
  institution?: string;
  competitionName?: string;
  registrationNumber?: string;
  eventId?: string;
  eventName?: string;
}

export interface ReviewInput {
  status: RegistrationState;
  reason?: string;
}

export interface PaymentReviewInput {
  status: Extract<PaymentState, 'PAID' | 'REJECTED'>;
  reason: string;
}

export interface RegistrationApi {
  auth: {
    me(): Promise<AuthProbe>;
    login(input: LoginInput): Promise<AuthSession>;
    register(input: RegisterInput): Promise<AuthSession>;
    logout(): Promise<void>;
    verifyEmail(token: string): Promise<void>;
    resendEmailVerification(): Promise<void>;
  };
  competitions: {
    list(): Promise<CompetitionRecord[]>;
  };
  registrations: {
    list(): Promise<RegistrationRecord[]>;
    get(registrationId: string): Promise<RegistrationRecord>;
    create(input: RegistrationInput): Promise<RegistrationRecord>;
    update(registrationId: string, input: Partial<RegistrationInput>): Promise<RegistrationRecord>;
    updateMember(registrationId: string, memberId: string, input: Partial<TeamMemberInput>): Promise<TeamMemberRecord>;
    addMember(registrationId: string, input: TeamMemberInput): Promise<TeamMemberRecord>;
    removeMember(registrationId: string, memberId: string): Promise<void>;
    submit(registrationId: string): Promise<RegistrationRecord>;
    invoice(registrationId: string): Promise<InvoiceRecord>;
    ticket(registrationId: string): Promise<TicketRecord>;
    uploadDocument(registrationId: string, document: FormData): Promise<RegistrationDocumentRecord>;
  };
  invoices: {
    uploadProof(invoiceId: string, proof: FormData): Promise<InvoiceRecord>;
  };
  tickets: {
    verify(input: TicketRequest): Promise<TicketVerification>;
  };
  gate: {
    inspect(input: TicketRequest): Promise<TicketVerification>;
    redeem(input: TicketRequest): Promise<TicketVerification>;
  };
  admin: {
    listRegistrations(): Promise<RegistrationRecord[]>;
    getRegistration(registrationId: string): Promise<RegistrationRecord>;
    reviewRegistration(registrationId: string, input: ReviewInput): Promise<RegistrationRecord>;
    exportRegistrations(): Promise<string>;
    listFinanceInvoices(): Promise<FinanceInvoiceRecord[]>;
    verifyPayment(invoiceId: string, input: PaymentReviewInput): Promise<InvoiceRecord>;
  };
}

export function createRegistrationApi(client = new ApiClient()): RegistrationApi {
  return {
    auth: {
      me: () => client.request<AuthProbe>(API_PATHS.auth.me),
      login: (input) => client.request<AuthSession>(API_PATHS.auth.login, { method: 'POST', body: input, csrf: false }),
      register: (input) => client.request<AuthSession>(API_PATHS.auth.register, { method: 'POST', body: input, csrf: false }),
      logout: async () => {
        try {
          await client.request<void>(API_PATHS.auth.logout, { method: 'POST' });
        } finally {
          client.clearCsrfToken();
        }
      },
      verifyEmail: async (token) => {
        await client.request<void>(API_PATHS.auth.verifyEmail, {
          method: 'POST',
          body: { token },
          csrf: false,
        });
        client.clearCsrfToken();
      },
      resendEmailVerification: async () => {
        await client.request<void>(API_PATHS.auth.resendEmailVerification, {
          method: 'POST',
        });
      },
    },
    competitions: {
      list: () => client.request<CompetitionRecord[]>(API_PATHS.competitions),
    },
    registrations: {
      list: () => client.request<RegistrationRecord[]>(API_PATHS.registrations.root),
      get: (registrationId) => client.request<RegistrationRecord>(API_PATHS.registrations.byId(registrationId)),
      create: (input) => client.request<RegistrationRecord>(API_PATHS.registrations.root, { method: 'POST', body: input }),
      update: (registrationId, input) => client.request<RegistrationRecord>(API_PATHS.registrations.byId(registrationId), {
        method: 'PATCH',
        body: input,
      }),
      updateMember: (registrationId, memberId, input) => client.request<TeamMemberRecord>(
        API_PATHS.registrations.member(registrationId, memberId),
        {
          method: 'PATCH',
          body: input,
        },
      ),
      addMember: (registrationId, input) => client.request<TeamMemberRecord>(API_PATHS.registrations.members(registrationId), {
        method: 'POST',
        body: input,
      }),
      removeMember: (registrationId, memberId) => client.request<void>(API_PATHS.registrations.member(registrationId, memberId), {
        method: 'DELETE',
      }),
      submit: (registrationId) => client.request<RegistrationRecord>(API_PATHS.registrations.submit(registrationId), {
        method: 'POST',
      }),
      invoice: (registrationId) => client.request<InvoiceRecord>(API_PATHS.registrations.invoice(registrationId)),
      ticket: (registrationId) => client.request<TicketRecord>(API_PATHS.registrations.ticket(registrationId)),
      uploadDocument: (registrationId, document) => client.request<RegistrationDocumentRecord>(
        API_PATHS.registrations.documents(registrationId),
        {
          method: 'POST',
          body: document,
        },
      ),
    },
    invoices: {
      uploadProof: (invoiceId, proof) => client.request<InvoiceRecord>(API_PATHS.invoices.proof(invoiceId), {
        method: 'POST',
        body: proof,
      }),
    },
    tickets: {
      verify: (input) => client.request<TicketVerification>(API_PATHS.tickets.verify, {
        method: 'POST',
        body: input,
        csrf: false,
      }),
    },
    gate: {
      inspect: (input) => client.request<TicketVerification>(API_PATHS.gate.inspect, { method: 'POST', body: input }),
      redeem: (input) => client.request<TicketVerification>(API_PATHS.gate.redeem, { method: 'POST', body: input }),
    },
    admin: {
      listRegistrations: () => client.request<RegistrationRecord[]>(API_PATHS.admin.registrations.root),
      getRegistration: (registrationId) => client.request<RegistrationRecord>(API_PATHS.admin.registrations.byId(registrationId)),
      reviewRegistration: (registrationId, input) => client.request<RegistrationRecord>(
        API_PATHS.admin.registrations.review(registrationId),
        { method: 'POST', body: input },
      ),
      exportRegistrations: () => client.request<string>(API_PATHS.admin.registrations.exportCsv),
      listFinanceInvoices: () => client.request<FinanceInvoiceRecord[]>(API_PATHS.admin.finance.invoices.root),
      verifyPayment: (invoiceId, input) => client.request<InvoiceRecord>(API_PATHS.admin.invoices.verify(invoiceId), {
        method: 'POST',
        body: input,
      }),
    },
  };
}

export const registrationApi = createRegistrationApi();