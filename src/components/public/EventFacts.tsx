import { eventFacts } from '../../content/jrc';

const editionNumber = '14';

const facts = [
  { label: 'Edisi', value: editionNumber },
  { label: 'Pendaftaran', value: eventFacts.registration },
  { label: 'Hari pertandingan', value: eventFacts.eventDate },
  { label: 'Lokasi', value: eventFacts.venue, compactValue: 'PENS, Surabaya' },
] as const;

export function EventFacts() {
  return (
    <section className="arena-facts" aria-labelledby="arena-facts-title">
      <div className="arena-facts__masthead site-shell page-shell">
        <div className="arena-facts__identity">
          <p className="arena-facts__edition" aria-label="Edisi ke-14">
            {editionNumber}
          </p>
          <div className="arena-facts__identity-copy">
            <p>Java Robot Contest</p>
            <p>Informasi Penyelenggaraan</p>
            <p>PENS · Surabaya</p>
          </div>
        </div>

        <h2
          id="arena-facts-title"
          className="arena-facts__title"
          aria-label="Roma dibangun untuk mereka yang berani bertanding."
        >
          <span>Roma dibangun</span>
          <span className="arena-facts__title-italic">untuk mereka yang</span>
          <span>berani bertanding.</span>
        </h2>
      </div>

      <dl className="arena-facts__table site-shell page-shell">
        {facts.map((fact) => (
          <div className="arena-facts__fact" key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>
              <span className="arena-facts__value-full">{fact.value}</span>
              {'compactValue' in fact ? (
                <span className="arena-facts__value-compact">{fact.compactValue}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
