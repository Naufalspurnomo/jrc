import { festivalMoments, historyChapters } from '../../content/jrc';

export function HistorySection() {
  return (
    <section id="sejarah" className="history-procession" aria-labelledby="history-title">
      <div className="journey-scene journey-scene--opening">
        <header className="history-procession__opening site-shell page-shell">
          <p>Perjalanan JRC</p>
          <h2 id="history-title">Empat belas babak membentuk satu warisan.</h2>
          <span>
            Jejak orang-orang yang merakit, gagal, memperbaiki, lalu kembali memasuki arena.
          </span>
        </header>
      </div>

      <div className="history-procession__route" aria-label="Tonggak perjalanan JRC">
        {historyChapters.map((chapter, index) => (
          <article
            className={`journey-scene journey-scene--chapter-${index + 1} history-procession__chapter`}
            key={chapter.numeral}
          >
            <div className="history-procession__inscription">
              <p>{chapter.eyebrow}</p>
              <h3>{chapter.title}</h3>
              <span>{chapter.copy}</span>
            </div>
          </article>
        ))}
      </div>

      <section
        className="journey-scene journey-scene--civic civic-assembly"
        aria-labelledby="festival-title"
      >
        <div className="civic-assembly__manifesto">
          <p>Di luar arena</p>
          <h3 id="festival-title">Lebih dari pertandingan.</h3>
          <span>JRC juga menjadi tempat karya diperlihatkan dan komunitas bertemu.</span>
        </div>
        <ol className="civic-assembly__pillars">
          {festivalMoments.map((moment) => (
            <li key={moment.numeral}>
              <div>
                <h4>{moment.title}</h4>
                <p>{moment.copy}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
