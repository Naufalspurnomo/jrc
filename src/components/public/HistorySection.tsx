import { festivalMoments, historyChapters } from '../../content/jrc';

function ArchivePlate({
  chapter,
  index,
}: {
  chapter: (typeof historyChapters)[number];
  index: number;
}) {
  if (!chapter.image) return null;
  return (
    <figure
      className={`archive-plate archive-plate--${index % 2 === 0 ? 'left' : 'right'}`}
      aria-label={chapter.image.alt}
    >
      <picture>
        <source media="(max-width: 48rem)" srcSet={chapter.image.srcMobile} />
        <img
          src={chapter.image.src}
          alt=""
          loading="lazy"
          decoding="async"
        />
      </picture>
      <span className="archive-plate__stamp">{chapter.numeral}</span>
      <figcaption>{chapter.image.caption}</figcaption>
    </figure>
  );
}

export function HistorySection() {
  return (
    <section id="sejarah" className="history-archive" aria-labelledby="history-title">
      <header className="history-archive__opening site-shell page-shell">
        <p>Perjalanan JRC</p>
        <h2 id="history-title" data-journey-anchor data-journey-side="right">
          Empat belas babak membentuk satu warisan.
        </h2>
        <span>
          Jejak orang-orang yang merakit, gagal, memperbaiki, lalu kembali memasuki arena.
        </span>
      </header>

      <ol className="history-archive__route" aria-label="Tonggak perjalanan JRC">
        {historyChapters.map((chapter, index) => (
          <li
            key={chapter.numeral}
            className={`archive-entry archive-entry--${index % 2 === 0 ? 'left' : 'right'}`}
          >
            <ArchivePlate chapter={chapter} index={index} />
            <article className="archive-entry__inscription">
              <p className="archive-entry__edition">{chapter.eyebrow}</p>
              <h3 data-journey-anchor data-journey-side={index % 2 === 0 ? 'left' : 'right'}>
                {chapter.title}
              </h3>
              <p className="archive-entry__copy">{chapter.copy}</p>
            </article>
          </li>
        ))}
      </ol>

      <section
        className="history-archive__festival civic-assembly"
        aria-labelledby="festival-title"
      >
        <div className="civic-assembly__manifesto">
          <p>Di luar arena</p>
          <h3 id="festival-title" data-journey-anchor data-journey-side="right">
            Lebih dari pertandingan.
          </h3>
          <span>JRC juga menjadi tempat karya diperlihatkan dan komunitas bertemu.</span>
        </div>
        <ol className="civic-assembly__pillars" data-journey-anchor data-journey-side="right">
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
