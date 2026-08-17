import { describe, expect, it } from 'vitest';
import { LocalPortalRepository } from './portal';

const createTestStorage = (): Storage => {
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

describe('LocalPortalRepository', () => {
  it('starts with seeded registrations and no active demo session', () => {
    const repository = new LocalPortalRepository(createTestStorage());

    expect(repository.getSession()).toBeNull();
    expect(repository.listRegistrations()).toHaveLength(4);
  });

  it('persists and clears a demo session', () => {
    const storage = createTestStorage();
    const repository = new LocalPortalRepository(storage);

    repository.startSession({ role: 'participant', name: 'Marcus', registrationId: 'reg-aurora' });
    expect(new LocalPortalRepository(storage).getSession()).toEqual({
      role: 'participant', name: 'Marcus', registrationId: 'reg-aurora',
    });

    repository.endSession();
    expect(repository.getSession()).toBeNull();
  });

  it('saves a participant draft without changing its status', () => {
    const repository = new LocalPortalRepository(createTestStorage());

    const saved = repository.saveDraft('reg-aurora', {
      teamName: 'Aurora Roma',
      institution: 'SMAN 1 Surabaya',
      competitionId: 'soccer',
      members: [{
        id: 'member-1', name: 'Aurelia', email: 'aurelia@example.com',
        phone: '08123456789', role: 'leader',
      }],
      documents: [{ name: 'kartu-pelajar.pdf', size: 1200, type: 'application/pdf', lastModified: 1 }],
    });

    expect(saved.status).toBe('draft');
    expect(repository.getRegistration('reg-aurora')?.teamName).toBe('Aurora Roma');
    expect(repository.getRegistration('reg-aurora')?.documents[0].name).toBe('kartu-pelajar.pdf');
  });

  it('submits a complete draft and locks participant editing', () => {
    const repository = new LocalPortalRepository(createTestStorage());
    const completeDraft = {
      teamName: 'Aurora Mechanica', institution: 'SMAN 1 Surabaya', competitionId: 'soccer',
      members: [{
        id: 'leader', name: 'Livia', email: 'livia@example.com', phone: '0812345678', role: 'leader' as const,
      }],
      documents: [{ name: 'kartu.pdf', size: 100, type: 'application/pdf', lastModified: 1 }],
    };

    repository.saveDraft('reg-aurora', completeDraft);
    expect(repository.submitRegistration('reg-aurora').status).toBe('submitted');
    expect(() => repository.saveDraft('reg-aurora', completeDraft)).toThrow('tidak dapat diedit');
  });

  it('records an admin review and only allows valid status transitions', () => {
    const repository = new LocalPortalRepository(createTestStorage());

    const reviewed = repository.reviewRegistration(
      'reg-victoria', 'under_review', 'Dokumen sedang diperiksa.', 'Panitia JRC',
    );

    expect(reviewed.status).toBe('under_review');
    expect(reviewed.reviews.at(-1)).toMatchObject({
      note: 'Dokumen sedang diperiksa.', author: 'Panitia JRC', status: 'under_review',
    });
    expect(() => repository.reviewRegistration('reg-victoria', 'draft', 'Mundur')).toThrow('Transisi status');
  });

  it('filters registrations by status, category, and text query', () => {
    const repository = new LocalPortalRepository(createTestStorage());

    expect(repository.listRegistrations({ status: 'submitted' }).map((item) => item.id)).toEqual(['reg-victoria']);
    expect(repository.listRegistrations({ competitionId: 'sumo' }).map((item) => item.id)).toEqual(['reg-roma']);
    expect(repository.listRegistrations({ query: 'pens' }).map((item) => item.id)).toEqual(['reg-legion']);
  });

  it('exports filtered registrations as formula-safe CSV', () => {
    const repository = new LocalPortalRepository(createTestStorage());
    const draft = repository.getRegistration('reg-aurora')!;
    repository.saveDraft('reg-aurora', { ...draft, teamName: '=HYPERLINK("bad")' });

    const csv = repository.exportRegistrationsCsv({ status: 'draft' });

    expect(csv).toContain('ID,Tim,Institusi,Kategori,Status,Anggota,Diperbarui');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain('\r\nreg-victoria,');
  });

  it('recovers seeded data when persisted storage is corrupt or outdated', () => {
    const corruptStorage = createTestStorage();
    corruptStorage.setItem('jrc-xiv.portal.v1', '{bad json');
    expect(new LocalPortalRepository(corruptStorage).listRegistrations()).toHaveLength(4);

    const outdatedStorage = createTestStorage();
    outdatedStorage.setItem('jrc-xiv.portal.v1', JSON.stringify({ version: 0, registrations: [] }));
    expect(new LocalPortalRepository(outdatedStorage).listRegistrations()).toHaveLength(4);

    const malformedStorage = createTestStorage();
    malformedStorage.setItem('jrc-xiv.portal.v1', JSON.stringify({ version: 1, registrations: [{ id: 4 }] }));
    expect(new LocalPortalRepository(malformedStorage).getSession()).toBeNull();
    expect(new LocalPortalRepository(malformedStorage).listRegistrations()).toHaveLength(4);

    const nestedCorruptStorage = createTestStorage();
    nestedCorruptStorage.setItem('jrc-xiv.portal.v1', JSON.stringify({
      version: 1,
      session: null,
      registrations: [{
        id: 'bad', teamName: 'Bad', institution: 'Bad', competitionId: 'sumo', status: 'draft',
        updatedAt: '2026-01-01', members: [{ bad: true }], documents: [], reviews: [],
      }],
    }));
    expect(new LocalPortalRepository(nestedCorruptStorage).listRegistrations()).toHaveLength(4);
  });

  it('keeps the local prototype usable when browser storage throws', () => {
    const blockedStorage: Storage = {
      get length() { throw new DOMException('Blocked', 'SecurityError'); },
      clear: () => { throw new DOMException('Blocked', 'SecurityError'); },
      getItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
      key: () => { throw new DOMException('Blocked', 'SecurityError'); },
      removeItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
      setItem: () => { throw new DOMException('Full', 'QuotaExceededError'); },
    };

    const repository = new LocalPortalRepository(blockedStorage);
    repository.startSession({ role: 'participant', name: 'Fallback Legion', registrationId: 'reg-aurora' });

    expect(repository.getSession()?.name).toBe('Fallback Legion');
    expect(repository.listRegistrations()).toHaveLength(4);
  });
});
