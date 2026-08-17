import { Link, useParams } from 'react-router-dom';

import { SiteFooter } from '../components/public/SiteFooter';
import { SiteHeader } from '../components/public/SiteHeader';
import { findCompetition } from '../content/jrc';

export default function CompetitionPage() {
  const { slug } = useParams<{ slug: string }>();
  const competition = findCompetition(slug);

  if (!competition) {
    return (
      <div className="site-page site-page--competition-not-found">
        <SiteHeader />
        <main className="competition-not-found site-shell page-shell">
          <p className="site-kicker kicker">Error · CDIV</p>
          <h1>Arena tidak ditemukan.</h1>
          <p>
            Gerbang yang kamu cari tidak tercatat dalam enam arena draf JRC XIV. Kembali ke
            halaman utama untuk memilih disiplin yang tersedia.
          </p>
          <Link className="site-action site-action--primary button-primary" to="/">
            Kembali ke beranda
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="site-page site-page--competition">
      <a className="site-skip-link skip-link" href="#competition-content">
        Lewati ke detail perlombaan
      </a>
      <SiteHeader />
      <main id="competition-content">
        <header className="competition-hero" data-accent={competition.accent}>
          <div className="competition-hero__texture" aria-hidden="true" />
          <div className="site-shell page-shell competition-hero__inner">
            <Link className="competition-hero__back text-link" to="/#perlombaan">
              <span aria-hidden="true">←</span>
              Kembali ke enam arena
            </Link>
            <p className="competition-hero__fixture">{competition.fixtureLabel}</p>
            <div className="competition-hero__title-row">
              <span aria-hidden="true">{competition.romanNumeral}</span>
              <div>
                <p>{competition.level} · {competition.discipline}</p>
                <h1>{competition.shortName}</h1>
              </div>
            </div>
            <p className="competition-hero__provocation">{competition.provocation}</p>
          </div>
        </header>

        <section className="competition-brief" aria-labelledby="competition-brief-title">
          <div className="site-shell page-shell competition-brief__layout">
            <div>
              <p className="site-kicker kicker">Mandatum arenae</p>
              <h2 id="competition-brief-title">Misi di dalam arena.</h2>
            </div>
            <div className="competition-brief__copy">
              <p>{competition.description}</p>
              <blockquote>{competition.objective}</blockquote>
            </div>
          </div>
        </section>

        <section className="competition-intel" aria-labelledby="competition-intel-title">
          <div className="site-shell page-shell">
            <header>
              <p className="site-kicker kicker">Acta technica</p>
              <h2 id="competition-intel-title">Informasi resmi.</h2>
              <p>
                Detail berikut sengaja tidak diperkirakan. Informasi akan diperbarui setelah
                ketentuan JRC XIV disahkan.
              </p>
            </header>
            <dl>
              <div>
                <dt>Jenjang</dt>
                <dd>{competition.level}</dd>
              </div>
              <div>
                <dt>Biaya pendaftaran</dt>
                <dd>{competition.fee}</dd>
              </div>
              <div>
                <dt>Guidebook</dt>
                <dd>{competition.guidebook.status}</dd>
              </div>
              <div>
                <dt>Status kategori</dt>
                <dd>{competition.fixtureLabel}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="competition-cta" aria-labelledby="competition-cta-title">
          <div className="site-shell page-shell competition-cta__inner">
            <p className="site-kicker kicker">Praepara legionem</p>
            <h2 id="competition-cta-title">Siapkan tim sebelum gerbang dibuka.</h2>
            <p>
              Jelajahi portal lokal untuk memahami alur pendaftaran. Data demo tidak dikirim ke
              panitia dan bukan pendaftaran resmi.
            </p>
            <Link className="site-action site-action--primary button-primary" to="/portal/masuk">
              Buka portal peserta
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
