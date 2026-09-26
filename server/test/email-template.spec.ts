import { describe, expect, it } from 'vitest';
import { buildRegistrationPortalUrl, renderTransactionalEmail } from '../src/email-template';

describe('renderTransactionalEmail', () => {
  it('escapes all recipient data in HTML while preserving readable plain text', () => {
    const payload = renderTransactionalEmail({
      title: 'Status <Pendaftaran>',
      greetingName: 'Rina <script>alert(1)</script>',
      intro: 'Tim A & B telah diperbarui.',
      status: 'MENUNGGU "REVIEW"',
      details: [{ label: 'Tim', value: '<Robot & Co>' }],
    });

    expect(payload.html).not.toContain('<script>');
    expect(payload.html).toContain('&lt;script&gt;');
    expect(payload.html).toContain('&lt;Robot &amp; Co&gt;');
    expect(payload.text).toContain('Halo Rina <script>alert(1)</script>,');
    expect(payload.text).toContain('Tim: <Robot & Co>');
  });

  it('embeds the official logo as a CID attachment', () => {
    const payload = renderTransactionalEmail({ title: 'Verifikasi email', greetingName: 'Rina', intro: 'Verifikasikan email Anda.' });

    expect(payload.html).toContain('src="cid:jrc14-logo"');
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments?.[0]).toMatchObject({ filename: 'jrc14-logo.png', contentType: 'image/png', cid: 'jrc14-logo' });
    expect(payload.attachments?.[0]?.content.length).toBeGreaterThan(1_000);
  });

  it('renders a safe CTA and matching fallback URL in HTML and plain text', () => {
    const payload = renderTransactionalEmail({
      title: 'Verifikasi email',
      greetingName: 'Rina',
      intro: 'Verifikasikan email Anda.',
      cta: { label: 'Verifikasi sekarang', url: 'https://jrc.example/verify?token=a&b=c' },
    });

    expect(payload.html).toContain('Verifikasi sekarang');
    expect(payload.html).toContain('https://jrc.example/verify?token=a&amp;b=c');
    expect(payload.html).toContain('Jika tombol tidak berfungsi');
    expect(payload.text).toContain('Verifikasi sekarang: https://jrc.example/verify?token=a&b=c');
  });

  it('rejects unsafe CTA URLs and renders the dedicated ticket QR option', () => {
    expect(() => renderTransactionalEmail({ title: 'X', greetingName: 'Y', intro: 'Z', cta: { label: 'Buka', url: 'javascript:alert(1)' } })).toThrow('CTA URL must use HTTP or HTTPS');
    const payload = renderTransactionalEmail({
      title: 'Tiket', greetingName: 'Rina', intro: 'Tiket siap.',
      ticketQrPng: Buffer.from('png'),
      contentText: 'Tunjukkan QR tiket terlampir.',
    });
    expect(payload.attachments).toHaveLength(2);
    expect(payload.html).toContain('cid:ticket-qr');
  });

  it('builds an encoded registration-specific portal URL', () => {
    process.env.PUBLIC_FRONTEND_URL = 'https://jrc.example.test';
    expect(buildRegistrationPortalUrl('registration/id')).toBe(
      'https://jrc.example.test/portal/pendaftaran/registration%2Fid',
    );
  });
});
