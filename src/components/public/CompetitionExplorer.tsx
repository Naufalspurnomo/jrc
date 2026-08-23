import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { competitions, type Competition } from '../../content/jrc';

/* Roman-themed character portraits per discipline (Wikimedia Commons, CC). */

const ART_BY_SLUG: Record<string, string> = {
  'donatopia-transporter': '/assets/cs-cart.webp',
  'nightmaze-rescue-transporter': '/assets/cs-lamp.webp',
  'pirate-clash-transporter-shooter': '/assets/cs-ballista.webp',
  'wacky-rally-line-follower-mikro': '/assets/cs-chariot.webp',
  'ring-rumble-sumo': '/assets/cs-gladiator.webp',
  'goal-rush-soccer': '/assets/cs-ball.webp',
};

type AccentKey = Competition['accent'];

const ACCENTS: Record<AccentKey, { main: string; deep: string; text: string }> = {
  gold: { main: '#c99a3a', deep: '#8a6520', text: '#7a5b1c' },
  crimson: { main: '#c0473a', deep: '#7d2d25', text: '#6e241d' },
  blue: { main: '#3d7fb5', deep: '#24527a', text: '#1f4a6e' },
};

/* Per-arena stats: Latin + Indonesian labels, 1-5 scale. */
const STATS = [
  { latin: 'VIS', label: 'Kekuatan' },
  { latin: 'CELERITAS', label: 'Kecepatan' },
  { latin: 'PRECISIO', label: 'Presisi' },
  { latin: 'ROBUR', label: 'Daya tahan' },
] as const;

const ARENA_STATS: Record<string, readonly number[]> = {
  'donatopia-transporter': [3, 4, 5, 4],
  'nightmaze-rescue-transporter': [4, 3, 5, 5],
  'pirate-clash-transporter-shooter': [5, 3, 5, 4],
  'wacky-rally-line-follower-mikro': [3, 5, 4, 4],
  'ring-rumble-sumo': [5, 3, 3, 5],
  'goal-rush-soccer': [4, 5, 5, 4],
};

const EMBERS = [
  { left: '12%', top: '30%', d: 0, s: 7 },
  { left: '22%', top: '62%', d: 1.2, s: 5 },
  { left: '38%', top: '18%', d: 2.1, s: 6 },
  { left: '61%', top: '26%', d: 0.6, s: 5 },
  { left: '72%', top: '58%', d: 1.8, s: 7 },
  { left: '86%', top: '34%', d: 2.6, s: 6 },
  { left: '30%', top: '78%', d: 3.2, s: 5 },
  { left: '68%', top: '12%', d: 0.9, s: 4 },
] as const;

function RomanFrame({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 300 400" className="cs-card__frame" aria-hidden="true">
      <rect x="10" y="10" width="280" height="380" fill="none" stroke={accent} strokeWidth="1.4" opacity=".55" />
      <rect x="16" y="16" width="268" height="368" fill="none" stroke={accent} strokeWidth=".6" opacity=".3" />
      {[
        [10, 10],
        [290, 10],
        [10, 390],
        [290, 390],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <circle r="4.5" fill="none" stroke={accent} strokeWidth="1" />
          <circle r="1.5" fill={accent} />
          <path d="M-12 0 H-5 M5 0 H12 M0 -12 V-5 M0 5 V12" stroke={accent} strokeWidth=".8" opacity=".65" />
        </g>
      ))}
    </svg>
  );
}

function ArenaCard({
  competition,
  isActive,
  onPick,
}: {
  competition: Competition;
  isActive: boolean;
  onPick: () => void;
}) {
  const accent = ACCENTS[competition.accent].main;

  return (
    <article
      className={`cs-card ${isActive ? 'cs-card--active' : ''}`}
      data-active={isActive}
      data-testid="competition-entry"
      onClick={isActive ? undefined : onPick}
      role={isActive ? undefined : 'button'}
      aria-label={isActive ? undefined : `Pilih ${competition.shortName}`}
    >
      <RomanFrame accent={accent} />
      <img
        className="cs-card__art"
        src={ART_BY_SLUG[competition.slug]}
        alt=""
        loading="lazy"
        decoding="async"
        width="600"
        height="800"
      />
      <div className="cs-card__overlay" />
      <span className="cs-card__numeral" aria-hidden="true">
        {competition.romanNumeral}
      </span>
      <span className="cs-card__name" aria-hidden="true">
        {competition.shortName}
      </span>
      {isActive && <span className="cs-card__glow-border" aria-hidden="true" />}
    </article>
  );
}

