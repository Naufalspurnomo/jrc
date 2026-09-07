import type { PublicTicketVerification } from '../../features/registration/publicTicket';
import { getScannerResultPresentation } from '../../features/registration/scanner';

export function PublicTicketResult({ verification }: { verification: PublicTicketVerification }) {
  const presentation = getScannerResultPresentation(verification.result);
  const showIdentity = verification.result === 'VALID' || verification.result === 'CHECKED_IN';

  return (
    <article role="status" aria-live="polite">
      <p>{presentation.label}</p>
      <p>{presentation.description}</p>
      {showIdentity && (
        <dl>
          {verification.teamName && <div><dt>Tim</dt><dd>{verification.teamName}</dd></div>}
          {verification.institution && <div><dt>Institusi</dt><dd>{verification.institution}</dd></div>}
          {verification.competitionName && <div><dt>Kompetisi</dt><dd>{verification.competitionName}</dd></div>}
          {verification.registrationNumber && (
            <div><dt>Nomor pendaftaran</dt><dd>{verification.registrationNumber}</dd></div>
          )}
          {verification.eventName && <div><dt>Acara</dt><dd>{verification.eventName}</dd></div>}
        </dl>
      )}
    </article>
  );
}