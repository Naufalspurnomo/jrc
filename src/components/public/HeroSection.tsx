import HeroExperience from '../../scene/HeroExperience';

export function HeroSection() {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-section__visual" aria-hidden="true">
        <HeroExperience />
      </div>
      <div className="hero-section__shade" aria-hidden="true" />
      <div className="hero-section__content site-shell page-shell">
        <p className="hero-section__serial">
          <span>Est. 2012</span>
          <span aria-hidden="true" />
          <span>XIV Edition</span>
        </p>

        <div className="hero-section__title-lockup">
          <p className="hero-section__theme">Imperium Machina</p>
          <h1 id="hero-title">
            <span>Java Robot</span>
            {' '}
            <span>Contest</span>
            {' '}
            <strong>XIV</strong>
          </h1>
          <p className="hero-section__declaration">
            Enam disiplin. Satu arena. Tempat rekayasa diuji di hadapan keberanian.
          </p>
        </div>

        <div className="hero-section__actions" aria-label="Aksi utama">
          <a className="site-action site-action--primary button-primary" href="#perlombaan">
            Jelajahi perlombaan
            <span aria-hidden="true">↓</span>
          </a>
          <a className="site-action site-action--quiet button-secondary" href="#jadwal">
            Lihat perjalanan
          </a>
        </div>

        <div className="hero-section__threshold" aria-hidden="true">
          <span>Scroll untuk memasuki arena</span>
          <i />
        </div>
      </div>
    </section>
  );
}
