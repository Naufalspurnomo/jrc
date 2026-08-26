import { useState } from 'react';
import { faqItems } from '../../content/jrc';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      className="journey-scene journey-scene--faq faq-section"
      aria-labelledby="faq-title"
    >
      <div className="site-shell page-shell faq-section__layout">
        <header className="faq-section__header">
          <p className="site-kicker kicker">Informasi peserta</p>
          <h2 id="faq-title" data-journey-anchor data-journey-side="right">
            Pertanyaan umum.
          </h2>
          <p>
            Informasi pendaftaran, kategori perlombaan, guidebook, dan ketentuan peserta JRC XIV.
          </p>
        </header>

        <div className="faq-section__items" data-journey-anchor data-journey-side="left">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={item.question}
                className={`faq-item ${isOpen ? 'faq-item--open' : ''}`}
              >
                <button
                  type="button"
                  className="faq-item__trigger"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <span className="faq-item__question">{item.question}</span>
                  <span className="faq-item__icon" aria-hidden="true">
                    <i />
                  </span>
                </button>
                <div
                  className="faq-item__answer"
                  role="region"
                  aria-hidden={!isOpen}
                >
                  <p>{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
