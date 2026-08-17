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

        <ol className="schedule-section__timeline">
          {eventSchedule.map((item) => (
            <li key={item.numeral}>
              <span className="schedule-section__numeral" aria-hidden="true">
                {item.numeral}
              </span>
              <div>
                <p>{item.date}</p>
                <h3>{item.title}</h3>
                <span>{item.description}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
