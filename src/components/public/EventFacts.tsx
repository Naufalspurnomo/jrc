import { eventFacts } from '../../content/jrc';

export function EventFacts() {
  return (
    <section className="arena-facts" aria-labelledby="arena-facts-title">
      <div className="site-shell page-shell arena-facts__inner">
        <div className="arena-facts__statement">
          <p className="site-kicker kicker">Status arena</p>
          <h2 id="arena-facts-title">Roma dibangun untuk mereka yang berani bertanding.</h2>
        </div>
        <dl className="arena-facts__list">
          <div>
            <dt>Edisi</dt>
            <dd>{eventFacts.edition}</dd>
          </div>
          <div>
            <dt>Pendaftaran</dt>
            <dd>{eventFacts.registration}</dd>
          </div>
          <div>
            <dt>Hari pertandingan</dt>
            <dd>{eventFacts.eventDate}</dd>
          </div>
          <div>
            <dt>Lokasi</dt>
            <dd>{eventFacts.venue}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
