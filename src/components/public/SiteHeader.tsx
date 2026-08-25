import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { lockDocumentScroll } from '../../hooks/scrollLock';

const primaryNavigation = [
  { href: '/#perlombaan', label: 'Perlombaan' },
  { href: '/#jadwal', label: 'Jadwal' },
  { href: '/#sejarah', label: 'Sejarah' },
  { href: '/#informasi', label: 'Informasi' },
] as const;

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCondensed, setIsCondensed] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const scrollLock = lockDocumentScroll();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        toggleRef.current?.focus();
      }

      if (event.key === 'Tab') {
        const focusable = [
          toggleRef.current,
          ...Array.from(
            navRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
          ),
        ].filter((element): element is HTMLElement => Boolean(element));
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      scrollLock.release();
    };
  }, [isOpen]);

  useEffect(() => {
    let frame = 0;
    const syncHeaderState = () => {
      frame = 0;
      setIsCondensed(window.scrollY > 28);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncHeaderState);
    };

    syncHeaderState();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const sections = primaryNavigation
      .map((item) => document.getElementById(item.href.split('#')[1]))
      .filter((element): element is HTMLElement => Boolean(element));

    if (sections.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(`#${entry.target.id}`);
        });
      },
      { rootMargin: '-35% 0px -55% 0px' },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className="site-header"
      data-menu-open={isOpen ? 'true' : 'false'}
      data-scrolled={isCondensed ? 'true' : 'false'}
    >
      <div className="site-header__inner">
        <Link className="site-header__crest" to="/" aria-label="JRC 14 — Beranda">
          <img
            className="site-header__logo"
            src="/assets/brand/jrc14-logo-transparent-128.webp"
            srcSet="/assets/brand/jrc14-logo-transparent-128.webp 128w, /assets/brand/jrc14-logo-transparent-256.webp 256w"
            sizes="(max-width: 64rem) 36px, 44px"
            alt=""
            width="128"
            height="221"
            decoding="async"
          />
        </Link>

        <button
          ref={toggleRef}
          className="site-header__toggle"
          type="button"
          aria-expanded={isOpen}
          aria-controls="site-navigation"
          aria-label={isOpen ? 'Tutup navigasi — Tutup' : 'Buka navigasi — Menu'}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span className="site-header__toggle-label">{isOpen ? 'Tutup' : 'Menu'}</span>
        </button>

        <nav
          ref={navRef}
          id="site-navigation"
          className="site-header__nav"
          aria-label="Navigasi utama"
          data-open={isOpen ? 'true' : 'false'}
        >
          <div className="site-header__nav-scene" aria-hidden="true">
            <span className="site-header__nav-sky" />
            <span className="site-header__nav-arch" />
            <span className="site-header__nav-column site-header__nav-column--left" />
            <span className="site-header__nav-column site-header__nav-column--right" />
            <span className="site-header__nav-light" />
            <span className="site-header__nav-grain" />
          </div>
          <div className="site-header__nav-heading">
            <span>Porta Imperii</span>
            <strong>Pilih jalan menuju arena</strong>
          </div>
          <ol className="site-header__nav-list">
            {primaryNavigation.map((item, index) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={activeSection === item.href ? 'true' : undefined}
                  data-active={activeSection === item.href ? 'true' : 'false'}
                >
                  <span aria-hidden="true">0{index + 1}</span>
                  <strong>{item.label}</strong>
                </a>
              </li>
            ))}
          </ol>
          <Link
            className="site-header__nav-portal"
            to="/portal/masuk"
            onClick={() => setIsOpen(false)}
          >
            <span>Demo portal peserta</span>
            <span aria-hidden="true">Buka demo&nbsp; ↗</span>
          </Link>
          <p className="site-header__nav-edition" aria-hidden="true">
            JRC 14 · Imperium Machina
          </p>
        </nav>

        <button
          className="site-header__backdrop"
          type="button"
          tabIndex={-1}
          aria-label="Tutup navigasi"
          data-open={isOpen ? 'true' : 'false'}
          onClick={() => setIsOpen(false)}
        />

        <Link className="site-header__portal-link" to="/portal/masuk">
          <span>Demo portal peserta</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  );
}
