import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RichEmailPayload } from './email-outbox';

const LOGO_CID = 'jrc14-logo';
const LOGO_PATH = join(process.cwd(), 'assets', 'jrc14-logo.png');

export interface TransactionalEmailInput {
  title: string;
  greetingName: string;
  intro: string;
  status?: string;
  details?: Array<{ label: string; value: string }>;
  paragraphs?: string[];
  cta?: { label: string; url: string };
  contentText?: string;
  ticketQrPng?: Buffer;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function safeHttpUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('CTA URL must be a valid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('CTA URL must use HTTP or HTTPS without credentials');
  }
  return url.toString();
}

export function buildPortalUrl(pathname = '/portal'): string {
  const configured = process.env.PUBLIC_FRONTEND_URL?.trim();
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('PUBLIC_FRONTEND_URL is required in production');
  }
  const base = safeHttpUrl(configured || 'http://localhost:5173');
  if (process.env.NODE_ENV === 'production' && new URL(base).protocol !== 'https:') {
    throw new Error('PUBLIC_FRONTEND_URL must use HTTPS in production');
  }
  return new URL(pathname, base).toString();
}

export function buildRegistrationPortalUrl(registrationId: string): string {
  return buildPortalUrl(`/portal/pendaftaran/${encodeURIComponent(registrationId)}`);
}

export function renderTransactionalEmail(input: TransactionalEmailInput): RichEmailPayload {
  const cta = input.cta ? { ...input.cta, url: safeHttpUrl(input.cta.url) } : undefined;
  const details = input.details ?? [];
  const paragraphs = input.paragraphs ?? [];
  const text = [
    `Halo ${input.greetingName},`,
    '',
    input.title,
    input.intro,
    ...(input.status ? ['', `Status: ${input.status}`] : []),
    ...(details.length ? ['', ...details.map(({ label, value }) => `${label}: ${value}`)] : []),
    ...paragraphs.flatMap((paragraph) => ['', paragraph]),
    ...(input.contentText ? ['', input.contentText] : []),
    ...(cta ? ['', `${cta.label}: ${cta.url}`] : []),
    '',
    'Java Robot Contest XIV · PENS',
  ].join('\n');

  const detailRows = details.map(({ label, value }) => `<tr><td style="padding:7px 12px;color:#64748b;font-size:13px;vertical-align:top;width:38%">${escapeHtml(label)}</td><td style="padding:7px 12px;color:#0f172a;font-size:13px;font-weight:600;vertical-align:top">${escapeHtml(value)}</td></tr>`).join('');
  const paragraphHtml = paragraphs.map((paragraph) => `<p style="margin:16px 0 0;color:#334155;font-size:15px;line-height:1.65">${escapeHtml(paragraph)}</p>`).join('');
  const ticketQrHtml = input.ticketQrPng ? '<div style="margin-top:22px;text-align:center"><img src="cid:ticket-qr" width="220" alt="QR tiket" style="display:inline-block;width:220px;max-width:100%;height:auto"></div>' : '';
  const ctaHtml = cta ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:#dc2626"><a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700">${escapeHtml(cta.label)}</a></td></tr></table><p style="margin:0;color:#64748b;font-size:12px;line-height:1.6">Jika tombol tidak berfungsi, buka tautan ini:<br><a href="${escapeHtml(cta.url)}" style="color:#b91c1c;word-break:break-all">${escapeHtml(cta.url)}</a></p>` : '';
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden"><tr><td style="padding:24px;background:#111827;text-align:center"><img src="cid:${LOGO_CID}" width="96" alt="JRC XIV" style="display:block;width:96px;height:auto;margin:0 auto"></td></tr><tr><td style="padding:28px 24px"><p style="margin:0 0 10px;color:#334155;font-size:15px">Halo ${escapeHtml(input.greetingName)},</p><h1 style="margin:0;color:#0f172a;font-size:24px;line-height:1.25">${escapeHtml(input.title)}</h1><p style="margin:14px 0 0;color:#334155;font-size:15px;line-height:1.65">${escapeHtml(input.intro)}</p>${input.status ? `<div style="margin:20px 0 0;padding:14px 16px;border-left:4px solid #dc2626;background:#fff1f2;color:#881337;font-size:14px;font-weight:700">${escapeHtml(input.status)}</div>` : ''}${details.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border:1px solid #e2e8f0;border-radius:8px">${detailRows}</table>` : ''}${paragraphHtml}${ticketQrHtml}${ctaHtml}</td></tr><tr><td style="padding:18px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:12px">Java Robot Contest XIV · PENS</td></tr></table></td></tr></table></body></html>`;

  return {
    text,
    html,
    attachments: [
      { filename: 'jrc14-logo.png', contentType: 'image/png', cid: LOGO_CID, content: readFileSync(LOGO_PATH) },
      ...(input.ticketQrPng ? [{ filename: 'ticket-qr.png', contentType: 'image/png', cid: 'ticket-qr', content: input.ticketQrPng }] : []),
    ],
  };
}
