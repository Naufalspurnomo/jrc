import { competitions, eventFacts } from '../../content/jrc';

const participantLevels = [...new Set(competitions.map(({ level }) => level))];

const facts = [
  { key: 'registration', label: 'Periode pendaftaran', value: eventFacts.registration },
  { key: 'event-date', label: 'Hari pertandingan', value: eventFacts.eventDate },
  { key: 'venue', label: 'Lokasi', value: eventFacts.venue },
] as const;

export function EventFacts() {
  return (
    <section id="informasi" className="event-brief" aria-labelledby="event-brief-title">
      <div className="event-brief__inner site-shell page-shell">
        <header className="event-brief__intro">
          <div className="event-brief__edition">
            <span className="event-brief__edition-label">Edisi ke-{eventFacts.edition}</span>
            <strong className="event-brief__edition-number">XIV</strong>
          </div>

          <div className="event-brief__identity">
            <h2 id="event-brief-title" className="event-brief__title">
              <span>Java Robot</span> <span>Contest</span>
            </h2>
            <p className="event-brief__institution">Himpunan Mahasiswa Teknik Elektronika</p>
          </div>
        </header>

        <dl className="event-brief__details" aria-label="Informasi utama JRC">
          {facts.map((fact) => (
            <div className="event-brief__fact" data-fact={fact.key} key={fact.key}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
          <div className="event-brief__fact" data-fact="participants">
            <dt>Kategori dan jenjang</dt>
            <dd>
              <span className="event-brief__fact-primary">{competitions.length} kategori</span>
              <span className="event-brief__fact-secondary">
                {participantLevels.length} jenjang · {participantLevels.join(' · ')}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
