import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import type { Competition } from '../../content/jrc';
import { lockDocumentScroll } from '../../hooks/scrollLock';

const ACCENT_MAP: Record<Competition['accent'], { border: string; glow: string; text: string }> = {
  gold: { border: '#d7a63b', glow: 'rgb(215 166 59 / 28%)', text: '#f2cc74' },
  crimson: { border: '#8c2928', glow: 'rgb(140 41 40 / 30%)', text: '#e8a09e' },
  blue: { border: '#2a5a8a', glow: 'rgb(42 90 138 / 28%)', text: '#9ec2e8' },
};

interface CompetitionModalProps {
  competition: Competition | null;
  open: boolean;
  onClose: () => void;
  portraitSrc?: string;
}

export function CompetitionModal({ competition, open, onClose, portraitSrc }: CompetitionModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const appRoot = document.getElementById('root');
    const previousRootInert = appRoot?.hasAttribute('inert') ?? false;
    const scrollLock = lockDocumentScroll();
    appRoot?.setAttribute('inert', '');

    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      const root = dialogRef.current;
      if (!root) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!root.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (appRoot && !previousRootInert) appRoot.removeAttribute('inert');
      scrollLock.release({ restoreFocus: previousFocus });
    };
  }, [open]);

  if (!open || !competition) return null;

  const accent = ACCENT_MAP[competition.accent];

  const modal = (
    <div
      ref={dialogRef}
      className="arena-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      tabIndex={-1}
      data-accent={competition.accent}
      style={
        {
          '--arena-accent': accent.border,
          '--arena-glow': accent.glow,
          '--arena-accent-text': accent.text,
        } as CSSProperties
      }
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div className="arena-modal__backdrop" aria-hidden="true" onClick={() => onCloseRef.current()} />
      <div className="arena-modal__panel">
        <button
          ref={closeRef}
          type="button"
          className="arena-modal__close"
          aria-label="Tutup detail arena"
          onClick={() => onCloseRef.current()}
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="arena-modal__media" aria-hidden="true">
          {portraitSrc ? (
            <img className="arena-modal__portrait" src={portraitSrc} alt="" draggable={false} />
          ) : (
            <div className="arena-modal__portrait-fallback" />
          )}
          <span className="arena-modal__numeral" aria-hidden="true">
            {competition.romanNumeral}
          </span>
        </div>

        <div className="arena-modal__body">
          <p className="arena-modal__eyebrow">
            {competition.fixtureLabel} · {competition.level} · {competition.discipline}
          </p>
          <h2 id={titleId} className="arena-modal__title">
            <span className="arena-modal__title-short">{competition.shortName}</span>
            <span className="arena-modal__title-full" aria-hidden="true">{competition.name}</span>
            <span className="sr-only">{competition.name}</span>
          </h2>
          <p className="arena-modal__provocation">“{competition.provocation}”</p>
          <p id={descId} className="arena-modal__description">
            {competition.description}
          </p>
          <blockquote className="arena-modal__objective">{competition.objective}</blockquote>

          <dl className="arena-modal__meta">
            <div>
              <dt>Jenjang</dt>
              <dd>{competition.level}</dd>
            </div>
            <div>
              <dt>Biaya</dt>
              <dd>{competition.fee}</dd>
            </div>
            <div>
              <dt>Guidebook</dt>
              <dd>{competition.guidebook.status}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{competition.fixtureLabel}</dd>
            </div>
          </dl>

          <div className="arena-modal__actions">
            <Link
              className="site-action site-action--primary"
              to="/portal/masuk"
              onClick={() => onCloseRef.current()}
            >
              Buka demo portal peserta <span aria-hidden="true">↗</span>
            </Link>
            <Link
              className="site-action site-action--quiet"
              to={`/perlombaan/${competition.slug}`}
              onClick={() => onCloseRef.current()}
            >
              Halaman penuh
            </Link>
            <button type="button" className="site-action site-action--quiet" onClick={() => onCloseRef.current()}>
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default CompetitionModal;
