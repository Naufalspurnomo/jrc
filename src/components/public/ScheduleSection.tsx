import type { CSSProperties } from 'react';

import { eventSchedule } from '../../content/jrc';

const routePath =
  'M36 10 C 34 104, 89 119, 89 215 S 28 327, 35 430 S 92 548, 87 654 S 33 772, 39 890';

export function ScheduleSection() {
  return (
    <section id="jadwal" className="schedule-section" aria-labelledby="schedule-title">
      <div className="schedule-arrival">
        <picture className="schedule-arrival__architecture" aria-hidden="true">
          <source media="(max-width: 640px)" srcSet="/assets/arena-interior-wide-mobile.webp" />
          <source srcSet="/assets/arena-interior-wide.avif" type="image/avif" />
          <img src="/assets/arena-interior-wide.webp" alt="" loading="lazy" />
        </picture>
        <div className="schedule-arrival__shade" aria-hidden="true" />

        <div className="site-shell page-shell schedule-arrival__inner">
          <div className="schedule-arrival__index" aria-label="Bagian empat dari perjalanan JRC XIV">
            <span>IV</span>
            <span>JRC XIV</span>
          </div>

          <header className="schedule-section__header">
            <p className="schedule-section__marker">Iter ad arenam</p>
            <h2 id="schedule-title" aria-label="Jalan menuju arena.">
              <span aria-hidden="true">Jalan</span>
              <span aria-hidden="true">menuju arena.</span>
            </h2>
            <p>
              Setiap tim melewati gerbang yang sama. Tanggal resmi akan ditempatkan di sini begitu
              keputusan panitia diumumkan.
            </p>
          </header>

        </div>
      </div>

      <div className="schedule-program">
        <div className="schedule-program__stone" aria-hidden="true" />
        <div className="site-shell page-shell schedule-program__inner">
          <div className="schedule-program__heading">
            <p>Program perjalanan</p>
            <span>Empat gerbang. Satu arena.</span>
          </div>

          <div className="schedule-route">
            <svg className="schedule-route__line" viewBox="0 0 120 900" preserveAspectRatio="none" aria-hidden="true">
              <path className="schedule-route__bed" d={routePath} pathLength="1" />
              <path id="schedule-via-track" className="schedule-route__track" d={routePath} pathLength="1" />
            </svg>

            <ol className="schedule-route__stations">
              {eventSchedule.map((item, index) => (
                <li key={item.numeral} style={{ '--station': index } as CSSProperties}>
                  <span className="schedule-route__seal" aria-hidden="true">{item.numeral}</span>
                  <article className="schedule-route__inscription">
                    <p>{item.date}</p>
                    <h3>{item.title}</h3>
                    <span>{item.description}</span>
                  </article>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