export function CompetitionExplorer() {
  const [active, setActive] = useState(0);
  const [prevActive, setPrevActive] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((index: number) => {
    setActive((current) => {
      const next = Math.max(0, Math.min(competitions.length - 1, index));
      setPrevActive(current);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') goTo(active - 1);
      if (event.key === 'ArrowRight') goTo(active + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, goTo]);

  const current = competitions[active];
  const accent = ACCENTS[current.accent];
  const stats = ARENA_STATS[current.slug];

  return (
    <section id="perlombaan" className="character-select" aria-labelledby="competition-title">
      <div className="site-shell page-shell">
        <header className="character-select__header">
          <div>
            <p className="site-kicker kicker">Disciplina · VI</p>
            <h2 id="competition-title">Pilih arenamu.</h2>
            <p className="character-select__sub">Enam robot. Enam cara membuktikan mesinmu.</p>
          </div>
          <div className="character-select__controls">
            <span className="character-select__counter" aria-live="polite">
              {String(active + 1).padStart(2, '0')}
              <i aria-hidden="true" />
              {String(competitions.length).padStart(2, '0')}
            </span>
            <div className="character-select__nav">
              <button
                type="button"
                className="character-select__arrow"
                aria-label="Karakter sebelumnya"
                disabled={active === 0}
                onClick={() => goTo(active - 1)}
              >
                ←
              </button>
              <button
                type="button"
                className="character-select__arrow"
                aria-label="Karakter berikutnya"
                disabled={active === competitions.length - 1}
                onClick={() => goTo(active + 1)}
              >
                →
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Arena atmosphere container */}
      <div
        className="cs-arena"
        ref={stageRef}
        style={
          {
            '--cs-accent': accent.main,
            '--cs-accent-deep': accent.deep,
          } as React.CSSProperties
        }
      >
        <span className="cs-arena__glow" aria-hidden="true" />
        <span className="cs-arena__ghost" key={active} aria-hidden="true">
          {current.romanNumeral}
        </span>
        {EMBERS.map((ember, index) => (
          <span
            className="cs-arena__ember"
            key={index}
            aria-hidden="true"
            style={{
              left: ember.left,
              top: ember.top,
              animationDelay: `${ember.d}s`,
              width: ember.s,
              height: ember.s,
            }}
          />
        ))}

        <div className="site-shell page-shell cs-arena__panels">
          {/* Left panel: arena card grid */}
          <div className="cs-arena__cards">
            {competitions.map((competition, index) => (
              <ArenaCard
                key={competition.slug}
                competition={competition}
                isActive={index === active}
                onPick={() => goTo(index)}
              />
            ))}
          </div>

          {/* Right panel: HUD */}
          <div className="cs-arena__hud" key={active}>
            <div className="cs-hud__identity">
              <p className="cs-hud__eyebrow">
                Arena {current.romanNumeral} · {current.fixtureLabel}
              </p>
              <h3>{current.shortName}</h3>
              <p className="cs-hud__discipline">{current.discipline}</p>
              <p className="cs-hud__provocation">"{current.provocation}"</p>
            </div>

            <div className="cs-hud__divider" aria-hidden="true" />

            <div className="cs-hud__text">
              <p className="cs-hud__description">{current.description}</p>
              <p className="cs-hud__objective">
                <span className="cs-hud__obj-label">Tujuan</span>
                {current.objective}
              </p>
            </div>

            <dl className="cs-hud__stats">
              {STATS.map((stat, statIndex) => (
                <div className="cs-stat" key={stat.latin}>
                  <div className="cs-stat__head">
                    <span className="cs-stat__latin">{stat.latin}</span>
                    <span className="cs-stat__label">{stat.label}</span>
                    <span className="cs-stat__value">{stats[statIndex]}/5</span>
                  </div>
                  <div className="cs-stat__track">
                    <i
                      className="cs-stat__fill"
                      style={{
                        width: `${(stats[statIndex] / 5) * 100}%`,
                        animationDelay: `${180 + statIndex * 130}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </dl>

            <div className="cs-hud__action">
              <Link
                className="cs-hud__cta"
                to={`/perlombaan/${current.slug}`}
                aria-label={`Pilih ${current.shortName}`}
              >
                Pilih arena
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="site-shell page-shell character-select__footer">
        <p className="character-select__hint">← → geser · klik tetangga · scroll bebas</p>
        <div className="character-select__dots" role="tablist" aria-label="Pilih arena">
          {competitions.map((competition, index) => (
            <button
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={`Arena ${competition.shortName}`}
              className="character-select__dot"
              data-active={index === active}
              data-accent={competition.accent}
              key={competition.slug}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
