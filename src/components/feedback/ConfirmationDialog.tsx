import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmationLabel: string;
  confirmationValue: string;
  pending?: boolean;
  onConfirmationChange(value: string): void;
  onCancel(): void;
  onConfirm(): void;
}

const FOCUSABLE_SELECTOR = 'input:not(:disabled),button:not(:disabled),[href],[tabindex]:not([tabindex="-1"])';

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmationLabel,
  confirmationValue,
  pending = false,
  onConfirmationChange,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(pending);
  const cancelRef = useRef(onCancel);
  pendingRef.current = pending;
  cancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!pendingRef.current) {
          event.preventDefault();
          cancelRef.current();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  const matches = Boolean(confirmationLabel) && confirmationValue === confirmationLabel;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (matches && !pending) onConfirm();
  };

  return createPortal(
    <div className="confirmation-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onCancel();
    }}>
      <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="confirmation-dialog">
        <p className="confirmation-dialog__eyebrow">TINDAKAN DESTRUKTIF</p>
        <h2 id={titleId}>{title}</h2>
        <div id={descriptionId} className="confirmation-dialog__description">{description}</div>
        <form onSubmit={submit}>
          <label htmlFor={inputId}>Ketik <strong>{confirmationLabel}</strong> untuk mengonfirmasi</label>
          <input id={inputId} ref={inputRef} value={confirmationValue} disabled={pending} autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={(event) => onConfirmationChange(event.target.value)} />
          <div className="confirmation-dialog__actions">
            <button type="button" disabled={pending} onClick={onCancel}>Batal</button>
            <button className="is-danger" type="submit" disabled={!matches || pending}>
              {pending ? 'Menghapus…' : 'Hapus permanen'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
