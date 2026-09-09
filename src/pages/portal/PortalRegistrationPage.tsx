import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PortalShell } from '../../components/portal/PortalShell';
import { useAuth } from '../../features/auth/AuthProvider';
import {
  registrationApi,
  type CompetitionRecord,
  type RegistrationApi,
  type RegistrationDocumentRecord,
  type RegistrationInput,
  type RegistrationState,
  type TeamMemberRecord,
} from '../../features/registration/api';

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
const allowedDocumentTypes = ['application/pdf', 'image/jpeg', 'image/png'];

const documentCategoryLabels: Record<string, string> = {
  STUDENT_CARD: 'Kartu pelajar/mahasiswa',
  TEAM_PHOTO: 'Foto tim',
  OTHER: 'Dokumen lainnya',
};

function formatDocumentSize(size: number): string {
  if (size < 1_024) return `${size} B`;
  if (size < 1_048_576) return `${Math.ceil(size / 1_024)} KB`;
  return `${(size / 1_048_576).toFixed(1)} MB`;
}

function formatDocumentType(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'image/jpeg') return 'JPEG';
  if (mimeType === 'image/png') return 'PNG';
  return 'Berkas';
}

export default function PortalRegistrationPage({ api = registrationApi }: PortalRegistrationPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const emailVerified = user?.emailVerified === true;
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
  const [status, setStatus] = useState<RegistrationState>('DRAFT');
  const [documents, setDocuments] = useState<RegistrationDocumentRecord[]>([]);
  const [reviewReason, setReviewReason] = useState('');
  const [documentCategory, setDocumentCategory] = useState('STUDENT_CARD');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingMemberIds, setRemovingMemberIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const competitionCardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const [competitionRecords, existingRegistration] = await Promise.all([
          api.competitions.list(),
          existingRegistrationId
            ? api.registrations.get(existingRegistrationId)
            : Promise.resolve(null),
        ]);

        if (!active) return;
        setCompetitions(competitionRecords);

        if (existingRegistration) {
          setRegistrationId(existingRegistration.id);
          setCompetitionId(existingRegistration.competitionId);
          setTeamName(existingRegistration.teamName);
          setInstitution(existingRegistration.institution);
          setPhone(existingRegistration.phone ?? '');
          setStatus(existingRegistration.status);
          setDocuments(existingRegistration.documents ?? []);
          setReviewReason(existingRegistration.reviewReason ?? '');

          const existingMembers = existingRegistration.members ?? [];
          const leaderIndex = Math.max(0, existingMembers.findIndex((member) => member.role === 'LEADER'));
          const existingLeader = existingMembers[leaderIndex];
          const toDraft = (member: TeamMemberRecord): MemberDraft => ({
            id: member.id,
            name: member.name,
            studentId: member.studentId ?? '',
            email: member.email ?? '',
            phone: member.phone ?? '',
          });

          setLeader(existingLeader ? toDraft(existingLeader) : emptyMember());
          setMembers(existingMembers.filter((_, index) => index !== leaderIndex).map(toDraft));
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

  const editable = editableStatuses.includes(status);
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
    setCompetitionId(competitions[nextIndex].id);
    competitionCardRefs.current[nextIndex]?.focus();
  };

  const updateMember = (index: number, field: keyof Omit<MemberDraft, 'id'>, value: string) => {
    setMembers((current) => current.map((member, memberIndex) => (
      memberIndex === index ? { ...member, [field]: value } : member
    )));
  };

  const removeMember = async (member: MemberDraft) => {
    if (!member.id) {
      setMembers((current) => current.filter((candidate) => candidate !== member));
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

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editable) {
      setError('Pendaftaran tidak dapat diubah pada status saat ini.');
      return;
    }
    setSaving(true);
    setMessage('');
    setError('');

    const registrationInput: RegistrationInput = {
      competitionId,
      teamName: teamName.trim(),
      institution: institution.trim(),
      phone: phone.trim(),
    };

    try {
      const registration = registrationId
        ? await api.registrations.update(registrationId, registrationInput)
        : await api.registrations.create(registrationInput);

      setRegistrationId(registration.id);
      setStatus(registration.status);

      const people = [leader, ...members];
      for (const [personIndex, person] of people.entries()) {
        const memberInput = {
          name: person.name.trim(),
          studentId: person.studentId.trim(),
          email: person.email.trim(),
          phone: person.phone.trim(),
        };
        if (person.id) {
          await api.registrations.updateMember(registration.id, person.id, memberInput);
          continue;
        }

        const createdMember = await api.registrations.addMember(registration.id, {
          name: memberInput.name,
          studentId: memberInput.studentId,
          ...(memberInput.email ? { email: memberInput.email } : {}),
          ...(memberInput.phone ? { phone: memberInput.phone } : {}),
        });
        if (personIndex === 0) {
          setLeader((current) => ({ ...current, id: createdMember.id }));
        } else {
          setMembers((current) => current.map((member, memberIndex) => (
            memberIndex === personIndex - 1 ? { ...member, id: createdMember.id } : member
          )));
        }
      }

      setMessage('Pendaftaran tersimpan.');
    } catch {
      setError('Pendaftaran gagal disimpan. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async () => {
    if (!registrationId) {
      setError('Simpan draft sebelum mengunggah dokumen.');
      return;
    }
    if (!documentCategory || !documentFile) {
      setError('Pilih kategori dan berkas dokumen.');
      return;
    }
    if (!allowedDocumentTypes.includes(documentFile.type)) {
      setError('Format dokumen harus PDF, JPEG, atau PNG.');
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
      formData.append('file', documentFile);
      await api.registrations.uploadDocument(registrationId, formData);
      const refreshedRegistration = await api.registrations.get(registrationId);
      setDocuments(refreshedRegistration.documents ?? []);
      setStatus(refreshedRegistration.status);
      setReviewReason(refreshedRegistration.reviewReason ?? '');
      setDocumentFile(null);
      setMessage('Dokumen berhasil diunggah.');
    } catch {
      setError('Dokumen gagal diunggah. Silakan coba lagi.');
    } finally {
      setUploading(false);
    }
  };

  const submitRegistration = async () => {
    if (!emailVerified) {
      setError('Verifikasi email Anda terlebih dahulu sebelum mengirim pendaftaran.');
      return;
    }
    if (!registrationId) {
      setError('Simpan draft sebelum mengirim pendaftaran.');
      return;
    }
    if (!leader.id && !members.some((member) => member.id)) {
      setError('Simpan setidaknya satu anggota sebelum mengirim pendaftaran.');
      return;
    }
    if (documents.length === 0) {
      setError('Unggah setidaknya satu dokumen sebelum mengirim pendaftaran.');
      return;
    }
    if (!editable) {
      setError('Pendaftaran tidak dapat dikirim pada status saat ini.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      await api.registrations.submit(registrationId);
      navigate('/portal');
    } catch {
      setError('Pendaftaran gagal dikirim. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

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
          <p>Pilih satu kompetisi sebelum mengisi identitas tim dan anggota.</p>
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
                <h2 id="competition-selection-title">Tentukan arena tim</h2>
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
                        className="portal-button portal-button--ghost portal-competition-card"
                        disabled={!editable}
                        role="radio"
                        tabIndex={index === tabbableCompetitionIndex ? 0 : -1}
                        type="button"
                        onClick={() => setCompetitionId(competition.id)}
                        onKeyDown={(event) => handleCompetitionKeyDown(event, index)}
                      >
                        <span>{competition.level ?? 'Umum'}</span>
                        <strong>{competition.name}</strong>
                        {selected && <span>Kompetisi terpilih</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {competitionId && (
              <form className="portal-form-panel" onSubmit={saveDraft}>
            <fieldset className="portal-fieldset">
              <legend><span>I</span> Identitas tim</legend>
              <label>
                Nama tim
                <input
                  required
                  disabled={!editable}
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                />
              </label>
              <label>
                Institusi
                <input
                  required
                  disabled={!editable}
                  value={institution}
                  onChange={(event) => setInstitution(event.target.value)}
                />
              </label>
              <label>
                Nomor WhatsApp tim
                <input
                  required
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
                  required
                  disabled={!editable}
                  value={leader.name}
                  onChange={(event) => setLeader((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                NIS/NIM ketua
                <input
                  required
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
              {members.map((member, index) => (
                <div className="portal-field-row" key={member.id ?? `member-${index}`}>
                  <label>
                    Nama anggota {index + 1}
                    <input
                      required
                      disabled={!editable}
                      value={member.name}
                      onChange={(event) => updateMember(index, 'name', event.target.value)}
                    />
                  </label>
                  <label>
                    NIS/NIM anggota {index + 1}
                    <input
                      required
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
                      onClick={() => void removeMember(member)}
                    >
                      {member.id && removingMemberIds.includes(member.id)
                        ? 'Menghapus…'
                        : `Hapus anggota ${index + 1}`}
                    </button>
                  )}
                </div>
              ))}
              {editable && (
                <button
                  className="portal-button portal-button--ghost"
                  type="button"
                  onClick={() => setMembers((current) => [...current, emptyMember()])}
                >
                  Tambah anggota
                </button>
              )}
            </fieldset>

            <section className="portal-document-panel" aria-labelledby="registration-next-steps">
              <h2 id="registration-next-steps">Dokumen dan pengiriman</h2>
              {reviewReason && (
                <div>
                  <strong>Catatan peninjauan</strong>
                  <p>{reviewReason}</p>
                </div>
              )}
              <p>Dokumen dapat dilengkapi setelah draft tersimpan.</p>

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

              <label>
                Berkas dokumen
                <input
                  key={documentFile
                    ? `${documentFile.name}-${documentFile.size}-${documentFile.lastModified}`
                    : 'empty-document-file'}
                  accept="application/pdf,image/jpeg,image/png"
                  disabled={!editable || uploading}
                  type="file"
                  onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                />
              </label>

              {editable && (
                <button
                  className="portal-button portal-button--ghost"
                  disabled={uploading}
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
                        {formatDocumentType(document.mimeType)} · {formatDocumentSize(document.size)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {message && <p role="status">{message}</p>}
            {error && <p role="alert">{error}</p>}

            {!emailVerified && editable && (
              <section className="portal-notice" role="alert">
                <span className="portal-notice__number" aria-hidden="true">@</span>
                <div>
                  <h2>Verifikasi email diperlukan.</h2>
                  <p>
                    Buka tautan verifikasi yang dikirim ke email Anda sebelum mengirim
                    pendaftaran. Draft tetap dapat disimpan.
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
                <button className="portal-button portal-button--primary" disabled={saving} type="submit">
                  {saving ? 'Menyimpan…' : 'Simpan draft'}
                </button>
                {registrationId && (
                  <button
                    className="portal-button portal-button--primary"
                    disabled={!emailVerified
                      || submitting
                      || (!leader.id && !members.some((member) => member.id))
                      || documents.length === 0}
                    type="button"
                    onClick={() => void submitRegistration()}
                  >
                    {submitting ? 'Mengirim…' : 'Kirim pendaftaran'}
                  </button>
                )}
              </div>
            )}
              </form>
            )}
          </>
        )}
      </main>
    </PortalShell>
  );
}
