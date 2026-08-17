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

        <ol className="history-section__chapters">
          {historyChapters.map((chapter) => (
            <li key={chapter.numeral}>
              <span className="history-section__numeral" aria-hidden="true">
                {chapter.numeral}
              </span>
              <div>
                <p>{chapter.eyebrow}</p>
                <h3>{chapter.title}</h3>
                <span>{chapter.copy}</span>
              </div>
            </li>
          ))}
        </ol>

        <div className="history-festival" aria-labelledby="festival-title">
          <header>
            <p className="site-kicker kicker">J-Fest · Conventus</p>
            <h3 id="festival-title">Lebih dari pertandingan.</h3>
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
