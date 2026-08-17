import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const primaryNavigation = [
  { href: '/#perlombaan', label: 'Perlombaan' },
  { href: '/#jadwal', label: 'Jadwal' },
  { href: '/#sejarah', label: 'Sejarah' },
  { href: '/#informasi', label: 'Informasi' },
] as const;

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

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
    <header className="site-header" data-menu-open={isOpen ? 'true' : 'false'}>
      <div className="site-header__inner">
        <Link className="site-header__crest" to="/" aria-label="JRC XIV — kembali ke beranda">
          <span className="site-header__crest-kicker">JRC</span>
          <strong className="site-header__crest-number">XIV</strong>
        </Link>

        <button
          ref={toggleRef}
          className="site-header__toggle"
          type="button"
          aria-expanded={isOpen}
          aria-controls="site-navigation"
          aria-label={isOpen ? 'Tutup navigasi' : 'Buka navigasi'}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span className="site-header__toggle-label">Menu</span>
        </button>

        <nav
          id="site-navigation"
          className="site-header__nav"
          aria-label="Navigasi utama"
          data-open={isOpen ? 'true' : 'false'}
        >
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
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Link className="site-header__portal-link" to="/portal/masuk">
          <span>Portal peserta</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  );
}
