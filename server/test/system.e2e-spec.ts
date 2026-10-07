import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request, { Response } from 'supertest';

type SuperAgentTest = ReturnType<typeof request.agent>;
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { hashToken, SESSION_COOKIE_NAME } from '../src/auth';
import { configureApp } from '../src/bootstrap';

const run = process.env.RUN_E2E === '1';
const suite = run ? describe : describe.skip;

suite('registration system e2e', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let competitionId: string;
  let eventId: string;
  let registrationId: string;
  let invoiceId: string;
  let participantA: SuperAgentTest;
  let participantB: SuperAgentTest;
  let reviewer: SuperAgentTest;
  let finance: SuperAgentTest;
  let paidTeamViewer: SuperAgentTest;
  let superAdmin: SuperAgentTest;
  let gate: SuperAgentTest;
  let csrfA: string;
  let csrfB: string;
  let csrfReviewer: string;
  let csrfFinance: string;
  let csrfGate: string;

  const state = (agent: SuperAgentTest, csrf: string) =>
    (method: 'post' | 'patch' | 'delete', path: string) => agent[method](path).set('x-csrf-token', csrf);

  async function createStaff(email: string, role: Role): Promise<void> {
    await prisma.user.create({
      data: {
        email,
        displayName: role,
        passwordHash: await argon2.hash('Str0ng-password-123'),
        role,
      },
    });
  }

  async function login(agent: SuperAgentTest, email: string): Promise<string> {
    const response = await agent
      .post('/api/auth/login')
      .send({ email, password: 'Str0ng-password-123' })
      .expect(200);
    return response.body.csrfToken as string;
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.TICKET_SECRET = process.env.TICKET_SECRET ?? 'test-secret-at-least-32-characters-long';
    process.env.STORAGE_PATH = process.env.STORAGE_PATH ?? '/tmp/jrc-e2e-uploads';

    prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.auditLog.deleteMany();
    await prisma.emailOutbox.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.document.deleteMany();
    await prisma.teamMember.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.session.deleteMany();
    await prisma.competition.deleteMany();
    await prisma.user.deleteMany();

    const competition = await prisma.competition.create({
      data: {
        slug: 'wacky-rally-line-follower-mikro',
        name: 'Chariot Line',
        level: 'Umum',
        discipline: 'Line Follower Mikro',
        eventId: 'JRC-XIV-2026',
        eventName: 'JRC XIV 2026',
        fee: 250000,
        registrationOpenAt: new Date('2020-01-01T00:00:00.000Z'),
        registrationDeadline: new Date('2026-12-01T00:00:00.000Z'),
      },
    });
    competitionId = competition.id;
    eventId = competition.eventId;

    await createStaff('reviewer@example.test', Role.REGISTRATION_REVIEWER);
    await createStaff('finance@example.test', Role.FINANCE);
    await createStaff('paid-teams@example.test', Role.PAID_TEAM_VIEWER);
    await createStaff('super-admin@example.test', Role.SUPER_ADMIN);
    await createStaff('gate@example.test', Role.GATE_STAFF);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    configureApp(app);
    await app.init();

    participantA = request.agent(app.getHttpServer());
    participantB = request.agent(app.getHttpServer());
    reviewer = request.agent(app.getHttpServer());
    finance = request.agent(app.getHttpServer());
    paidTeamViewer = request.agent(app.getHttpServer());
    superAdmin = request.agent(app.getHttpServer());
    gate = request.agent(app.getHttpServer());

    csrfA = (
      await participantA
        .post('/api/auth/register')
        .send({ email: 'a@example.test', displayName: 'Participant A', password: 'Str0ng-password-123' })
        .expect(201)
    ).body.csrfToken as string;
    csrfB = (
      await participantB
        .post('/api/auth/register')
        .send({ email: 'b@example.test', displayName: 'Participant B', password: 'Str0ng-password-123' })
        .expect(201)
    ).body.csrfToken as string;
    await prisma.user.updateMany({
      where: { email: { in: ['a@example.test', 'b@example.test'] } },
      data: { emailVerifiedAt: new Date() },
    });
    csrfReviewer = await login(reviewer, 'reviewer@example.test');
    csrfFinance = await login(finance, 'finance@example.test');
    await login(paidTeamViewer, 'paid-teams@example.test');
    await login(superAdmin, 'super-admin@example.test');
    csrfGate = await login(gate, 'gate@example.test');
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it('enforces authentication, ownership, RBAC, and CSRF', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(200).expect(({ body }: Response) => {
      expect(body).toEqual({ user: null });
    });
    await request(app.getHttpServer()).get('/api/registrations').expect(401);
    await participantA.get('/api/auth/me').expect(200).expect(({ body }: Response) => {
      expect(body.user.email).toBe('a@example.test');
      expect(body.user.passwordHash).toBeUndefined();
    });
    await request(app.getHttpServer())
      .get('/api/competitions')
      .expect(200)
      .expect(({ body }: Response) => {
        expect(body).toEqual([
          expect.objectContaining({
            slug: 'wacky-rally-line-follower-mikro',
            name: 'Chariot Line',
            level: 'Umum',
            discipline: 'Line Follower Mikro',
          }),
        ]);
      });

    const cookieName = process.env.COOKIE_NAME?.trim() || SESSION_COOKIE_NAME;
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `${cookieName}=invalid-session-token`)
      .expect(200)
      .expect(({ body }: Response) => expect(body).toEqual({ user: null }));

    const expiredToken = 'expired-session-token';
    const participant = await prisma.user.findUniqueOrThrow({
      where: { email: 'a@example.test' },
    });
    await prisma.session.create({
      data: {
        userId: participant.id,
        tokenHash: hashToken(expiredToken),
        csrfHash: hashToken('expired-csrf-token'),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `${cookieName}=${expiredToken}`)
      .expect(200)
      .expect(({ body }: Response) => expect(body).toEqual({ user: null }));

    const created = await state(participantA, csrfA)('post', '/api/registrations')
      .send({ competitionId, teamName: '=CMD()', institution: 'PENS' })
      .expect(201);
    registrationId = created.body.id as string;

    await participantB.get(`/api/registrations/${registrationId}`).expect(404);
    await state(participantB, csrfB)('patch', `/api/registrations/${registrationId}`)
      .send({ teamName: 'Stolen' })
      .expect(404);
    await participantA.post(`/api/registrations/${registrationId}/members`).send({ name: 'No CSRF' }).expect(403);
    await participantA.get('/api/admin/registrations').expect(403);

    const leader = await state(participantA, csrfA)(
      'post',
      `/api/registrations/${registrationId}/members`,
    )
      .send({
        name: 'Alice',
        studentId: 'NRP-001',
        email: 'alice@example.test',
        phone: '+62 812 3456 7890',
      })
      .expect(201);
    expect(leader.body).toMatchObject({
      name: 'Alice',
      studentId: 'NRP-001',
      role: 'LEADER',
      email: 'alice@example.test',
      phone: '+62 812 3456 7890',
    });

    await state(participantA, csrfA)(
      'post',
      `/api/registrations/${registrationId}/members`,
    )
      .send({ name: 'Duplicate Leader', role: 'LEADER' })
      .expect(400);

    const member = await state(participantA, csrfA)(
      'post',
      `/api/registrations/${registrationId}/members`,
    )
      .send({ name: 'Bob' })
      .expect(201);
    expect(member.body).toMatchObject({
      name: 'Bob',
      role: 'MEMBER',
      email: null,
      phone: null,
    });
    await state(participantA, csrfA)(
      'post',
      `/api/registrations/${registrationId}/members`,
    )
      .send({ name: 'Coach', role: 'SUPERVISOR' })
      .expect(201);

    await state(participantA, csrfA)(
      'post',
      `/api/registrations/${registrationId}/members`,
    )
      .send({ name: 'Invalid Role', role: 'CAPTAIN' })
      .expect(400);
    await state(participantA, csrfA)(
      'post',
      `/api/registrations/${registrationId}/members`,
    )
      .send({ name: 'Invalid Email', email: 'not-an-email' })
      .expect(400);
    await state(participantA, csrfA)(
      'post',
      `/api/registrations/${registrationId}/members`,
    )
      .send({ name: 'Invalid Phone', phone: 12345 })
      .expect(400);

    const participantRegistration = await participantA
      .get(`/api/registrations/${registrationId}`)
      .expect(200);
    expect(participantRegistration.body.competition).toMatchObject({
      slug: 'wacky-rally-line-follower-mikro',
      name: 'Chariot Line',
      level: 'Umum',
      discipline: 'Line Follower Mikro',
    });
    expect(participantRegistration.body.members).toEqual([
      expect.objectContaining({ role: 'LEADER', email: 'alice@example.test' }),
      expect.objectContaining({ role: 'MEMBER', email: null, phone: null }),
      expect.objectContaining({ role: 'SUPERVISOR', name: 'Coach' }),
    ]);

    await state(participantA, csrfA)(
      'post',
      `/api/registrations/${registrationId}/submit`,
    )
      .expect(400)
      .expect(({ body }: Response) =>
        expect(body.message).toBe(
          'All required document categories must be uploaded before submission',
        ),
      );

    for (const category of [
      'RECOMMENDATION_LETTER',
      'IDENTITY_CARD',
      'REGISTRATION_FORM',
      'TEAM_PHOTO',
      'TWIBBON_PROOF',
    ]) {
      await state(participantA, csrfA)(
        'post',
        `/api/registrations/${registrationId}/documents`,
      )
        .field('category', category)
        .attach('file', Buffer.from('%PDF-test'), {
          filename: `${category.toLowerCase()}.pdf`,
          contentType: 'application/pdf',
        })
        .expect(201);
    }

    const portraitPng = Buffer.from(
      '89504e470d0a1a0a0000000d494844520000000300000004080200000000000000',
      'hex',
    );
    for (const [subjectName, subjectRole] of [
      ['Alice', 'PARTICIPANT'],
      ['Bob', 'PARTICIPANT'],
      ['Coach', 'SUPERVISOR'],
    ] as const) {
      await state(participantA, csrfA)(
        'post',
        `/api/registrations/${registrationId}/documents`,
      )
        .field('category', 'MEMBER_PHOTO')
        .field('subjectName', subjectName)
        .field('subjectRole', subjectRole)
        .attach('file', portraitPng, {
          filename: `${subjectName.toLowerCase()}.png`,
          contentType: 'image/png',
        })
        .expect(201);
    }

    await state(participantA, csrfA)(
      'post',
      `/api/registrations/${registrationId}/submit`,
    ).expect(201);
    expect(
      await prisma.emailOutbox.count({
        where: { to: 'a@example.test', subject: { contains: 'telah dikirim' } },
      }),
    ).toBe(1);
  });

  it('enforces review transitions and atomically creates a manual invoice', async () => {
    await state(reviewer, csrfReviewer)('post', `/api/admin/registrations/${registrationId}/review`)
      .send({ status: 'APPROVED' })
      .expect(400);
    await state(reviewer, csrfReviewer)('post', `/api/admin/registrations/${registrationId}/review`)
      .send({ status: 'UNDER_REVIEW' })
      .expect(201);
    const approved = await state(reviewer, csrfReviewer)('post', `/api/admin/registrations/${registrationId}/review`)
      .send({ status: 'APPROVED' })
      .expect(201);
    expect(approved.body.status).toBe('APPROVED');

    const invoice = await participantA.get(`/api/registrations/${registrationId}/invoice`).expect(200);
    invoiceId = invoice.body.id as string;
    expect(invoice.body.paymentStatus).toBe('UNPAID');
    expect(invoice.body.instructions.provider).toBe('MANUAL');
    const approvalNotice = await prisma.emailOutbox.findFirstOrThrow({
      where: { subject: { contains: 'Invoice pendaftaran' } },
    });
    expect(approvalNotice.body).toMatch(/^jrc-email-v1\./);
  });

  it('keeps proof pending, restricts finance verification, and issues only after paid', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    await state(participantA, csrfA)('post', `/api/invoices/${invoiceId}/proof`)
      .attach('file', png, { filename: 'proof.png', contentType: 'image/png' })
      .expect(201)
      .expect(({ body }: Response) => expect(body.paymentStatus).toBe('PENDING_VERIFICATION'));
    expect(
      await prisma.emailOutbox.count({
        where: { subject: { contains: 'Bukti pembayaran' } },
      }),
    ).toBeGreaterThanOrEqual(1);
    await participantA.get(`/api/registrations/${registrationId}/ticket`).expect(409);
    await state(reviewer, csrfReviewer)('post', `/api/admin/invoices/${invoiceId}/verify`)
      .send({ status: 'PAID', reason: 'Not finance' })
      .expect(403);
    await state(finance, csrfFinance)('post', `/api/admin/invoices/${invoiceId}/verify`)
      .send({ status: 'PAID', reason: 'Matched bank statement reference 123' })
      .expect(201);

    const ticket = await participantA.get(`/api/registrations/${registrationId}/ticket`).expect(200);
    expect(ticket.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ticket.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(JSON.stringify(ticket.body)).not.toContain('a@example.test');
    const paidNotice = await prisma.emailOutbox.findFirstOrThrow({
      where: { subject: { contains: 'terverifikasi' } },
    });
    expect(paidNotice.body).toMatch(/^jrc-email-v1\./);
  });

  it('limits the paid-team viewer to paid details and scoped private files', async () => {
    const response = await paidTeamViewer
      .get('/api/admin/paid-teams')
      .expect('Cache-Control', 'private, no-store')
      .expect(200);
    expect(response.body).toEqual({
      items: [
        {
          id: registrationId,
          registrationNumber: expect.any(String),
          teamName: '=CMD()',
          institution: 'PENS',
          competition: {
            id: competitionId,
            name: 'Chariot Line',
            level: 'Umum',
            discipline: 'Line Follower Mikro',
          },
          verifiedAt: expect.any(String),
        },
      ],
      page: 1,
      pageSize: 50,
      hasNextPage: false,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /email|phone|member|proof|amount|invoice|owner|studentId/i,
    );

    const detail = await paidTeamViewer
      .get(`/api/admin/paid-teams/${registrationId}`)
      .expect('Cache-Control', 'private, no-store')
      .expect(200);
    expect(detail.body).toMatchObject({
      id: registrationId,
      teamName: '=CMD()',
      institution: 'PENS',
      owner: { displayName: 'Participant A', email: 'a@example.test' },
      members: [
        expect.objectContaining({ name: 'Alice', photo: expect.objectContaining({ id: expect.any(String) }) }),
        expect.objectContaining({ name: 'Bob', photo: expect.objectContaining({ id: expect.any(String) }) }),
        expect.objectContaining({ name: 'Coach', photo: expect.objectContaining({ id: expect.any(String) }) }),
      ],
      payment: {
        invoiceNumber: expect.any(String),
        amount: 250000,
        currency: 'IDR',
        verifiedAt: expect.any(String),
        proof: expect.objectContaining({ originalName: 'proof.png' }),
      },
    });
    expect(JSON.stringify(detail.body)).not.toMatch(
      /storageKey|verificationReason|verifiedBy|instructions/i,
    );

    const photoId = detail.body.members[0].photo.id as string;
    await paidTeamViewer
      .get(`/api/admin/paid-teams/${registrationId}/photos/${photoId}`)
      .expect('Cache-Control', 'private, no-store')
      .expect('Cross-Origin-Resource-Policy', 'same-site')
      .expect('Content-Disposition', /^inline;/)
      .expect(200);
    await paidTeamViewer
      .get(`/api/admin/paid-teams/${registrationId}/photos/${photoId}?download=true`)
      .expect('Content-Disposition', /^attachment;/)
      .expect(200);
    await paidTeamViewer
      .get(`/api/admin/paid-teams/${registrationId}/payment-proof`)
      .expect('Cache-Control', 'private, no-store')
      .expect('Cross-Origin-Resource-Policy', 'same-site')
      .expect('Content-Disposition', /^inline;/)
      .expect(200);
    await paidTeamViewer
      .get(`/api/admin/paid-teams/${registrationId}/payment-proof?download=true`)
      .expect('Content-Disposition', /^attachment;/)
      .expect(200);

    await finance.get('/api/admin/paid-teams').expect(403);
    await reviewer.get('/api/admin/paid-teams').expect(403);
    await paidTeamViewer.get('/api/admin/finance/invoices').expect(403);
    await paidTeamViewer.get('/api/admin/registrations').expect(403);
    await superAdmin.get('/api/admin/paid-teams').expect(200);
    await superAdmin.get(`/api/admin/paid-teams/${registrationId}`).expect(200);
  });

  it('rejects forged tokens and minimizes public verification output', async () => {
    const ticket = await participantA.get(`/api/registrations/${registrationId}/ticket`).expect(200);
    const token = ticket.body.token as string;
    await request(app.getHttpServer())
      .post('/api/tickets/verify')
      .send({ token: `${token.slice(0, -1)}x`, eventId })
      .expect(200)
      .expect({ result: 'UNKNOWN' });
    const verified = await request(app.getHttpServer())
      .post('/api/tickets/verify')
      .send({ token, eventId })
      .expect(200);
    expect(Object.keys(verified.body).sort()).toEqual(
      ['competitionName', 'eventId', 'eventName', 'institution', 'registrationNumber', 'result', 'teamName'].sort(),
    );
    expect(JSON.stringify(verified.body)).not.toMatch(/email|phone|member|document|payment/i);
    await state(gate, csrfGate)('post', '/api/gate/inspect')
      .send({ token, eventId: 'WRONG-EVENT' })
      .expect(201)
      .expect(({ body }: Response) => expect(body.result).toBe('WRONG_EVENT'));
  });

  it('atomically permits exactly one concurrent redemption', async () => {
    const token = (await participantA.get(`/api/registrations/${registrationId}/ticket`).expect(200)).body.token as string;
    const memberIds = (
      await participantA.get(`/api/registrations/${registrationId}`).expect(200)
    ).body.members.map((member: { id: string }) => member.id);
    const [first, second] = await Promise.all([
      state(gate, csrfGate)('post', '/api/gate/redeem').send({ token, eventId, memberIds }),
      state(gate, csrfGate)('post', '/api/gate/redeem').send({ token, eventId, memberIds }),
    ]);
    expect([first.status, second.status]).toEqual([201, 201]);
    expect([first.body.result, second.body.result].sort()).toEqual(['ALREADY_CHECKED_IN', 'CHECKED_IN']);
    const duplicate = [first.body, second.body].find(
      (body) => body.result === 'ALREADY_CHECKED_IN',
    );
    expect(duplicate).toMatchObject({
      checkedInAt: expect.any(String),
      checkedInBy: { id: expect.any(String), displayName: expect.any(String) },
    });
  });

  it('records audit history and exports a native XLSX workbook', async () => {
    const xlsx = await reviewer
      .get('/api/admin/registrations/export.xlsx')
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(xlsx.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(xlsx.headers['content-disposition']).toContain('registrations-jrc-xiv.xlsx');
    expect(Buffer.isBuffer(xlsx.body)).toBe(true);
    expect(xlsx.body.subarray(0, 2).toString()).toBe('PK');
    const actions = (await prisma.auditLog.findMany({ select: { action: true } })).map((entry) => entry.action);
    expect(actions).toContain('REGISTRATION_APPROVED');
    expect(actions).toContain('PAYMENT_MARKED_PAID');
    expect(actions).toContain('TICKET_CHECKED_IN');
  });

  it('invalidates the server-side session on logout', async () => {
    await state(participantB, csrfB)('post', '/api/auth/logout').expect(201);
    await participantB.get('/api/auth/me').expect(200).expect(({ body }: Response) => {
      expect(body).toEqual({ user: null });
    });
    await participantB.get('/api/registrations').expect(401);
  });
});
