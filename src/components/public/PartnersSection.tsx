import { partnerTiers, pendingAnnouncement } from '../../content/jrc';

export function PartnersSection() {
  return (
    <section className="patron-court" aria-labelledby="partner-title">
      <div className="patron-court__inner site-shell page-shell">
        <header className="patron-court__opening">
          <p>Kolaborasi</p>
          <h2 id="partner-title">Arena besar dibangun bersama.</h2>
          <span>
            Identitas partner ditampilkan setelah kerja sama resmi. Tidak ada logo sementara dan
            tidak ada klaim yang dibuat-buat.
          </span>
        </header>

        <div className="patron-court__colonnade" role="list" aria-label="Ruang kolaborasi JRC XIV">
          {partnerTiers.map((tier) => (
            <article className="patron-court__bay" role="listitem" key={tier}>
              <h3>{tier}</h3>
              <p>{pendingAnnouncement}</p>
            </article>
          ))}
        </div>

        <footer className="patron-court__invitation">
          <span>Terbuka untuk kolaborasi</span>
          <p>Hubungi panitia JRC XIV untuk menjadi bagian dari arena ini.</p>
        </footer>
      </div>
    </section>
  );
}
