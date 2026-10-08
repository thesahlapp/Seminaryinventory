import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Sends email in one of two ways (whichever is set up):
 *
 * Gmail (or any SMTP server), free, no domain needed:
 *   SMTP_USER      - the Gmail address, e.g. qalam.inventory@gmail.com
 *   SMTP_PASSWORD  - a Gmail "app password" (not the normal password)
 *   SMTP_HOST / SMTP_PORT - optional, default smtp.gmail.com / 465
 *
 * Resend (https://resend.com), needs a domain verified in Resend:
 *   RESEND_API_KEY and EMAIL_FROM, e.g. "Qalam Inventory <inventory@qalamseminary.org>"
 *
 * EMAIL_FROM is optional for Gmail. Without either set, emails are skipped
 * (and logged), so the app still works.
 */
type Transport = "resend" | "smtp";

function transport(): Transport | null {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "resend";
  if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) return "smtp";
  return null;
}

export function emailConfigured() {
  return transport() !== null;
}

function fromAddress() {
  return process.env.EMAIL_FROM || `"Qalam Inventory" <${process.env.SMTP_USER}>`;
}

let smtp: Transporter | null = null;
function smtpTransporter() {
  if (!smtp) {
    const port = Number(process.env.SMTP_PORT || 465);
    smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD?.replace(/\s+/g, "") },
    });
  }
  return smtp;
}

export async function sendEmail({ to, subject, html, text }: { to: string | string[]; subject: string; html: string; text: string }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return { skipped: true as const };
  const via = transport();
  if (!via) {
    console.info(`[email skipped: no email settings (SMTP_USER/SMTP_PASSWORD or RESEND_API_KEY/EMAIL_FROM)] ${subject} -> ${recipients.join(", ")}`);
    return { skipped: true as const };
  }

  if (via === "smtp") {
    try {
      await smtpTransporter().sendMail({ from: fromAddress(), to: recipients, subject, html, text });
      return { sent: true as const };
    } catch (error) {
      console.error(`[email failed] ${subject}:`, error instanceof Error ? error.message : error);
      return { error: "Email failed" };
    }
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
<tr><td style="padding:12px 20px;border-top:1px solid #e9e0c8;font-size:12px;color:#4f735a">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

/** The app's public address for links in emails. */
export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return explicit.replace(/\/$/, "") || "http://localhost:3000";
}
