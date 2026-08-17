import { Link } from 'react-router-dom';

import { competitions } from '../../content/jrc';

export function CompetitionExplorer() {
  return (
    <section id="perlombaan" className="competition-explorer" aria-labelledby="competition-title">
      <div className="site-shell page-shell">
        <header className="competition-explorer__header">
          <div>
            <p className="site-kicker kicker">Disciplina · VI</p>
            <h2 id="competition-title">Enam arena. Enam cara membuktikan mesinmu.</h2>
          </div>
          <p>
            Nama kategori berikut masih merupakan draf dari JRC XIII. Arena resmi JRC XIV akan
            diperbarui tanpa menyembunyikan perubahan dari peserta.
          </p>
        </header>

        <ol className="competition-explorer__list">
          {competitions.map((competition) => (
            <li
              className="competition-entry"
              data-accent={competition.accent}
              data-testid="competition-entry"
              key={competition.slug}
            >
              <span className="competition-entry__numeral" aria-hidden="true">
                {competition.romanNumeral}
              </span>
              <div className="competition-entry__identity">
                <span className="competition-entry__fixture">{competition.fixtureLabel}</span>
                <p>{competition.level}</p>
                <h3>{competition.shortName}</h3>
                <span>{competition.discipline}</span>
              </div>
              <p className="competition-entry__provocation">{competition.provocation}</p>
              <Link
                className="competition-entry__link"
                to={`/perlombaan/${competition.slug}`}
                aria-label={`Jelajahi ${competition.shortName}`}
              >
                <span>Masuki arena</span>
                <span aria-hidden="true">↗</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
