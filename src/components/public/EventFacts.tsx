import { useEffect, useState } from 'react';

import { eventFacts } from '../../content/jrc';

const registrationDeadline = new Date('2026-10-15T23:59:59+07:00').getTime();

interface RemainingTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  complete: boolean;
}

function getRemainingTime(now = Date.now()): RemainingTime {
  const distance = Math.max(registrationDeadline - now, 0);
  return {
    days: Math.floor(distance / 86_400_000),
    hours: Math.floor((distance % 86_400_000) / 3_600_000),
    minutes: Math.floor((distance % 3_600_000) / 60_000),
    seconds: Math.floor((distance % 60_000) / 1_000),
    complete: distance === 0,
  };
}

const facts = [
  { key: 'period', label: 'Periode pendaftaran', value: eventFacts.registration },
  { key: 'event-date', label: 'Hari pertandingan', value: eventFacts.eventDate },
  { key: 'venue', label: 'Lokasi', value: 'PENS, Surabaya' },
] as const;

export function EventFacts() {
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
    <section id="informasi" className="event-brief" aria-labelledby="event-brief-title">
      <div className="event-brief__glow" aria-hidden="true" />
      <div className="event-brief__inner site-shell page-shell">
        <header className="event-brief__intro">
          <p className="event-brief__kicker">Informasi penyelenggaraan · JRC XIV</p>
          <h2 id="event-brief-title">Pendaftaran ditutup dalam</h2>
          <p className="event-brief__deadline">15 Oktober 2026</p>
          <p className="event-brief__description">
            Pastikan tim menyelesaikan pendaftaran sebelum hari terakhir.
          </p>
        </header>

        <div
          className="event-brief__countdown"
          role="timer"
          aria-live="polite"
          aria-label={remaining.complete ? 'Pendaftaran telah ditutup' : 'Hitung mundur penutupan pendaftaran'}
          data-complete={remaining.complete ? 'true' : 'false'}
        >
          {remaining.complete ? (
            <p className="event-brief__complete">Pendaftaran telah ditutup.</p>
          ) : (
            <ol className="event-brief__countdown-grid">
              {countdown.map((unit) => (
                <li className="event-brief__time-unit" key={unit.label}>
                  <strong>{String(unit.value).padStart(2, '0')}</strong>
                  <span>{unit.label}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="event-brief__countdown-note">Batas akhir: 15 Oktober 2026</p>
        </div>

        <dl className="event-brief__details" aria-label="Informasi utama JRC">
          {facts.map((fact) => (
            <div className="event-brief__fact" data-fact={fact.key} key={fact.key}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
