import { useEffect, useState } from 'react';

import { registrationDeadline } from '../../content/jrc';
import HeroExperience from '../../scene/HeroExperience';

const registrationDeadlineAt = new Date(registrationDeadline).getTime();

interface RemainingTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  complete: boolean;
}

function getRemainingTime(now = Date.now()): RemainingTime {
  const distance = Math.max(registrationDeadlineAt - now, 0);

  return {
    days: Math.floor(distance / 86_400_000),
    hours: Math.floor((distance % 86_400_000) / 3_600_000),
    minutes: Math.floor((distance % 3_600_000) / 60_000),
    seconds: Math.floor((distance % 60_000) / 1_000),
    complete: distance === 0,
  };
}

export function HeroSection() {
  const [remaining, setRemaining] = useState(() => getRemainingTime());

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getRemainingTime()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = [
    { label: 'Hari', value: remaining.days },
    { label: 'Jam', value: remaining.hours },
    { label: 'Menit', value: remaining.minutes },
    { label: 'Detik', value: remaining.seconds },
  ];

  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-section__visual" aria-hidden="true">
        <HeroExperience />
      </div>
      <div className="hero-section__engravings" aria-hidden="true">
        <picture className="hero-section__engraving hero-section__engraving--colosseum">
          <source srcSet="/assets/hero-roman/colosseum-engraving.avif" type="image/avif" />
          <img src="/assets/hero-roman/colosseum-engraving.webp" width="1600" height="1045" alt="" />
        </picture>
        <picture className="hero-section__engraving hero-section__engraving--arch-left">
          <img src="/assets/hero-roman/roman-triumphal-arch.jpg" width="1310" height="930" alt="" />
        </picture>
      </div>
      <div className="hero-section__shade" aria-hidden="true" />
      <div className="hero-section__content site-shell page-shell">
        <p className="hero-section__serial">
          <span>Est. 2012</span>
          <span aria-hidden="true" />
          <span>XIV Edition</span>
        </p>

        <div className="hero-section__title-lockup">
          <p className="hero-section__theme">Imperium Machina</p>
          <h1 id="hero-title">
            <span>Java Robot</span>
            {' '}
            <span>Contest</span>
            {' '}
            <strong>XIV</strong>
          </h1>
          <p className="hero-section__declaration">
            Rise as Engineers, Fight as Gladiators
          </p>

          <div
            className="hero-section__countdown"
            role="timer"
            aria-label={remaining.complete ? 'Pendaftaran telah ditutup' : 'Hitung mundur penutupan pendaftaran'}
            data-complete={remaining.complete ? 'true' : 'false'}
          >
            <p className="hero-section__countdown-label">Pendaftaran berakhir · 15 Oktober 2026</p>
            {remaining.complete ? (
              <p className="hero-section__countdown-complete">Pendaftaran telah ditutup.</p>
            ) : (
              <ol className="hero-section__countdown-grid">
                {countdown.map((unit) => (
                  <li key={unit.label}>
                    <strong>{String(unit.value).padStart(2, '0')}</strong>
                    <span>{unit.label}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="hero-section__actions" aria-label="Aksi utama">
          <a className="site-action site-action--primary button-primary" href="#perlombaan">
            Jelajahi perlombaan
            <span aria-hidden="true">↓</span>
          </a>
          <a className="site-action site-action--quiet button-secondary" href="#jadwal">
            Lihat perjalanan
          </a>
        </div>

        <div className="hero-section__threshold" aria-hidden="true">
          <span>Scroll</span>
          <i />
        </div>
      </div>
    </section>
  );
}
