import { useEffect, useRef, useState } from 'react';

import './EntryGate.css';

interface EntryGateProps {
  duration?: number;
  reducedMotion?: boolean;
  onComplete?: () => void;
}

export function EntryGate({
  duration = 2400,
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  onComplete,
}: EntryGateProps) {
  const [visible, setVisible] = useState(!reducedMotion);
  const [active, setActive] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const complete = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      setVisible(false);
      onCompleteRef.current?.();
    };

    if (reducedMotion) {
      complete();
      return undefined;
    }

    let activationTimer = 0;
    let completionTimer = 0;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        activationTimer = window.setTimeout(() => {
          setActive(true);
          completionTimer = window.setTimeout(complete, duration);
          }, 50);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(activationTimer);
      window.clearTimeout(completionTimer);
    };
  }, [duration, reducedMotion]);

  if (!visible) return null;

  const half = (side: 'left' | 'right') => (
    <div className={`gate-entry__leaf gate-entry__leaf--${side}`}>
      <div className="gate-entry__wall"><span className="gate-entry__masonry" /></div>
      <div className="gate-entry__door"><i /><b /></div>
      <div className="gate-entry__pier">
        <i className="gate-entry__impost" />
        <i className="gate-entry__capital" />
        <i className="gate-entry__shaft" />
        <i className="gate-entry__base" />
        <i className="gate-entry__plinth" />
      </div>
    </div>
  );

  return (
    <div
      className={`gate-entry${active ? ' gate-entry--active' : ''}`}
      data-testid="entry-gate"
      aria-hidden="true"
      style={{ '--gate-duration': `${duration}ms` } as React.CSSProperties}
    >
      <div className="gate-entry__ambient" />
      <div className="gate-entry__portal">
        <div className="gate-entry__portal-glow" />
        <i />
      </div>
      <div className="gate-entry__light" />
      {half('left')}
      {half('right')}
      <div className="gate-entry__arch" role="presentation">
        <div className="gate-entry__arch-half gate-entry__arch-half--left"><i /></div>
        <div className="gate-entry__arch-half gate-entry__arch-half--right"><i /></div>
      </div>
      <div className="gate-entry__entablature">
        <i className="gate-entry__cornice" />
        <i className="gate-entry__frieze" />
        <span>JRC XIV · MMXXVI</span>
      </div>
      <div className="gate-entry__standard gate-entry__standard--left"><i /><b /></div>
      <div className="gate-entry__standard gate-entry__standard--right"><i /><b /></div>
      <div className="gate-entry__seal">
        <i className="gate-entry__bracket gate-entry__bracket--left" />
        <i className="gate-entry__bracket gate-entry__bracket--right" />
        <i className="gate-entry__stud gate-entry__stud--nw" />
        <i className="gate-entry__stud gate-entry__stud--ne" />
        <i className="gate-entry__stud gate-entry__stud--sw" />
        <i className="gate-entry__stud gate-entry__stud--se" />
        <img src="/assets/brand/jrc14-logo-transparent-512.webp" alt="" width="256" height="442" />
      </div>
    </div>
  );
}

export default EntryGate;
