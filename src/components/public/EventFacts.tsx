import { eventFacts } from '../../content/jrc';

const facts = [
  { key: 'period', label: 'Periode pendaftaran', value: eventFacts.registration },
  { key: 'event-date', label: 'Hari pertandingan', value: eventFacts.eventDate },
  { key: 'venue', label: 'Lokasi', value: 'PENS, Surabaya' },
] as const;

export function EventFacts() {
  return (
    <section id="informasi" className="event-brief" aria-labelledby="event-brief-title">
      <div className="event-brief__glow" aria-hidden="true" />
      <div className="event-brief__inner site-shell page-shell">
        <header className="event-brief__intro">
          <h2 id="event-brief-title" className="event-brief__sr-title">Informasi JRC XIV</h2>
          <p className="event-brief__description event-brief__description--lead">
            Java Robot Contest merupakan acara tahunan yang diadakan oleh Himpunan Mahasiswa
            Teknik Elektronika Politeknik Elektronika Negeri Surabaya yang menghadirkan 6 macam
            perlombaan di bidang robotika dengan tingkatan SD, SMP, SMA, dan umum.
          </p>
        </header>

        <dl className="event-brief__details" aria-label="Informasi utama JRC">
          {facts.map((fact) => (
            <div className="event-brief__fact" data-fact={fact.key} key={fact.key}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
