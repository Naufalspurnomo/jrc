import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PortalShell } from '../../components/portal/PortalShell';
import { useAuth } from '../../features/auth/AuthProvider';
import {
  ApiError,
  REVIEW_REASON_CATEGORY_LABELS,
  registrationApi,
  type CompetitionRecord,
  type RegistrationApi,
  type RegistrationDocumentRecord,
  type RegistrationState,
  type ReviewReasonCategory,
  type TeamMemberRecord,
} from '../../features/registration/api';
import {
  DOCUMENT_ACCEPT_ATTRIBUTE,
  describeDocumentUploadError,
  formatBytes,
  isAcceptedDocumentType,
} from '../../features/registration/documentErrors';
import { describeGaps, registrationGaps } from '../../features/registration/readiness';
import { useAutosave, type AutosaveState } from '../../hooks/useAutosave';

interface PortalRegistrationPageProps {
  api?: RegistrationApi;
}

interface MemberDraft {
  id?: string;
  name: string;
  studentId: string;
  email: string;
  phone: string;
}

const emptyMember = (): MemberDraft => ({ name: '', studentId: '', email: '', phone: '' });

const editableStatuses: RegistrationState[] = ['DRAFT', 'REVISION_REQUESTED'];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_TEAM_MEMBERS = 3;

const documentCategoryLabels: Record<string, string> = {
  RECOMMENDATION_LETTER: 'Surat Rekomendasi',
  IDENTITY_CARD: 'Kartu Identitas',
  REGISTRATION_FORM: 'Formulir Pendaftaran',
  TEAM_PHOTO: 'Foto Tim',
  TWIBBON_PROOF: 'Bukti Twibbon',
  MEMBER_PHOTO: 'Foto Anggota',
};

function formatDocumentType(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'JPEG';
  if (mimeType === 'image/png') return 'PNG';
  return 'Berkas';
}

function isPreviewableImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function autosaveLabel(state: AutosaveState, savedAt: Date | null): string {
  switch (state) {
    case 'pending':
      return 'Perubahan belum tersimpan…';
    case 'saving':
      return 'Menyimpan…';
    case 'saved':
      return savedAt ? `Tersimpan ${formatClock(savedAt)}` : 'Tersimpan';
    case 'error':
      return 'Gagal menyimpan otomatis. Perubahan tersimpan saat Anda menekan Simpan.';
    default:
      return 'Perubahan tersimpan otomatis.';
  }
}

