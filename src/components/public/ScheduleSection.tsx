import { eventSchedule } from '../../content/jrc';

export function ScheduleSection() {
  return (
    <section id="jadwal" className="schedule-section" aria-labelledby="schedule-title">
      <div className="site-shell page-shell schedule-section__layout">
        <header className="schedule-section__header">
          <p className="site-kicker kicker">Iter ad arenam</p>
          <h2 id="schedule-title">Jalan menuju arena.</h2>
          <p>
            Setiap tim melewati gerbang yang sama. Tanggal resmi akan ditempatkan di sini begitu
            keputusan panitia diumumkan.
          </p>
        </header>

        <div className="schedule-via">
          <svg
            className="schedule-via__path"
            viewBox="0 0 560 900"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M60 40 C 60 130, 470 150, 460 260 S 60 370, 90 470 S 480 540, 440 660 S 80 760, 110 860"
              stroke="rgb(215 166 59 / 22%)"
              strokeWidth="1.5"
              strokeDasharray="3 7"
            />
            <path
              id="schedule-via-track"
              d="M60 40 C 60 130, 470 150, 460 260 S 60 370, 90 470 S 480 540, 440 660 S 80 760, 110 860"
              stroke="var(--imperial)"
              strokeWidth="2.5"
              strokeLinecap="round"
              pathLength="1"
              strokeDasharray="1"
              strokeDashoffset="1"
            />
          </svg>

          <ol className="schedule-via__milestones">
            {eventSchedule.map((item, index) => (
              <li key={item.numeral} style={{ '--i': index } as React.CSSProperties}>
                <span className="schedule-via__node" aria-hidden="true">
                  <i />
                </span>
                <div className="schedule-via__card">
                  <p>
                    {item.date} · Gerbang {item.numeral}
                  </p>
                  <h3>{item.title}</h3>
                  <span>{item.description}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}