import { useEffect, useRef, useState } from 'react';

import './EntryGate.css';

export const DEFAULT_ENTRY_ASSETS = [
  '/assets/hero-rome-wide.webp',
  '/assets/hero-rome-depth.png',
  '/assets/batu-knight@2x.webp',
  '/assets/batu-knight-depth.png',
] as const;

export async function preloadImages(
  assets: readonly string[],
  onProgress: (progress: number) => void,
  ImageConstructor: typeof Image = Image,
): Promise<void> {
  if (assets.length === 0) {
    onProgress(1);
    return;
  }

  let complete = 0;
  await Promise.all(
    assets.map(
      (asset) =>
        new Promise<void>((resolve) => {
          const image = new ImageConstructor();
          const settle = () => {
            complete += 1;
            onProgress(complete / assets.length);
            resolve();
          };
          image.onload = settle;
          image.onerror = settle;
          image.src = asset;
        }),
    ),
  );
}

interface EntryGateProps {
  assets?: readonly string[];
  imageConstructor?: typeof Image;
  minDuration?: number;
  onReady?: () => void;
}

export function EntryGate({
  assets = DEFAULT_ENTRY_ASSETS,
  imageConstructor,
  minDuration = 850,
  onReady,
}: EntryGateProps) {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;
    const startedAt = performance.now();

    const finish = async () => {
      await preloadImages(
        assets,
        (nextProgress) => {
          if (!cancelled) setProgress(nextProgress);
        },
        imageConstructor,
      );
      const remainder = Math.max(0, minDuration - (performance.now() - startedAt));
      await new Promise((resolve) => window.setTimeout(resolve, remainder));
      if (!cancelled) {
        setReady(true);
        onReadyRef.current?.();
      }
    };

    void finish();
    return () => {
      cancelled = true;
    };
  }, [assets, imageConstructor, minDuration]);

  const percentage = Math.round(progress * 100);

  return (
    <div
      className={`gate-entry${ready ? ' gate-entry--ready' : ''}`}
      data-testid="entry-gate"
      aria-hidden={ready ? 'true' : undefined}
    >
      <div className="gate-entry__architecture" aria-hidden="true">
        <span className="gate-entry__column gate-entry__column--left" />
        <span className="gate-entry__arch" />
        <span className="gate-entry__column gate-entry__column--right" />
      </div>
      <div className="gate-entry__content" role="status" aria-live="polite">
        <span className="gate-entry__eyebrow">JRC XIV · MMXXVI</span>
        <strong className="gate-entry__mark">XIV</strong>
        <span className="gate-entry__label">Mempersiapkan arena</span>
        <span className="gate-entry__progress" aria-label={`${percentage}%`}>
          <span
            className="gate-entry__progress-fill"
            style={{ '--gate-progress': progress } as React.CSSProperties}
          />
        </span>
        <span className="gate-entry__number" aria-hidden="true">
          {percentage.toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}

export default EntryGate;
