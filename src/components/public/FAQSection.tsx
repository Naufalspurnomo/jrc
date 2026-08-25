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
          <p className="site-kicker kicker">Acta publica</p>
          <h2 id="faq-title">Informasi sebelum gerbang dibuka.</h2>
          <p>
            Kami memilih mengatakan "belum diumumkan" daripada mengisi detail penting dengan
            perkiraan.
          </p>
        </header>

        <div className="faq-section__items">
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
