import { faqItems } from '../../content/jrc';

export function FAQSection() {
  return (
    <section id="informasi" className="faq-section" aria-labelledby="faq-title">
      <div className="site-shell page-shell faq-section__layout">
        <header className="faq-section__header">
          <p className="site-kicker kicker">Acta publica</p>
          <h2 id="faq-title">Informasi sebelum gerbang dibuka.</h2>
          <p>
            Kami memilih mengatakan “belum diumumkan” daripada mengisi detail penting dengan
            perkiraan.
          </p>
        </header>

        <div className="faq-section__items">
          {faqItems.map((item, index) => (
            <details key={item.question}>
              <summary>
                <span aria-hidden="true">0{index + 1}</span>
                {item.question}
                <i aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
