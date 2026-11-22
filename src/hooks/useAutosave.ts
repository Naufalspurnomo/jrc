import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  /** Persist the current values. Reject to surface the error state. */
  save: () => Promise<void>;
  /** Debounce window in ms. */
  delay?: number;
  /** When false, nothing is scheduled (e.g. read-only statuses). */
  enabled?: boolean;
}

/**
 * Debounced autosave. The caller bumps `schedule` whenever a field changes; the
 * hook waits for typing to settle, then saves once.
 *
 * Saves never overlap: a change arriving mid-flight queues exactly one follow-up
 * run, and `flush` waits for the in-flight save to settle before starting its
 * own. Without that, `flush` would resolve early and a caller (submit) could
 * proceed against data the server has not stored yet.
 */
export function useAutosave({ save, delay = 800, enabled = true }: UseAutosaveOptions) {
  const [state, setState] = useState<AutosaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const queued = useRef(false);
  const saveRef = useRef(save);
  const mounted = useRef(true);

  saveRef.current = save;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const run = useCallback(async (): Promise<void> => {
    if (inFlight.current) {
      // A save is already running; make sure exactly one more follows it.
      queued.current = true;
      return inFlight.current;
    }

    const promise = (async () => {
      setState('saving');
      try {
        await saveRef.current();
        if (!mounted.current) return;
        setState('saved');
        setSavedAt(new Date());
      } catch (error) {
        if (mounted.current) setState('error');
        throw error;
      }
    })().finally(() => {
      inFlight.current = null;
    });

    inFlight.current = promise;
    await promise;

    if (queued.current && mounted.current) {
      queued.current = false;
      await run();
    }
  }, []);

  const schedule = useCallback(() => {
    if (!enabled) return;
    setState('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void run().catch(() => undefined);
    }, delay);
  }, [delay, enabled, run]);

  /** Persist now and wait until every pending save has settled. */
  const flush = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // Drain any save already in flight before starting the final one.
    while (inFlight.current) {
      await inFlight.current.catch(() => undefined);
    }
    await run();
  }, [enabled, run]);

  return { state, savedAt, schedule, flush };
}
