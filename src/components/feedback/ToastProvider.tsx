import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from 'react';

export type ToastTone = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; tone: ToastTone }
interface ToastContextValue {
  showToast(message: string, tone?: ToastTone): void;
  dismissToast(id: number): void;
}

const TOAST_DURATION = 5000;
const MAX_TOASTS = 4;
const ToastContext = createContext<ToastContextValue>({
  showToast: () => undefined,
  dismissToast: () => undefined,
});

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss(id: number): void }) {
  const remainingRef = useRef(TOAST_DURATION);
  const startedAtRef = useRef(0);
  const timeoutRef = useRef<number | undefined>(undefined);
  const pausedRef = useRef(false);

  const stopTimer = useCallback(() => {
    if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
    if (!pausedRef.current && startedAtRef.current) {
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
    }
  }, []);

  const startTimer = useCallback(() => {
    if (pausedRef.current || timeoutRef.current !== undefined) return;
    startedAtRef.current = Date.now();
    timeoutRef.current = window.setTimeout(() => dismiss(toast.id), remainingRef.current);
  }, [dismiss, toast.id]);

  useEffect(() => {
    startTimer();
    return stopTimer;
  }, [startTimer, stopTimer]);

  const pause = () => {
    if (pausedRef.current) return;
    stopTimer();
    pausedRef.current = true;
  };
  const resume = () => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    startTimer();
  };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) resume();
  };

  return (
    <div
      className={`global-toast global-toast--${toast.tone}`}
      role="group"
      aria-label={`Notifikasi: ${toast.message}`}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          dismiss(toast.id);
        }
      }}
    >
      <span>{toast.message}</span>
      <button type="button" aria-label="Tutup notifikasi" onClick={() => dismiss(toast.id)}>×</button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextIdRef = useRef(1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) return;
    const id = nextIdRef.current++;
    setToasts((current) => [...current.filter((toast) => !(toast.message === normalizedMessage && toast.tone === tone)), { id, message: normalizedMessage, tone }].slice(-MAX_TOASTS));
    setAnnouncement(normalizedMessage);
  }, []);
  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="admin-sr-only" aria-label="Pengumuman notifikasi" aria-live="polite" aria-atomic="true">{announcement ? <span aria-label={announcement} /> : null}</div>
      <div className="global-toast-viewport" aria-label="Notifikasi">
        {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} dismiss={dismissToast} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
