import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent,
} from 'react';
import { competitions } from '../../content/jrc';
import { CompetitionModal } from './CompetitionModal';

const PORTRAIT_PATHS = [
  '/assets/roman-select/athena.webp',
  '/assets/roman-select/ares.webp',
  '/assets/roman-select/apollo.webp',
  '/assets/roman-select/antinous.webp',
  '/assets/roman-select/meleager.webp',
  '/assets/roman-select/hercules.webp',
] as const;

const SWIPE_THRESHOLD = 50;
const TRANSITION_FALLBACK_MS = 760;

type Direction = -1 | 1;

interface PortraitTransition {
  from: number;
  to: number;
  direction: Direction;
}

function formatPosition(index: number) {
  return String(index + 1).padStart(2, '0');
}

export function ShowcaseHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const activeIndexRef = useRef(0);
  const pointerInsideRef = useRef(false);
  const transitionLockedRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transition, setTransition] = useState<PortraitTransition | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const finishTransition = useCallback(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    transitionLockedRef.current = false;
    setTransition(null);
  }, []);

  const changeDivision = useCallback((direction: Direction) => {
    if (transitionLockedRef.current) return;

    const from = activeIndexRef.current;
    const to = (from + direction + competitions.length) % competitions.length;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    activeIndexRef.current = to;
    setActiveIndex(to);

    if (reducedMotion) {
      setTransition(null);
      return;
    }

    transitionLockedRef.current = true;
    setTransition({ from, to, direction });
    transitionTimerRef.current = setTimeout(finishTransition, TRANSITION_FALLBACK_MS);
  }, [finishTransition]);

  useEffect(() => {
    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      const section = sectionRef.current;
      const focusInside = Boolean(section?.contains(document.activeElement));
      if (!pointerInsideRef.current && !focusInside) return;

      event.preventDefault();
      changeDivision(event.key === 'ArrowRight' ? 1 : -1);
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [changeDivision]);

  useEffect(() => () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
  }, []);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartXRef.current = null;

    if (startX === null || endX === undefined) return;
    const distance = endX - startX;
    if (Math.abs(distance) < SWIPE_THRESHOLD) return;

    changeDivision(distance < 0 ? 1 : -1);
  };

  const current = competitions[activeIndex];
  const previousIndex = (activeIndex - 1 + competitions.length) % competitions.length;
  const nextIndex = (activeIndex + 1) % competitions.length;
  const previous = competitions[previousIndex];
  const next = competitions[nextIndex];
  const outgoing = transition ? competitions[transition.from] : null;
  const directionLabel = transition?.direction === -1 ? 'previous' : 'next';
  const total = formatPosition(competitions.length - 1);

  return (
    <section
      id="perlombaan"
      ref={sectionRef}
      className="showcase-hero"
      aria-labelledby="showcase-title"
      onPointerEnter={() => {
        pointerInsideRef.current = true;
      }}
      onPointerLeave={() => {
        pointerInsideRef.current = false;
      }}
    >
      <div className="character-selector">
        <p className="character-selector__eyebrow">Pilih arena</p>
        <div
          className="character-selector__stage"
          data-direction={directionLabel}
          data-transitioning={Boolean(transition)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            touchStartXRef.current = null;
          }}
        >
          <button
            type="button"
            className="character-selector__preview character-selector__preview--previous"
            aria-label={`Pilih ${previous.shortName} — pratinjau sebelumnya`}
            disabled={Boolean(transition)}
            onClick={() => changeDivision(-1)}
          >
            <span
              className="character-selector__preview-image"
              data-preview-src={PORTRAIT_PATHS[previousIndex]}
              aria-hidden="true"
              style={{ backgroundImage: `url(${PORTRAIT_PATHS[previousIndex]})` }}
            />
            <span className="character-selector__preview-name">{previous.shortName}</span>
          </button>

          <button
            type="button"
            className="character-selector__arrow character-selector__arrow--previous"
            aria-label="Pilih divisi sebelumnya"
            onClick={() => changeDivision(-1)}
          >
            <span aria-hidden="true">{'<'}</span>
          </button>

          <div className="character-selector__portal">
            <span className="character-selector__light-sweep" aria-hidden="true" />
            {transition && outgoing ? (
              <div
                className="character-selector__portrait character-selector__portrait--outgoing"
                data-phase="outgoing"
                aria-hidden="true"
                key={`outgoing-${transition.from}`}
              >
                <img
                  className="character-selector__plate character-selector__plate--backdrop"
                  src={PORTRAIT_PATHS[transition.from]}
                  alt=""
                  draggable={false}
                  aria-hidden="true"
                />
                <img
                  className="character-selector__plate character-selector__plate--subject"
                  src={PORTRAIT_PATHS[transition.from]}
                  alt=""
                  draggable={false}
                />
              </div>
            ) : null}

            <div
              className={`character-selector__portrait${transition ? ' character-selector__portrait--incoming' : ''}`}
              data-phase={transition ? 'incoming' : 'current'}
              key={`portrait-${activeIndex}`}
              onAnimationEnd={(event) => {
                if (event.currentTarget === event.target) finishTransition();
              }}
            >
              <img
                className="character-selector__plate character-selector__plate--backdrop"
                src={PORTRAIT_PATHS[activeIndex]}
                alt=""
                draggable={false}
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                fetchPriority="low"
              />
              <img
                className="character-selector__plate character-selector__plate--subject"
                src={PORTRAIT_PATHS[activeIndex]}
                alt={`${current.shortName} — ${current.discipline}`}
                draggable={false}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
              />
            </div>
          </div>

          <button
            type="button"
            className="character-selector__arrow character-selector__arrow--next"
            aria-label="Pilih divisi berikutnya"
            onClick={() => changeDivision(1)}
          >
            <span aria-hidden="true">{'>'}</span>
          </button>

          <button
            type="button"
            className="character-selector__preview character-selector__preview--next"
            aria-label={`Pilih ${next.shortName} — pratinjau berikutnya`}
            disabled={Boolean(transition)}
            onClick={() => changeDivision(1)}
          >
            <span
              className="character-selector__preview-image"
              data-preview-src={PORTRAIT_PATHS[nextIndex]}
              aria-hidden="true"
              style={{ backgroundImage: `url(${PORTRAIT_PATHS[nextIndex]})` }}
            />
            <span className="character-selector__preview-name">{next.shortName}</span>
          </button>
        </div>

        <h2
          id="showcase-title"
          className="character-selector__name"
          data-direction={directionLabel}
          data-transitioning={Boolean(transition)}
          key={`division-name-${activeIndex}`}
        >
          {current.shortName}
        </h2>

        <div className="character-selector__footer">
          <div className="character-selector__division">
            <p className="character-selector__discipline">{current.discipline}</p>
            <p className="character-selector__status">
              {current.level} · Ketentuan JRC XIV belum final
            </p>
          </div>

          <div className="character-selector__action">
            <span className="character-selector__counter" aria-hidden="true">
              {formatPosition(activeIndex)}/{total}
            </span>
            <button
              type="button"
              className="character-selector__link"
              aria-haspopup="dialog"
              aria-expanded={modalOpen}
              onClick={() => setModalOpen(true)}
            >
              Lihat divisi
            </button>
          </div>
        </div>

        <CompetitionModal
          competition={current}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          portraitSrc={PORTRAIT_PATHS[activeIndex]}
        />

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {current.shortName}, {current.discipline}, divisi {activeIndex + 1} dari {competitions.length}
        </p>
      </div>
    </section>
  );
}

export default ShowcaseHero;
