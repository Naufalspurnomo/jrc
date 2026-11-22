const sponsorLogos = [
  { name: 'iSee', src: '/assets/partners/sponsor/isee.webp' },
  { name: 'Akishop Electronics', src: '/assets/partners/sponsor/akishop-electronics.webp' },
  { name: 'Papskuy Photobooth', src: '/assets/partners/sponsor/papskuy-photobooth.webp' },
  { name: 'ProTronics', src: '/assets/partners/sponsor/protronics.webp' },
  { name: 'PT Warnatama Cemerlang', src: '/assets/partners/sponsor/warnatama-cemerlang.webp' },
  { name: 'Voltra Techno', src: '/assets/partners/sponsor/voltra-techno.webp' },
] as const;

const mediaPartnerLogos = [
  { name: 'Istana Robot', src: '/assets/partners/media-partner/istana-robot.webp' },
  { name: 'Markas Engineer', src: '/assets/partners/media-partner/markas-engineer.webp' },
  { name: 'Zona Event', src: '/assets/partners/media-partner/zona-event.webp' },
  { name: 'Kakarobot', src: '/assets/partners/media-partner/kakarobot.webp' },
  { name: 'Lomba Tekno', src: '/assets/partners/media-partner/lomba-tekno.webp' },
  { name: 'Voltech.H', src: '/assets/partners/media-partner/voltech.webp' },
  { name: 'TeknoEvent Campus', src: '/assets/partners/media-partner/teknoevent-campus.webp' },
  { name: 'TeknoEvent', src: '/assets/partners/media-partner/teknoevent.webp' },
  { name: 'LIF', src: '/assets/partners/media-partner/lif.webp' },
  { name: 'Robotku School', src: '/assets/partners/media-partner/robotku-school.webp' },
  { name: 'Event Pelajar', src: '/assets/partners/media-partner/event-pelajar.webp' },
  { name: 'Info Event Jatim', src: '/assets/partners/media-partner/info-event-jatim.webp' },
] as const;

type PartnerLogo = (typeof sponsorLogos)[number] | (typeof mediaPartnerLogos)[number];

function LogoGallery({ label, logos }: { label: string; logos: readonly PartnerLogo[] }) {
  const titleId = `partner-${label.toLowerCase().replaceAll(' ', '-')}`;

  return (
    <article className="patron-court__group" aria-labelledby={titleId}>
      <h3 id={titleId} data-journey-anchor data-journey-side="left">{label}</h3>
      <ul className="patron-court__logos" aria-label={`Logo ${label} JRC XIV`}>
        {logos.map((logo) => (
          <li key={logo.src}>
            <figure>
              <span className="patron-court__logo-frame">
                <img src={logo.src} alt={`Logo ${logo.name}`} loading="lazy" decoding="async" />
              </span>
              <figcaption>{logo.name}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function PartnersSection() {
  return (
    <section
      className="journey-scene journey-scene--partners patron-court"
      aria-labelledby="partner-title"
    >
      <div className="patron-court__inner site-shell page-shell">
        <header className="patron-court__opening">
          <p>Kolaborasi</p>
          <h2 id="partner-title" data-journey-anchor data-journey-side="left">
            Arena besar dibangun bersama.
          </h2>
          <span>Terima kasih kepada sponsor dan media partner yang mendukung JRC XIV.</span>
        </header>

        <div className="patron-court__showcase">
          <LogoGallery label="Sponsor" logos={sponsorLogos} />
          <LogoGallery label="Media Partner" logos={mediaPartnerLogos} />
        </div>

        <div className="patron-court__invitation" data-journey-anchor data-journey-side="left">
          <span>Daftar kolaborator JRC XIV</span>
          <p>Logo ditampilkan sesuai kategori sponsor dan media partner dari panitia.</p>
          <a
            className="site-action site-action--quiet"
            href="https://drive.google.com/drive/folders/1wUU6MTmg7fnscY6cFdjcV6impL1-sE94?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
          >
            Buka folder logo <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
