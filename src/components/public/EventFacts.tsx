import { eventFacts } from '../../content/jrc';

const facts = [
  { key: 'edition', label: 'Edisi', value: eventFacts.edition, state: 'confirmed' },
  { key: 'registration', label: 'Pendaftaran', value: eventFacts.registration, state: 'pending' },
  { key: 'event-date', label: 'Hari pertandingan', value: eventFacts.eventDate, state: 'pending' },
  {
    key: 'venue',
    label: 'Lokasi',
    value: eventFacts.venue,
    compactValue: 'PENS, Surabaya',
    state: 'confirmed',
  },
] as const;

export function EventFacts() {
  return (
    <section className="arena-facts" aria-labelledby="arena-facts-title">
      <div className="arena-facts__atmosphere" aria-hidden="true">
        <div className="arena-facts__depth-image" />
        <div className="arena-facts__grid" />
        <div className="arena-facts__imperial-glow" />
        <div className="arena-facts__architecture">
          <span className="arena-facts__architecture-pillar arena-facts__architecture-pillar--left" />
          <span className="arena-facts__architecture-pillar arena-facts__architecture-pillar--right" />
          <span className="arena-facts__architecture-axis" />
        </div>
        <div className="arena-facts__signal-line" />
      </div>
      <div className="arena-facts__sheet site-shell page-shell">
        <header className="arena-facts__intro">
          <div
            className="arena-facts__spine"
            aria-label={`Java Robot Contest, edisi ${eventFacts.edition}, PENS Surabaya`}
          >
            <p className="arena-facts__spine-code" aria-hidden="true">
              JRC
            </p>
            <p className="arena-facts__edition" aria-label={`Edisi ke-${eventFacts.edition}`}>
              {eventFacts.edition}
            </p>
            <p className="arena-facts__spine-name">Java Robot Contest</p>
            <p className="arena-facts__spine-place">PENS · Surabaya</p>
          </div>

          <div className="arena-facts__heading">
            <p className="arena-facts__section-label">Informasi penyelenggaraan</p>
            <h2
              id="arena-facts-title"
              className="arena-facts__title"
              aria-label="JRC edisi 14. Pendaftaran dan hari pertandingan akan diumumkan."
            >
              <span>JRC edisi 14.</span>
              <span>Pendaftaran dan hari pertandingan</span>
              <span>akan diumumkan.</span>
            </h2>
          </div>
        </header>

        <div
          className="arena-facts__register arena-facts__civic-register"
          role="region"
          aria-label="Informasi utama JRC"
        >
          <div className="arena-facts__register-head" aria-hidden="true">
            <span>Data utama</span>
            <span>JRC / empat catatan</span>
          </div>
          <dl className="arena-facts__table">
            {facts.map((fact) => (
              <div
                className="arena-facts__fact"
                data-fact={fact.key}
                data-state={fact.state}
                key={fact.key}
              >
                <dt>{fact.label}</dt>
                <dd>
                  <span
                    className={`arena-facts__value-full${
                      'compactValue' in fact ? ' arena-facts__value-full--has-compact' : ''
                    }`}
                  >
                    {fact.value}
                  </span>
                  {'compactValue' in fact ? (
                    <span className="arena-facts__value-compact">{fact.compactValue}</span>
                  ) : null}
                  {fact.state === 'pending' ? (
                    <span className="arena-facts__pending-mark" aria-hidden="true" />
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
