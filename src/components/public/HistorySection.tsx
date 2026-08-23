import { festivalMoments, historyChapters } from '../../content/jrc';

export function HistorySection() {
  return (
    <section id="sejarah" className="history-section" aria-labelledby="history-title">
      <div className="site-shell page-shell">
        <header className="history-section__header">
          <p className="site-kicker kicker">Annales JRC</p>
          <h2 id="history-title">Empat belas babak. Satu warisan yang terus bergerak.</h2>
          <p>
            Bukan museum pencapaian. Ini jejak orang-orang yang pernah merakit, gagal, memperbaiki,
            lalu kembali memasuki arena.
          </p>
        </header>

        <div className="history-editorial">
          {historyChapters.map((chapter, index) => (
            <article
              className={`history-editorial__entry${index % 2 === 1 ? ' history-editorial__entry--flip' : ''}`}
              key={chapter.numeral}
            >
              <span className="history-editorial__numeral" aria-hidden="true">
                {chapter.numeral}
              </span>
              <div className="history-editorial__body">
                <p>{chapter.eyebrow}</p>
                <h3>{chapter.title}</h3>
                <span>{chapter.copy}</span>
              </div>
              <i className="history-editorial__dot" aria-hidden="true" />
            </article>
          ))}
        </div>

        <div
          className="history-festival"
          aria-labelledby="festival-title"
          tabIndex={0}
        >
          <header>
            <div>
              <p className="site-kicker kicker">J-Fest · Conventus</p>
              <h3 id="festival-title">Lebih dari pertandingan.</h3>
            </div>
            <span className="history-festival__stamp" aria-hidden="true">
              <i />
              CONVENTUS
              <i />
            </span>
          </header>
          <ol>
            {festivalMoments.map((moment) => (
              <li key={moment.numeral}>
                <span>{moment.numeral}</span>
                <h4>{moment.title}</h4>
                <p>{moment.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}