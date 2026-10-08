import "server-only";

/**
 * Sends email through Resend (https://resend.com). Needs two settings:
 *   RESEND_API_KEY  - from the Resend dashboard
 *   EMAIL_FROM      - a sender on a domain verified in Resend,
 *                     e.g. "Qalam Inventory <inventory@qalamseminary.org>"
 * Without them, emails are skipped (and logged), so the app still works.
 */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail({ to, subject, html, text }: { to: string | string[]; subject: string; html: string; text: string }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return { skipped: true as const };
  if (!emailConfigured()) {
    console.info(`[email skipped: RESEND_API_KEY/EMAIL_FROM not set] ${subject} -> ${recipients.join(", ")}`);
    return { skipped: true as const };
  }

  // RESEND_API_URL is only for testing against a local stand-in.
  const response = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: recipients, subject, html, text }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[email failed ${response.status}] ${subject}: ${detail}`);
    return { error: `Email failed (${response.status})` };
  }
  return { sent: true as const };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Simple branded email layout (works in light and dark mail apps). */
export function emailLayout(title: string, bodyHtml: string, footer = "You can change which emails you get under My settings in the app.") {
  return `<!doctype html><html><body style="margin:0;background:#f5f0e1;font-family:Arial,Helvetica,sans-serif;color:#1c2420">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e1;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fdfbf6;border:1px solid #e9e0c8;border-radius:12px;overflow:hidden">
<tr><td style="background:#284734;color:#f5f0e1;padding:14px 20px;font-weight:bold;letter-spacing:2px;font-size:13px">QALAM SEMINARY · INVENTORY</td></tr>
<tr><td style="padding:20px"><h1 style="margin:0 0 12px;font-size:18px;color:#284734">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:12px 20px;border-top:1px solid #e9e0c8;font-size:12px;color:#557a60">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

/** The app's public address for links in emails. */
export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return explicit.replace(/\/$/, "") || "http://localhost:3000";
}
