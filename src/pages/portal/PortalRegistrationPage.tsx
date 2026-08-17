import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { PortalShell } from '../../components/portal/PortalShell';
import {
  PORTAL_COMPETITIONS,
  portalRepository,
  type PortalFileMetadata,
  type PortalRepository,
  type RegistrationDraft,
} from '../../data/portal';

const registrationSchema = z.object({
  teamName: z.string().trim().min(3, 'Nama tim minimal 3 karakter.'),
  institution: z.string().trim().min(3, 'Nama institusi minimal 3 karakter.'),
  competitionId: z.string().min(1, 'Pilih satu arena perlombaan.'),
  leaderName: z.string().trim().min(3, 'Nama ketua minimal 3 karakter.'),
  leaderEmail: z.email('Masukkan alamat email yang valid.'),
  leaderPhone: z.string().regex(/^08\d{8,13}$/, 'Gunakan nomor WhatsApp Indonesia yang valid.'),
});

type RegistrationValues = z.infer<typeof registrationSchema>;

interface PortalRegistrationPageProps {
  repository?: PortalRepository;
}

const steps = ['Identitas', 'Arena', 'Anggota', 'Dokumen', 'Tinjau'];

export default function PortalRegistrationPage({ repository = portalRepository }: PortalRegistrationPageProps) {
  const navigate = useNavigate();
  const session = repository.getSession();
  const registration = session?.registrationId ? repository.getRegistration(session.registrationId) : null;
  const [step, setStep] = useState(0);
  const [documents, setDocuments] = useState<PortalFileMetadata[]>(registration?.documents ?? []);
  const [documentError, setDocumentError] = useState('');
  const existingLeader = registration?.members.find((member) => member.role === 'leader');
  const {
    register,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      teamName: registration?.teamName ?? '',
      institution: registration?.institution ?? '',
      competitionId: registration?.competitionId ?? '',
      leaderName: existingLeader?.name ?? '',
      leaderEmail: existingLeader?.email ?? '',
      leaderPhone: existingLeader?.phone ?? '',
    },
  });

  if (!session || session.role !== 'participant' || !session.registrationId || !registration) {
    return <Navigate replace to="/portal/masuk" />;
  }

  const createDraft = (): RegistrationDraft => {
    const values = getValues();
    return {
      teamName: values.teamName,
      institution: values.institution,
      competitionId: values.competitionId,
      members: values.leaderName ? [{
        id: existingLeader?.id ?? 'leader-primary',
        name: values.leaderName,
        email: values.leaderEmail,
        phone: values.leaderPhone,
        role: 'leader',
      }] : [],
      documents,
    };
  };

  const continueStep = async () => {
    const fields: Array<Array<keyof RegistrationValues>> = [
      ['teamName', 'institution'],
      ['competitionId'],
      ['leaderName', 'leaderEmail', 'leaderPhone'],
    ];
    if (step < 3 && !(await trigger(fields[step]))) return;
    repository.saveDraft(registration.id, createDraft());
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const reviewRegistration = () => {
    if (documents.length === 0) {
      setDocumentError('Unggah setidaknya satu dokumen identitas.');
      return;
    }
    repository.saveDraft(registration.id, createDraft());
    setStep(4);
  };

  const submitRegistration = () => {
    repository.saveDraft(registration.id, createDraft());
    repository.submitRegistration(registration.id);
    navigate('/portal');
  };

  const addDocuments = (files: FileList | null) => {
    const metadata = Array.from(files ?? []).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    }));
    setDocuments(metadata);
    setDocumentError('');
  };

  if (!['draft', 'revision_requested'].includes(registration.status)) {
    return (
      <PortalShell>
        <main className="portal-main portal-empty-state">
          <p className="portal-eyebrow">PENDAFTARAN TERKUNCI</p>
          <h1>Berkas telah memasuki meja panitia.</h1>
          <p>Perubahan dapat dilakukan kembali jika panitia meminta revisi.</p>
          <Link className="portal-button portal-button--primary" to="/portal">Kembali ke ikhtisar</Link>
        </main>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <main className="portal-main portal-registration">
        <header className="portal-registration__header">
          <div>
            <p className="portal-eyebrow">TABULA REGISTRATIONIS · {registration.id.toUpperCase()}</p>
            <h1>Bangun legiunmu.</h1>
          </div>
          <p>Draft tersimpan otomatis di perangkat ini ketika berpindah tahap.</p>
        </header>

        <ol className="portal-stepper" aria-label="Tahap pendaftaran">
          {steps.map((label, index) => (
            <li key={label} className={index === step ? 'is-current' : index < step ? 'is-complete' : ''}>
              <span>{String(index + 1).padStart(2, '0')}</span>{label}
            </li>
          ))}
        </ol>

        <section className="portal-form-panel">
          {step === 0 && (
            <fieldset className="portal-fieldset">
              <legend><span>I</span> Identitas tim</legend>
              <label>Nama tim<input {...register('teamName')} aria-invalid={Boolean(errors.teamName)} /></label>
              {errors.teamName && <p role="alert">{errors.teamName.message}</p>}
              <label>Institusi<input {...register('institution')} aria-invalid={Boolean(errors.institution)} /></label>
              {errors.institution && <p role="alert">{errors.institution.message}</p>}
            </fieldset>
          )}

          {step === 1 && (
            <fieldset className="portal-fieldset">
              <legend><span>II</span> Pilih arena</legend>
              <label>Pilih arena
                <select {...register('competitionId')} aria-invalid={Boolean(errors.competitionId)}>
                  <option value="">Pilih kategori perlombaan</option>
                  {PORTAL_COMPETITIONS.map((competition) => (
                    <option key={competition.id} value={competition.id}>
                      {competition.level} · {competition.name}
                    </option>
                  ))}
                </select>
              </label>
              {errors.competitionId && <p role="alert">{errors.competitionId.message}</p>}
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="portal-fieldset">
              <legend><span>III</span> Pemimpin legiun</legend>
              <label>Nama ketua<input {...register('leaderName')} aria-invalid={Boolean(errors.leaderName)} /></label>
              {errors.leaderName && <p role="alert">{errors.leaderName.message}</p>}
              <div className="portal-field-row">
                <label>Email ketua<input type="email" {...register('leaderEmail')} aria-invalid={Boolean(errors.leaderEmail)} /></label>
                <label>Nomor WhatsApp<input inputMode="tel" {...register('leaderPhone')} aria-invalid={Boolean(errors.leaderPhone)} /></label>
              </div>
              {errors.leaderEmail && <p role="alert">{errors.leaderEmail.message}</p>}
              {errors.leaderPhone && <p role="alert">{errors.leaderPhone.message}</p>}
            </fieldset>
          )}

          {step === 3 && (
            <fieldset className="portal-fieldset">
              <legend><span>IV</span> Dokumen identitas</legend>
              <p className="portal-fieldset__intro">File tidak diunggah. Prototype hanya menyimpan nama, tipe, ukuran, dan waktu modifikasi.</p>
              <label className="portal-file-field">Dokumen identitas
                <input aria-label="Dokumen identitas" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => addDocuments(event.target.files)} />
                <span>Pilih PDF atau gambar · maks. simulasi 1 berkas</span>
              </label>
              {documents.map((document) => (
                <div className="portal-file-row" key={`${document.name}-${document.lastModified}`}>
                  <span aria-hidden="true">PDF</span>
                  <div><strong>{document.name}</strong><small>{Math.max(1, Math.round(document.size / 1024))} KB · metadata lokal</small></div>
                </div>
              ))}
              {documentError && <p role="alert">{documentError}</p>}
            </fieldset>
          )}

          {step === 4 && (
            <div className="portal-review">
              <div className="portal-review__heading">
                <span aria-hidden="true">V</span>
                <div><p className="portal-eyebrow">RECOGNOSCERE</p><h2>Tinjau sebelum dikirim</h2></div>
              </div>
              <dl>
                <div><dt>Tim</dt><dd>{getValues('teamName')}</dd></div>
                <div><dt>Institusi</dt><dd>{getValues('institution')}</dd></div>
                <div><dt>Arena</dt><dd>{PORTAL_COMPETITIONS.find((item) => item.id === getValues('competitionId'))?.name}</dd></div>
                <div><dt>Ketua</dt><dd>{getValues('leaderName')} · {getValues('leaderEmail')}</dd></div>
                <div><dt>Dokumen</dt><dd>{documents.map((document) => document.name).join(', ')}</dd></div>
              </dl>
              <p className="portal-review__warning">Setelah dikirim, data terkunci sampai panitia meminta revisi.</p>
            </div>
          )}

          <div className="portal-form-actions">
            {step > 0 && <button className="portal-button portal-button--ghost" type="button" onClick={() => setStep((current) => current - 1)}>Kembali</button>}
            {step < 3 && <button className="portal-button portal-button--primary" type="button" onClick={continueStep}>Lanjutkan</button>}
            {step === 3 && <button className="portal-button portal-button--primary" type="button" onClick={reviewRegistration}>Tinjau pendaftaran</button>}
            {step === 4 && <button className="portal-button portal-button--primary" type="button" onClick={submitRegistration}>Kirim pendaftaran</button>}
          </div>
        </section>
      </main>
    </PortalShell>
  );
}