export default function PortalRegistrationPage({ api = registrationApi }: PortalRegistrationPageProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  // While the session probe is in flight the user object is still null, so
  // treating that as "email not verified" would send a participant who *is*
  // verified to the verification page. Wait for the probe to settle.
  const emailVerified = user?.emailVerified === true;
  const verificationKnown = !authLoading;
  const { registrationId: routeRegistrationId } = useParams<{ registrationId: string }>();
  const existingRegistrationId = routeRegistrationId && routeRegistrationId !== 'baru'
    ? routeRegistrationId
    : undefined;

  const [registrationId, setRegistrationId] = useState(existingRegistrationId);
  const [competitions, setCompetitions] = useState<CompetitionRecord[]>([]);
  const [competitionId, setCompetitionId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [institution, setInstitution] = useState('');
  const [phone, setPhone] = useState('');
  const [leader, setLeader] = useState<MemberDraft>(emptyMember);
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [supervisor, setSupervisor] = useState<MemberDraft>(emptyMember);
  const [status, setStatus] = useState<RegistrationState>('DRAFT');
  const [documents, setDocuments] = useState<RegistrationDocumentRecord[]>([]);
  const [reviewReasonCategory, setReviewReasonCategory] = useState<ReviewReasonCategory | null>(null);
  const [reviewReasonComment, setReviewReasonComment] = useState('');
  const [documentCategory, setDocumentCategory] = useState('RECOMMENDATION_LETTER');
  const [photoSubjectName, setPhotoSubjectName] = useState('');
  const [photoSubjectRole, setPhotoSubjectRole] = useState<'PARTICIPANT' | 'SUPERVISOR'>('PARTICIPANT');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingMemberIds, setRemovingMemberIds] = useState<string[]>([]);
  const [removingDocumentIds, setRemovingDocumentIds] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [created, setCreated] = useState(Boolean(existingRegistrationId));
  const [highlightedGaps, setHighlightedGaps] = useState<string[]>([]);

  const competitionCardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const createInFlight = useRef(false);
  // Ids hydrated during this session. A draft we just created is added *before*
  // the URL changes, so that route change does not refetch and clobber whatever
  // the participant has typed in the meantime. The id present at first render is
  // deliberately absent, so the initial load still fetches it.
  const hydratedIds = useRef<Set<string>>(new Set());

  // Snapshot of the values the autosave effect should react to.
  const formSnapshot = useMemo(
    () => JSON.stringify({ teamName, institution, phone, leader, members, supervisor }),
    [teamName, institution, phone, leader, members, supervisor],
  );
  const lastSavedSnapshot = useRef(formSnapshot);

  const editable = editableStatuses.includes(status);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const shouldHydrate = Boolean(
          existingRegistrationId && !hydratedIds.current.has(existingRegistrationId),
        );

        const [competitionRecords, existingRegistration] = await Promise.all([
          api.competitions.list(),
          shouldHydrate && existingRegistrationId
            ? api.registrations.get(existingRegistrationId)
            : Promise.resolve(null),
        ]);

        if (!active) return;
        setCompetitions(competitionRecords);

        if (existingRegistration) {
          if (existingRegistrationId) hydratedIds.current.add(existingRegistrationId);
          setRegistrationId(existingRegistration.id);
          setCompetitionId(existingRegistration.competitionId);
          setTeamName(existingRegistration.teamName);
          setInstitution(existingRegistration.institution);
          setPhone(existingRegistration.phone ?? '');
          setStatus(existingRegistration.status);
          setDocuments(existingRegistration.documents ?? []);
          setReviewReasonCategory(existingRegistration.reviewReasonCategory ?? null);
          setReviewReasonComment(existingRegistration.reviewReasonComment ?? '');
          setCreated(true);

          const existingMembers = existingRegistration.members ?? [];
          const existingLeader = existingMembers.find((member) => member.role === 'LEADER');
          const toDraft = (member: TeamMemberRecord): MemberDraft => ({
            id: member.id,
            name: member.name,
            studentId: member.studentId ?? '',
            email: member.email ?? '',
            phone: member.phone ?? '',
          });

          setLeader(existingLeader ? toDraft(existingLeader) : emptyMember());
          setMembers(existingMembers.filter((member) => member.role === 'MEMBER').map(toDraft));
          const existingSupervisor = existingMembers.find((member) => member.role === 'SUPERVISOR');
          setSupervisor(existingSupervisor ? toDraft(existingSupervisor) : emptyMember());
          lastSavedSnapshot.current = JSON.stringify({
            teamName: existingRegistration.teamName,
            institution: existingRegistration.institution,
            phone: existingRegistration.phone ?? '',
            leader: existingLeader ? toDraft(existingLeader) : emptyMember(),
            members: existingMembers.filter((member) => member.role === 'MEMBER').map(toDraft),
            supervisor: existingSupervisor ? toDraft(existingSupervisor) : emptyMember(),
          });
        }
      } catch {
        if (active) setLoadError('Pendaftaran gagal dimuat. Silakan coba lagi.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [api, existingRegistrationId, loadAttempt]);

  // Object URL for the staged file preview; revoked whenever the file changes.
  useEffect(() => {
    if (!documentFile || !isPreviewableImage(documentFile.type)) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(documentFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [documentFile]);

  const persist = useCallback(async () => {
    if (!registrationId) return;

    // Snapshot of exactly what this run sends. Marking *this* (not the latest
    // keystrokes) as saved keeps the autosave effect honest: anything typed
    // while the request was in flight still differs and gets its own save.
    const snapshotBeingSaved = JSON.stringify({ teamName, institution, phone, leader, members, supervisor });

    const registration = await api.registrations.update(registrationId, {
      teamName: teamName.trim(),
      institution: institution.trim(),
      phone: phone.trim(),
    });
    setStatus(registration.status);

    const people = [
      { person: leader, role: 'LEADER' as const },
      ...members.map((person) => ({ person, role: 'MEMBER' as const })),
      { person: supervisor, role: 'SUPERVISOR' as const },
    ];
    for (const [personIndex, { person, role }] of people.entries()) {
      const name = person.name.trim();
      if (!name) continue;

      // The API validates email/phone when present, so optional fields are
      // omitted rather than sent as empty strings (which fail validation).
      const studentId = person.studentId.trim();
      const email = person.email.trim();
      const phone = person.phone.trim();

      if (person.id) {
        await api.registrations.updateMember(registration.id, person.id, {
          name,
          ...(studentId ? { studentId } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
        });
        continue;
      }

      const createdMember = await api.registrations.addMember(registration.id, {
        name,
        role,
        ...(studentId ? { studentId } : {}),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      });
      if (personIndex === 0) {
        setLeader((current) => ({ ...current, id: createdMember.id }));
      } else if (role === 'MEMBER') {
        setMembers((current) => current.map((member, memberIndex) => (
          memberIndex === personIndex - 1 ? { ...member, id: createdMember.id } : member
        )));
      } else {
        setSupervisor((current) => ({ ...current, id: createdMember.id }));
      }
    }

    lastSavedSnapshot.current = snapshotBeingSaved;
  }, [api, registrationId, teamName, institution, phone, leader, members, supervisor]);

  const autosave = useAutosave({ save: persist, enabled: editable && created });
  const { schedule: scheduleAutosave, flush: flushAutosave } = autosave;

  // Autosave once the form settles. Skipped while the values match the last save.
  useEffect(() => {
    if (!editable || !created || !registrationId) return;
    if (formSnapshot === lastSavedSnapshot.current) return;
    scheduleAutosave();
  }, [created, editable, formSnapshot, registrationId, scheduleAutosave]);

  // Flush pending edits when the participant leaves the page.
  useEffect(() => {
    const onUnload = () => {
      void flushAutosave();
    };
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
    };
  }, [flushAutosave]);

  const createDraft = useCallback(async (selectedCompetitionId: string) => {
    if (createInFlight.current) return;
    createInFlight.current = true;
    setCreatingDraft(true);
    setError('');
    try {
      const registration = await api.registrations.create({ competitionId: selectedCompetitionId });
      setRegistrationId(registration.id);
      setStatus(registration.status);
      setCreated(true);
      lastSavedSnapshot.current = formSnapshot;
      // Mark it hydrated first: the route change below re-runs the loader, and
      // without this it would refetch and overwrite what the user has typed.
      hydratedIds.current.add(registration.id);
      // The draft id lives in the URL so a reload rehydrates the same draft
      // instead of silently creating a second one.
      navigate(`/portal/pendaftaran/${registration.id}`, { replace: true });
    } catch {
      setError('Draft gagal dibuat. Periksa koneksi lalu pilih kompetisi sekali lagi.');
      setCompetitionId('');
    } finally {
      createInFlight.current = false;
      setCreatingDraft(false);
    }
  }, [api, formSnapshot, navigate]);

  const selectCompetition = (nextCompetitionId: string) => {
    if (!editable) return;
    setCompetitionId(nextCompetitionId);
    if (!registrationId) {
      void createDraft(nextCompetitionId);
      return;
    }
    void api.registrations
      .update(registrationId, { competitionId: nextCompetitionId })
      .catch(() => setError('Kompetisi gagal disimpan. Silakan pilih ulang.'));
  };

  const selectedCompetitionIndex = competitions.findIndex((competition) => competition.id === competitionId);
  const tabbableCompetitionIndex = selectedCompetitionIndex >= 0 ? selectedCompetitionIndex : 0;

  const handleCompetitionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    if (!editable || competitions.length === 0) return;

    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % competitions.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + competitions.length) % competitions.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = competitions.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    selectCompetition(competitions[nextIndex].id);
    // Selecting a competition can mount the draft form and replace the card
    // node. Focus after React commits so keyboard navigation keeps its roving
    // tab stop across that render boundary.
    requestAnimationFrame(() => competitionCardRefs.current[nextIndex]?.focus());
  };

  const updateMember = (index: number, field: keyof Omit<MemberDraft, 'id'>, value: string) => {
    setMembers((current) => current.map((member, memberIndex) => (
      memberIndex === index ? { ...member, [field]: value } : member
    )));
  };

  const removeMember = async (member: MemberDraft, index: number) => {
    if (!member.id) {
      setMembers((current) => current.filter((_, memberIndex) => memberIndex !== index));
      return;
    }
    if (!registrationId) {
      setError('Anggota gagal dihapus. Silakan coba lagi.');
      return;
    }

    setRemovingMemberIds((current) => [...current, member.id as string]);
    setMessage('');
    setError('');
    try {
      await api.registrations.removeMember(registrationId, member.id);
      setMembers((current) => current.filter((candidate) => candidate.id !== member.id));
    } catch {
      setError('Anggota gagal dihapus. Silakan coba lagi.');
    } finally {
      setRemovingMemberIds((current) => current.filter((memberId) => memberId !== member.id));
    }
  };

  const saveNow = async () => {
    if (!editable || !registrationId) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await flushAutosave();
      setMessage('Perubahan tersimpan.');
    } catch {
      setError('Pendaftaran gagal disimpan. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const acceptDocumentFile = (file: File | null) => {
    setDocumentFile(file);
    if (file && !isAcceptedDocumentType(file.type)) {
      setError('Format dokumen harus PDF, JPEG, atau PNG.');
      return;
    }
    setError('');
  };

  const uploadDocument = async () => {
    if (!registrationId) {
      setError('Pilih kompetisi terlebih dahulu.');
      return;
    }
    if (!documentCategory || !documentFile) {
      setError('Pilih kategori dan berkas dokumen.');
      return;
    }
    if (!isAcceptedDocumentType(documentFile.type)) {
      setError('Format dokumen harus PDF, JPEG, atau PNG.');
      return;
    }
    if (documentFile.size > MAX_UPLOAD_BYTES) {
      setError(`Berkas "${documentFile.name}" berukuran ${formatBytes(documentFile.size)}, melebihi batas ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    if (!editable) {
      setError('Pendaftaran tidak dapat diubah pada status saat ini.');
      return;
    }

    setUploading(true);
    setMessage('');
    setError('');

    try {
      const formData = new FormData();
      formData.append('category', documentCategory);
      if (documentCategory === 'MEMBER_PHOTO') {
        if (!photoSubjectName.trim()) {
          setError('Nama lengkap pemilik foto wajib diisi.');
          return;
        }
        if (!['image/jpeg', 'image/png'].includes(documentFile.type)) {
          setError('Foto formal 3x4 harus berformat JPEG atau PNG.');
          return;
        }
        formData.append('subjectName', photoSubjectName.trim());
        formData.append('subjectRole', photoSubjectRole);
      }
      formData.append('file', documentFile);
      await api.registrations.uploadDocument(registrationId, formData);
      const refreshedRegistration = await api.registrations.get(registrationId);
      setDocuments(refreshedRegistration.documents ?? []);
      setStatus(refreshedRegistration.status);
      setReviewReasonCategory(refreshedRegistration.reviewReasonCategory ?? null);
      setReviewReasonComment(refreshedRegistration.reviewReasonComment ?? '');
      setDocumentFile(null);
      setPhotoSubjectName('');
      if (documentInputRef.current) documentInputRef.current.value = '';
      setMessage('Dokumen berhasil diunggah.');
    } catch (uploadError) {
      setError(describeDocumentUploadError(uploadError, documentFile, MAX_UPLOAD_BYTES));
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = async (document: RegistrationDocumentRecord) => {
    if (!registrationId) return;
    setRemovingDocumentIds((current) => [...current, document.id]);
    setMessage('');
    setError('');
    try {
      await api.registrations.removeDocument(registrationId, document.id);
      setDocuments((current) => current.filter((candidate) => candidate.id !== document.id));
      setMessage('Dokumen dihapus.');
    } catch {
      setError('Dokumen gagal dihapus. Silakan coba lagi.');
    } finally {
      setRemovingDocumentIds((current) => current.filter((id) => id !== document.id));
    }
  };

  // While the session probe is still in flight we do not know the verification
  // state yet. Reporting it as missing would flash a false "verify your email"
  // requirement and block submit for a participant who is already verified.
  const gaps = registrationGaps({
    emailVerified: authLoading || emailVerified,
    competitionId,
    teamName,
    institution,
    phone,
    leaderName: leader.name,
    leaderStudentId: leader.studentId,
    documentCategories: documents.map((document) => document.category),
    hasSupervisor: Boolean(supervisor.name.trim()),
  });
  const ready = gaps.length === 0;

  const focusGap = (gapKey: string) => {
    const gap = gaps.find((candidate) => candidate.key === gapKey);
    if (!gap) return;
    setHighlightedGaps((current) => (current.includes(gapKey) ? current : [...current, gapKey]));
    const target = document.getElementById(gap.targetId);
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
      target.focus({ preventScroll: true });
    }
  };

  const submitRegistration = async () => {
    if (!editable) {
      setError('Pendaftaran tidak dapat dikirim pada status saat ini.');
      return;
    }
    if (!registrationId) {
      setError('Pilih kompetisi terlebih dahulu sebelum mengirim pendaftaran.');
      return;
    }
    if (!ready) {
      setError(`Masih ada ${gaps.length} hal yang belum lengkap: ${describeGaps(gaps)}.`);
      focusGap(gaps[0].key);
      return;
    }

    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      await flushAutosave();
      await api.registrations.submit(registrationId);
      navigate('/portal');
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 403) {
        setError('Verifikasi email Anda terlebih dahulu sebelum mengirim pendaftaran.');
      } else if (submitError instanceof ApiError && submitError.status === 400) {
        setError('Pendaftaran belum lengkap menurut server. Periksa kembali data tim dan dokumen.');
      } else {
        setError('Pendaftaran gagal dikirim. Silakan coba lagi.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isHighlighted = (key: string) => highlightedGaps.includes(key);

  return (
    <PortalShell>
      <main className="portal-main portal-registration">
        <header className="portal-registration__header">
          <div>
            <p className="portal-eyebrow">TABULA REGISTRATIONIS</p>
            <h1>
              {loading ? 'Menyiapkan pendaftaran.' : <>Pilih kompetisi <span>JRC XIV</span></>}
            </h1>
          </div>
          <p>Pilih kompetisi, lalu lengkapi data tim. Perubahan tersimpan otomatis.</p>
        </header>

        {loading ? (
          <p>Memuat formulir pendaftaran…</p>
        ) : loadError ? (
          <section className="portal-notice" role="alert">
            <span className="portal-notice__number" aria-hidden="true">!</span>
            <div>
              <h2>Pendaftaran tidak dapat dimuat.</h2>
              <p>{loadError}</p>
              <button
                className="portal-button portal-button--primary"
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              >
                Coba lagi
              </button>
            </div>
          </section>
        ) : competitions.length === 0 ? (
          <section className="portal-notice" role="status">
            <span className="portal-notice__number" aria-hidden="true">0</span>
            <div>
              <h2>Belum ada kompetisi aktif.</h2>
              <p>Pendaftaran akan tersedia setelah kompetisi dibuka oleh panitia.</p>
            </div>
          </section>
        ) : (
          <>
            <section className="portal-form-panel" aria-labelledby="competition-selection-title">
              <div className="portal-fieldset">
                <h2 id="competition-selection-title" tabIndex={-1}>Tentukan arena tim</h2>
                <p>Pilih satu dari enam kompetisi JRC XIV untuk melanjutkan pendaftaran.</p>
                <div className="portal-competition-grid" role="radiogroup" aria-label="Kompetisi JRC XIV">
                  {competitions.map((competition, index) => {
                    const selected = competition.id === competitionId;
                    const competitionLabel = `${competition.level ?? 'Umum'} · ${competition.name}`;

                    return (
                      <button
                        key={competition.id}
                        ref={(node) => {
                          competitionCardRefs.current[index] = node;
                        }}
                        aria-label={competitionLabel}
                        aria-checked={selected}
                        className={`portal-button portal-button--ghost portal-competition-card${isHighlighted('competition') && !selected ? ' portal-field--attention' : ''}`}
                        disabled={!editable}
                        role="radio"
                        tabIndex={index === tabbableCompetitionIndex ? 0 : -1}
                        type="button"
                        onClick={() => selectCompetition(competition.id)}
                        onKeyDown={(event) => handleCompetitionKeyDown(event, index)}
                      >
                        <span>{competition.level ?? 'Umum'}</span>
                        <strong>{competition.name}</strong>
                        {selected && <span>{creatingDraft ? 'Menyiapkan draft…' : 'Kompetisi terpilih'}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {competitionId && registrationId && (
              <div className="portal-registration__layout">
                <form
                  ref={formRef}
                  className="portal-form-panel"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveNow();
                  }}
                >
                  <fieldset className="portal-fieldset">
                    <legend><span>I</span> Identitas tim</legend>
                    <label>
                      Nama tim
                      <input
                        id="field-team-name"
                        className={isHighlighted('teamName') && !teamName.trim() ? 'portal-field--attention' : undefined}
                        disabled={!editable}
                        value={teamName}
                        onChange={(event) => setTeamName(event.target.value)}
                      />
                    </label>
                    <label>
                      Institusi
                      <input
                        id="field-institution"
                        className={isHighlighted('institution') && !institution.trim() ? 'portal-field--attention' : undefined}
                        disabled={!editable}
                        value={institution}
                        onChange={(event) => setInstitution(event.target.value)}
                      />
                    </label>
                    <label>
                      Nomor WhatsApp tim
                      <input
                        id="field-team-phone"
                        className={isHighlighted('phone') && !phone.trim() ? 'portal-field--attention' : undefined}
                        disabled={!editable}
                        inputMode="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                    </label>
                  </fieldset>

                  <fieldset className="portal-fieldset">
                    <legend><span>II</span> Ketua tim</legend>
                    <label>
                      Nama ketua
                      <input
                        id="field-leader-name"
                        className={isHighlighted('leaderName') && !leader.name.trim() ? 'portal-field--attention' : undefined}
                        disabled={!editable}
                        value={leader.name}
                        onChange={(event) => setLeader((current) => ({ ...current, name: event.target.value }))}
                      />
                    </label>
                    <label>
                      NIS/NIM ketua
                      <input
                        id="field-leader-student-id"
                        className={isHighlighted('leaderStudentId') && !leader.studentId.trim() ? 'portal-field--attention' : undefined}
                        disabled={!editable}
                        value={leader.studentId}
                        onChange={(event) => setLeader((current) => ({ ...current, studentId: event.target.value }))}
                      />
                    </label>
                    <label>
                      Email ketua
                      <input
                        disabled={!editable}
                        type="email"
                        value={leader.email}
                        onChange={(event) => setLeader((current) => ({ ...current, email: event.target.value }))}
                      />
                    </label>
                    <label>
                      Nomor telepon ketua
                      <input
                        disabled={!editable}
                        inputMode="tel"
                        value={leader.phone}
                        onChange={(event) => setLeader((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </label>
                  </fieldset>

                  <fieldset className="portal-fieldset">
                    <legend><span>III</span> Anggota tim</legend>
                    <p className="portal-fieldset__intro">
                      Opsional. Maksimal {MAX_TEAM_MEMBERS} orang termasuk ketua.
                    </p>
                    {members.map((member, index) => (
                      <div className="portal-field-row" key={member.id ?? `member-${index}`}>
                        <label>
                          Nama anggota {index + 1}
                          <input
                            disabled={!editable}
                            value={member.name}
                            onChange={(event) => updateMember(index, 'name', event.target.value)}
                          />
                        </label>
                        <label>
                          NIS/NIM anggota {index + 1}
                          <input
                            disabled={!editable}
                            value={member.studentId}
                            onChange={(event) => updateMember(index, 'studentId', event.target.value)}
                          />
                        </label>
                        <label>
                          Email anggota {index + 1}
                          <input
                            disabled={!editable}
                            type="email"
                            value={member.email}
                            onChange={(event) => updateMember(index, 'email', event.target.value)}
                          />
                        </label>
                        <label>
                          Nomor telepon anggota {index + 1}
                          <input
                            disabled={!editable}
                            inputMode="tel"
                            value={member.phone}
                            onChange={(event) => updateMember(index, 'phone', event.target.value)}
                          />
                        </label>
                        {editable && (
                          <button
                            className="portal-button portal-button--ghost"
                            disabled={Boolean(member.id && removingMemberIds.includes(member.id))}
                            type="button"
                            onClick={() => void removeMember(member, index)}
                          >
                            {member.id && removingMemberIds.includes(member.id)
                              ? 'Menghapus…'
                              : `Hapus anggota ${index + 1}`}
                          </button>
                        )}
                      </div>
                    ))}
                    {editable && members.length + 1 < MAX_TEAM_MEMBERS && (
                      <button
                        className="portal-button portal-button--ghost"
                        type="button"
                        onClick={() => setMembers((current) => [...current, emptyMember()])}
                      >
                        Tambah anggota
                      </button>
                    )}
                  </fieldset>

                  <fieldset className="portal-fieldset">
                    <legend><span>IV</span> Pembina</legend>
                    <label>
                      Nama pembina
                      <input
                        id="field-supervisor-name"
                        disabled={!editable}
                        value={supervisor.name}
                        onChange={(event) => setSupervisor((current) => ({ ...current, name: event.target.value }))}
                      />
                    </label>
                    <label>
                      Email pembina
                      <input
                        disabled={!editable}
                        type="email"
                        value={supervisor.email}
                        onChange={(event) => setSupervisor((current) => ({ ...current, email: event.target.value }))}
                      />
                    </label>
                    <label>
                      Nomor telepon pembina
                      <input
                        disabled={!editable}
                        inputMode="tel"
                        value={supervisor.phone}
                        onChange={(event) => setSupervisor((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </label>
                  </fieldset>

                  <section className="portal-document-panel" aria-labelledby="registration-documents">
                    <h2 id="registration-documents">Dokumen pendukung</h2>
                    {(reviewReasonCategory || reviewReasonComment) && (
                      <div className="portal-review-note">
                        <strong>Catatan peninjauan</strong>
                        {reviewReasonCategory && <p>{REVIEW_REASON_CATEGORY_LABELS[reviewReasonCategory]}</p>}
                        {reviewReasonComment && <p>{reviewReasonComment}</p>}
                      </div>
                    )}
                    <p>
                      Unggah lima dokumen wajib. Format PDF, JPEG, atau PNG, maksimal {formatBytes(MAX_UPLOAD_BYTES)} per berkas.
                    </p>

                    <label>
                      Kategori dokumen
                      <select
                        disabled={!editable || uploading}
                        value={documentCategory}
                        onChange={(event) => setDocumentCategory(event.target.value)}
                      >
                        {Object.entries(documentCategoryLabels).map(([category, label]) => (
                          <option key={category} value={category}>{label}</option>
                        ))}
                      </select>
                    </label>

                    {documentCategory === 'MEMBER_PHOTO' && (
                      <div className="portal-field-row">
                        <label>
                          Nama lengkap pemilik foto
                          <input
                            disabled={!editable || uploading}
                            value={photoSubjectName}
                            onChange={(event) => setPhotoSubjectName(event.target.value)}
                          />
                        </label>
                        <label>
                          Jabatan
                          <select
                            disabled={!editable || uploading}
                            value={photoSubjectRole}
                            onChange={(event) => setPhotoSubjectRole(event.target.value as 'PARTICIPANT' | 'SUPERVISOR')}
                          >
                            <option value="PARTICIPANT">Peserta</option>
                            <option value="SUPERVISOR">Pembina</option>
                          </select>
                        </label>
                        <p>Unggah foto formal 3x4 berformat JPEG atau PNG.</p>
                      </div>
                    )}

                    <div
                      className={`portal-dropzone${dragging ? ' portal-dropzone--active' : ''}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (editable && !uploading) setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        if (!editable || uploading) return;
                        acceptDocumentFile(event.dataTransfer.files?.[0] ?? null);
                      }}
                    >
                      <label htmlFor="field-document-file">Berkas dokumen</label>
                      <p className="portal-dropzone__hint">
                        Tarik berkas ke sini atau pilih dari perangkat.
                      </p>
                      <input
                        id="field-document-file"
                        ref={documentInputRef}
                        className={isHighlighted('documents') && documents.length === 0 ? 'portal-field--attention' : undefined}
                        accept={documentCategory === 'MEMBER_PHOTO' ? 'image/jpeg,image/png' : DOCUMENT_ACCEPT_ATTRIBUTE}
                        disabled={!editable || uploading}
                        type="file"
                        onChange={(event) => acceptDocumentFile(event.target.files?.[0] ?? null)}
                      />
                    </div>

                    {documentFile && (
                      <div className="portal-file-row">
                        {previewUrl ? (
                          <img src={previewUrl} alt="" width={48} height={48} />
                        ) : (
                          <span aria-hidden="true">{formatDocumentType(documentFile.type)}</span>
                        )}
                        <div>
                          <strong>{documentFile.name}</strong>
                          <small>{formatBytes(documentFile.size)} · siap diunggah</small>
                        </div>
                        <button
                          className="portal-button portal-button--ghost"
                          type="button"
                          onClick={() => {
                            setDocumentFile(null);
                            if (documentInputRef.current) documentInputRef.current.value = '';
                          }}
                        >
                          Batalkan
                        </button>
                      </div>
                    )}

                    {editable && (
                      <button
                        className="portal-button portal-button--ghost"
                        disabled={uploading || !documentFile}
                        type="button"
                        onClick={() => void uploadDocument()}
                      >
                        {uploading ? 'Mengunggah…' : 'Unggah dokumen'}
                      </button>
                    )}

                    {documents.length > 0 && (
                      <ul>
                        {documents.map((document) => (
                          <li key={document.id}>
                            <span>{documentCategoryLabels[document.category] ?? 'Dokumen'}</span>
                            <strong>{document.originalName}</strong>
                            <span>
                              {formatDocumentType(document.mimeType)} · {formatBytes(document.size)}
                            </span>
                            {editable && (
                              <button
                                className="portal-button portal-button--ghost"
                                disabled={removingDocumentIds.includes(document.id)}
                                type="button"
                                onClick={() => void removeDocument(document)}
                              >
                                {removingDocumentIds.includes(document.id) ? 'Menghapus…' : `Hapus ${document.originalName}`}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {verificationKnown && !emailVerified && editable && (
                    <section
                      id="registration-email-verification"
                      className={`portal-notice${isHighlighted('emailVerified') ? ' portal-field--attention' : ''}`}
                      role="alert"
                    >
                      <span className="portal-notice__number" aria-hidden="true">@</span>
                      <div>
                        <h2>Verifikasi email diperlukan.</h2>
                        <p>
                          Buka tautan verifikasi yang dikirim ke email Anda sebelum mengirim
                          pendaftaran. Data tetap dapat dilengkapi sekarang.
                        </p>
                        <button
                          className="portal-button portal-button--primary"
                          type="button"
                          onClick={() => navigate('/portal/verifikasi-email')}
                        >
                          Buka halaman verifikasi
                        </button>
                      </div>
                    </section>
                  )}

                  {editable && (
                    <div className="portal-form-actions">
                      <button className="portal-button" disabled={saving} type="submit">
                        {saving ? 'Menyimpan…' : 'Simpan sekarang'}
                      </button>
                      <button
                        className="portal-button portal-button--primary"
                        disabled={submitting}
                        type="button"
                        onClick={() => void submitRegistration()}
                      >
                        {submitting ? 'Mengirim…' : 'Kirim pendaftaran'}
                      </button>
                    </div>
                  )}
                </form>

                <aside className="portal-checklist" aria-labelledby="registration-checklist-title">
                  <h2 id="registration-checklist-title">Kelengkapan</h2>
                  <p className="portal-checklist__progress">
                    {gaps.length === 0
                      ? 'Semua syarat terpenuhi.'
                      : `${gaps.length} hal belum lengkap.`}
                  </p>
                  <ul>
                    {registrationGaps({
                      emailVerified: true,
                      competitionId,
                      teamName,
                      institution,
                      phone,
                      leaderName: leader.name,
                      leaderStudentId: leader.studentId,
                      documentCategories: documents.map((document) => document.category),
    hasSupervisor: Boolean(supervisor.name.trim()),
                    }).length === 0 && (
                      <li className="portal-checklist__item portal-checklist__item--done">
                        <span aria-hidden="true">✓</span> Data pendaftaran
                      </li>
                    )}
                    {gaps.map((gap) => (
                      <li key={gap.key} className="portal-checklist__item">
                        <button type="button" onClick={() => focusGap(gap.key)}>
                          <span aria-hidden="true">!</span>
                          <span>
                            <strong>{gap.label}</strong>
                            <small>{gap.detail}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                    {gaps.length === 0 && (
                      <li className="portal-checklist__item portal-checklist__item--done">
                        <span aria-hidden="true">✓</span> Siap dikirim
                      </li>
                    )}
                  </ul>
                  <p className="portal-checklist__autosave" aria-live="polite">
                    {autosaveLabel(autosave.state, autosave.savedAt)}
                  </p>
                </aside>
              </div>
            )}

            {message && <p role="status">{message}</p>}
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </main>
    </PortalShell>
  );
}
