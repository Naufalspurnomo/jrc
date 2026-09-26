import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PortalShell } from '../../components/portal/PortalShell';
import { competitions as competitionCatalog } from '../../content/jrc';
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
import { registrationGaps, REQUIRED_DOCUMENT_CATEGORIES } from '../../features/registration/readiness';
import { calculateCropSource, canvasToJpegFile, loadCropImage } from '../../features/registration/photoCrop';
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
  RECOMMENDATION_LETTER: 'Surat rekomendasi',
  IDENTITY_CARD: 'Identitas diri (kartu pelajar/KTM/KTP)',
  REGISTRATION_FORM: 'Formulir pendaftaran',
  TEAM_PHOTO: 'Foto tim',
  TWIBBON_PROOF: 'Bukti twibbon',
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
  const [selectedPhotoPerson, setSelectedPhotoPerson] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropBusy, setCropBusy] = useState(false);
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
  const [oversizedFile, setOversizedFile] = useState<File | null>(null);
  const errorSummaryRef = useRef<HTMLElement>(null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [created, setCreated] = useState(Boolean(existingRegistrationId));
  const [highlightedGaps, setHighlightedGaps] = useState<string[]>([]);

  const competitionCardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropDragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
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

  // Object URLs for staged output and the source shown in the crop dialog.
  useEffect(() => {
    if (!documentFile || !isPreviewableImage(documentFile.type)) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(documentFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [documentFile]);

  useEffect(() => {
    if (!cropFile) {
      setCropUrl(null);
      return;
    }
    const url = URL.createObjectURL(cropFile);
    setCropUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cropFile]);

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
  const selectedCompetition = selectedCompetitionIndex >= 0
    ? competitions[selectedCompetitionIndex]
    : undefined;
  const selectedCatalogCompetition = selectedCompetition
    ? (
        competitionCatalog.find((competition) => competition.slug === selectedCompetition.slug)
        ?? competitionCatalog.find((competition) => competition.name === selectedCompetition.name)
      )
    : undefined;

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
    if (file && documentCategory === 'MEMBER_PHOTO') {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        setError('Foto formal 3x4 harus berformat JPEG atau PNG.');
        return;
      }
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
      setCropFile(file);
      setDocumentFile(null);
      setError('');
      return;
    }
    setDocumentFile(file);
    setOversizedFile(null);
    if (file && !isAcceptedDocumentType(file.type)) {
      setError('Format dokumen harus PDF, JPEG, atau PNG.');
      return;
    }
    if (file && file.size > MAX_UPLOAD_BYTES) {
      setOversizedFile(file);
      setError('Berkas terlalu besar');
      requestAnimationFrame(() => {
        errorSummaryRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        errorSummaryRef.current?.focus({ preventScroll: true });
      });
      return;
    }
    setError('');
  };

  const roster = useMemo(() => [
    ...(leader.name.trim() ? [{ key: 'leader', name: leader.name.trim(), label: 'Ketua', role: 'PARTICIPANT' as const }] : []),
    ...members.flatMap((member, index) => member.name.trim()
      ? [{ key: `member-${index}`, name: member.name.trim(), label: 'Peserta', role: 'PARTICIPANT' as const }]
      : []),
    ...(supervisor.name.trim() ? [{ key: 'supervisor', name: supervisor.name.trim(), label: 'Pembina', role: 'SUPERVISOR' as const }] : []),
  ], [leader.name, members, supervisor.name]);
  const selectedRosterPerson = roster.find((person) => person.key === selectedPhotoPerson);
  const hasMemberPhoto = (person: typeof roster[number]) => documents.some((document) =>
    document.category.toUpperCase() === 'MEMBER_PHOTO'
    && document.subjectName?.toLocaleLowerCase('id-ID') === person.name.toLocaleLowerCase('id-ID')
    && document.subjectRole === person.role,
  );

  const applyCrop = async () => {
    if (!cropFile || !selectedRosterPerson) return;
    setCropBusy(true);
    try {
      const image = await loadCropImage(cropFile);
      try {
        const canvas = cropCanvasRef.current ?? document.createElement('canvas');
        canvas.width = 900;
        canvas.height = 1200;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas tidak tersedia.');
        const source = calculateCropSource(image.width, image.height, cropZoom, cropOffset.x, cropOffset.y);
        context.drawImage(image.source, source.x, source.y, source.width, source.height, 0, 0, 900, 1200);
        setDocumentFile(await canvasToJpegFile(canvas, selectedRosterPerson.name));
        setCropFile(null);
      } finally {
        image.close();
      }
    } catch {
      setError('Foto gagal dipotong. Silakan pilih foto lain.');
    } finally {
      setCropBusy(false);
    }
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
      setOversizedFile(documentFile);
      setError('Berkas terlalu besar');
      requestAnimationFrame(() => {
        errorSummaryRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        errorSummaryRef.current?.focus({ preventScroll: true });
      });
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
        if (!selectedRosterPerson) {
          setError('Pilih anggota dari daftar tim.');
          return;
        }
        if (hasMemberPhoto(selectedRosterPerson)) {
          setError('Hapus foto lama untuk mengganti foto anggota ini.');
          return;
        }
        formData.append('subjectName', selectedRosterPerson.name);
        formData.append('subjectRole', selectedRosterPerson.role);
      }
      formData.append('file', documentFile);
      await api.registrations.uploadDocument(registrationId, formData);
      const refreshedRegistration = await api.registrations.get(registrationId);
      setDocuments(refreshedRegistration.documents ?? []);
      setStatus(refreshedRegistration.status);
      setReviewReasonCategory(refreshedRegistration.reviewReasonCategory ?? null);
      setReviewReasonComment(refreshedRegistration.reviewReasonComment ?? '');
      setDocumentFile(null);
      setSelectedPhotoPerson('');
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
  const baseGaps = registrationGaps({
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
  const missingPhotoPeople = roster.filter((person) => !hasMemberPhoto(person));
  const gaps = missingPhotoPeople.length > 0
    ? [...baseGaps, {
      key: 'memberPhotos',
      label: `Foto formal 3x4: ${missingPhotoPeople.map((person) => person.name).join(', ')}`,
      targetId: 'registration-documents-panel',
    }]
    : baseGaps;
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
      setError('Pendaftaran belum dapat dikirim');
      setHighlightedGaps(gaps.map((gap) => gap.key));
      requestAnimationFrame(() => {
        errorSummaryRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        errorSummaryRef.current?.focus({ preventScroll: true });
      });
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
                {selectedCompetition && (
                  <section
                    className="portal-competition-detail"
                    role="region"
                    aria-label={`Detail kompetisi ${selectedCompetition.name}`}
                    aria-live="polite"
                  >
                    <p className="portal-competition-detail__eyebrow">Detail arena</p>
                    <h3 id="selected-competition-title">
                      {selectedCompetition.level ?? selectedCatalogCompetition?.level ?? 'Umum'} · {selectedCompetition.name}
                    </h3>
                    <dl>
                      <div>
                        <dt>Jenis lomba</dt>
                        <dd>{selectedCatalogCompetition?.discipline ?? 'Belum tersedia'}</dd>
                      </div>
                      <div>
                        <dt>Tantangan utama</dt>
                        <dd>{selectedCatalogCompetition?.objective ?? 'Belum tersedia'}</dd>
                      </div>
                    </dl>
                    {(selectedCatalogCompetition?.description || selectedCompetition.description) && (
                      <p>{selectedCatalogCompetition?.description ?? selectedCompetition.description}</p>
                    )}
                  </section>
                )}
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

                  <section id="registration-documents-panel" className={`portal-document-panel${isHighlighted('documents') ? ' portal-document-panel--invalid' : ''}`} aria-labelledby="registration-documents">
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
                    <ul className="portal-document-checklist" aria-label="Kelengkapan dokumen wajib">
                      {REQUIRED_DOCUMENT_CATEGORIES.map((category) => {
                        const complete = documents.some((document) => document.category === category);
                        return <li key={category} className={complete ? 'is-complete' : 'is-missing'}>
                          <span aria-hidden="true">{complete ? '✓' : '!'}</span>
                          <strong>{documentCategoryLabels[category]}</strong>
                          <small>{complete ? 'Lengkap' : 'Belum diunggah'}</small>
                        </li>;
                      })}
                    </ul>

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
                      <section className="portal-photo-roster" aria-labelledby="photo-roster-title">
                        <h3 id="photo-roster-title">Pilih pemilik foto</h3>
                        <p>Foto akan dipotong menjadi rasio resmi 3:4 (900×1200).</p>
                        {roster.length === 0 ? (
                          <p role="status">Isi nama ketua, peserta, atau pembina terlebih dahulu.</p>
                        ) : (
                          <div className="portal-photo-roster__grid">
                            {roster.map((person) => {
                              const complete = hasMemberPhoto(person);
                              const photoStatus = complete ? 'Foto lengkap' : 'Belum ada foto';
                              return <button key={person.key} className="portal-photo-person" aria-label={`${person.name} · ${person.label} · ${photoStatus}`} aria-pressed={selectedPhotoPerson === person.key} disabled={!editable || uploading || complete} type="button" onClick={() => {
                                setSelectedPhotoPerson(person.key);
                                setDocumentFile(null);
                                if (documentInputRef.current) documentInputRef.current.value = '';
                              }}>
                                <strong>{person.name}</strong><span>{person.label}</span>
                                <small>{complete ? 'Foto lengkap · hapus foto lama untuk mengganti' : 'Belum ada foto'}</small>
                              </button>;
                            })}
                          </div>
                        )}
                      </section>
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
                        className={isHighlighted('documents') || oversizedFile ? 'portal-field--attention' : undefined}
                        aria-invalid={isHighlighted('documents') || Boolean(oversizedFile) || undefined}
                        accept={documentCategory === 'MEMBER_PHOTO' ? 'image/jpeg,image/png' : DOCUMENT_ACCEPT_ATTRIBUTE}
                        disabled={!editable || uploading || (documentCategory === 'MEMBER_PHOTO' && (!selectedRosterPerson || hasMemberPhoto(selectedRosterPerson)))}
                        type="file"
                        onChange={(event) => acceptDocumentFile(event.target.files?.[0] ?? null)}
                      />
                    </div>

                    {cropFile && cropUrl && (
                      <div className="portal-crop-backdrop" role="presentation">
                        <section className="portal-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-title">
                          <h3 id="crop-title">Atur potongan foto 3:4</h3>
                          <p>Geser foto dan atur zoom. Hasil akhir JPEG 900×1200.</p>
                          <div
                            className="portal-crop-viewport"
                            onPointerDown={(event) => {
                              event.currentTarget.setPointerCapture(event.pointerId);
                              cropDragRef.current = { x: event.clientX, y: event.clientY, offsetX: cropOffset.x, offsetY: cropOffset.y };
                            }}
                            onPointerMove={(event) => {
                              const drag = cropDragRef.current;
                              if (!drag) return;
                              const rect = event.currentTarget.getBoundingClientRect();
                              setCropOffset({
                                x: Math.max(-1, Math.min(1, drag.offsetX - (event.clientX - drag.x) / (rect.width / 2))),
                                y: Math.max(-1, Math.min(1, drag.offsetY - (event.clientY - drag.y) / (rect.height / 2))),
                              });
                            }}
                            onPointerUp={() => { cropDragRef.current = null; }}
                          >
                            <img src={cropUrl} alt="Pratinjau foto yang akan dipotong" style={{ transform: `translate(${-cropOffset.x * 25}%, ${-cropOffset.y * 25}%) scale(${cropZoom})` }} />
                          </div>
                          <label>Zoom
                            <input aria-label="Zoom foto" type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} />
                          </label>
                          <canvas ref={cropCanvasRef} className="portal-crop-canvas" width="900" height="1200" aria-hidden="true" />
                          <div className="portal-crop-actions">
                            <button className="portal-button portal-button--primary" disabled={cropBusy} type="button" onClick={() => void applyCrop()}>{cropBusy ? 'Memproses…' : 'Gunakan hasil crop'}</button>
                            <button className="portal-button portal-button--ghost" disabled={cropBusy} type="button" onClick={() => { setCropFile(null); if (documentInputRef.current) documentInputRef.current.value = ''; }}>Batal</button>
                          </div>
                        </section>
                      </div>
                    )}

                    {documentFile && (
                      <div className="portal-file-row">
                        {previewUrl ? (
                          <img src={previewUrl} alt="" width={48} height={48} />
                        ) : (
                          <span aria-hidden="true">{formatDocumentType(documentFile.type)}</span>
                        )}
                        <div>
                          <strong>{documentFile.name}</strong>
                          <small>{formatBytes(documentFile.size)} · {oversizedFile ? 'belum dapat diunggah' : 'siap diunggah'}</small>
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
            {error && (
              <section ref={errorSummaryRef} className="portal-error-summary" role="alert" tabIndex={-1} aria-label={error}>
                <span aria-hidden="true">!</span>
                <div>
                  <h2>{error}</h2>
                  {oversizedFile ? (
                    <><p><strong>{oversizedFile.name}</strong> berukuran {formatBytes(oversizedFile.size)}.</p><p>Ukuran maksimum 10 MB. Kompres berkas atau pilih berkas yang lebih kecil.</p></>
                  ) : (
                    <>
                      <p>Lengkapi bagian berikut sebelum mengirim:</p>
                      <ul>{gaps.flatMap((gap) => gap.missingDocumentCategories?.map((category) => <li key={category}>{documentCategoryLabels[category]}</li>) ?? [<li key={gap.key}>{gap.label}</li>])}</ul>
                      {gaps.some((gap) => gap.key === 'documents') && <button className="portal-button portal-button--primary" type="button" onClick={() => { document.getElementById('registration-documents-panel')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); documentInputRef.current?.focus(); }}>Lengkapi dokumen</button>}
                    </>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </PortalShell>
  );
}
