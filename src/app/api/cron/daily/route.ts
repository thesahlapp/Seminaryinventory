import { NextResponse, type NextRequest } from "next/server";
import { emailConfigured, emailLayout, escapeHtml, sendEmail, siteUrl } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Daily job (Vercel Cron, see vercel.json): low stock digest for admins and
 * overdue check-out reminders. Each person's email settings are respected.
 * Vercel calls this with "Authorization: Bearer <CRON_SECRET>".
 */
export const maxDuration = 60;

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
const prettyDate = (d: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

function table(headers: string[], rows: string[][]) {
  const th = headers.map((h) => `<th align="left" style="padding:6px 8px;border-bottom:1px solid #e9e0c8;font-size:12px;color:#557a60">${escapeHtml(h)}</th>`).join("");
  const tr = rows
    .map((r) => `<tr>${r.map((c) => `<td style="padding:6px 8px;border-bottom:1px solid #f5f0e1;font-size:14px">${c}</td>`).join("")}</tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px"><tr>${th}</tr>${tr}</table>`;
}

function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#284734;color:#f5f0e1;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a>`;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SECRET_KEY is not set" }, { status: 500 });
  if (!emailConfigured()) return NextResponse.json({ skipped: "RESEND_API_KEY / EMAIL_FROM not set" });

  const site = siteUrl();
  const result = { lowStockEmails: 0, overdueBorrowerEmails: 0, overdueAdminEmails: 0 };
  const { data: people } = await admin.from("profiles").select("id, email, full_name, role, email_low_stock, email_overdue");
  const admins = (people ?? []).filter((p) => p.role === "admin" && p.email);

  // 1. Low stock digest (admins who want it)
  const { data: low } = await admin.from("low_stock").select("item_id, item_name, size_label, on_hand, min_quantity").order("item_name");
  const lowTo = admins.filter((p) => p.email_low_stock).map((p) => p.email!);
  if (low?.length && lowTo.length) {
    const rows = low.map((r) => [
      `<a href="${site}/items/${r.item_id}" style="color:#284734">${escapeHtml(r.item_name ?? "")}</a>${r.size_label ? ` · ${escapeHtml(r.size_label)}` : ""}`,
      `<strong style="color:#b42318">${r.on_hand}</strong>`,
      String(r.min_quantity),
    ]);
    await sendEmail({
      to: lowTo,
      subject: `Low stock: ${low.length} item${low.length === 1 ? "" : "s"} at or below minimum`,
      text: `Low stock today:\n${low.map((r) => `- ${r.item_name}${r.size_label ? ` (${r.size_label})` : ""}: ${r.on_hand} on hand, minimum ${r.min_quantity}`).join("\n")}\n\n${site}/items?low=1`,
      html: emailLayout(
        `${low.length} item${low.length === 1 ? " is" : "s are"} low on stock`,
        `${table(["Item", "On hand", "Minimum"], rows)}${button(`${site}/purchase-orders/new?from=low-stock`, "Create a purchase order")} &nbsp; <a href="${site}/items?low=1" style="color:#284734">View in the app</a>`,
      ),
    });
    result.lowStockEmails = lowTo.length;
  }

  // 2. Overdue check-outs
  const { data: overdue } = await admin
    .from("checkouts")
    .select("id, number, borrower_name, borrower_id, project, due_date, last_reminded_at, checkout_lines(quantity, returned_good, returned_damaged, missing, item_variants(items(name), sizes(label)))")
    .is("closed_at", null)
    .lt("due_date", today())
    .order("due_date");
  // Don't remind about the same check-out twice in one day.
  const due = (overdue ?? []).filter((c) => !c.last_reminded_at || Date.now() - Date.parse(c.last_reminded_at) > 20 * 3600 * 1000);

  const describe = (c: (typeof due)[number]) =>
    c.checkout_lines
      .map((l) => ({ ...l, out: l.quantity - l.returned_good - l.returned_damaged - l.missing }))
      .filter((l) => l.out > 0)
      .map((l) => `${l.out} × ${l.item_variants.items.name}${l.item_variants.sizes ? ` (${l.item_variants.sizes.label})` : ""}`)
      .join(", ");

  // 2a. To each borrower who is a team member (if they want overdue emails)
  const byBorrower = new Map<string, typeof due>();
  for (const c of due) if (c.borrower_id) byBorrower.set(c.borrower_id, [...(byBorrower.get(c.borrower_id) ?? []), c]);
  for (const [borrowerId, list] of byBorrower) {
    const person = people?.find((p) => p.id === borrowerId);
    if (!person?.email || !person.email_overdue) continue;
    await sendEmail({
      to: person.email,
      subject: `Reminder: ${list.length === 1 ? "a check-out is" : `${list.length} check-outs are`} overdue`,
      text: list.map((c) => `#${c.number} (due ${prettyDate(c.due_date)}): ${describe(c)}`).join("\n") + `\n\n${site}/checkouts`,
      html: emailLayout(
        "Please return or check in your gear",
        `<p style="margin:0 0 8px">Salaam${person.full_name ? ` ${escapeHtml(person.full_name.split(" ")[0])}` : ""}, these are past their due date:</p>${table(
          ["Check-out", "Due", "Items"],
          list.map((c) => [`<a href="${site}/checkouts/${c.id}" style="color:#284734">#${c.number}</a>${c.project ? ` · ${escapeHtml(c.project)}` : ""}`, prettyDate(c.due_date), escapeHtml(describe(c))]),
        )}<p style="margin:0">If you've already returned them, ask someone to check them in.</p>`,
      ),
    });
    result.overdueBorrowerEmails++;
  }

  // 2b. Summary to admins (if they want overdue emails)
  const overdueTo = admins.filter((p) => p.email_overdue).map((p) => p.email!);
  if (due.length && overdueTo.length) {
    await sendEmail({
      to: overdueTo,
      subject: `${due.length} overdue check-out${due.length === 1 ? "" : "s"}`,
      text: due.map((c) => `#${c.number} ${c.borrower_name} (due ${prettyDate(c.due_date)}): ${describe(c)}`).join("\n") + `\n\n${site}/checkouts?view=overdue`,
      html: emailLayout(
        `${due.length} check-out${due.length === 1 ? " is" : "s are"} overdue`,
        `${table(
          ["Who", "Due", "Items"],
          due.map((c) => [
            `<a href="${site}/checkouts/${c.id}" style="color:#284734">${escapeHtml(c.borrower_name)}</a>${c.project ? ` · ${escapeHtml(c.project)}` : ""}`,
            prettyDate(c.due_date),
            escapeHtml(describe(c)),
          ]),
        )}${button(`${site}/checkouts?view=overdue`, "View overdue")}`,
      ),
    });
    result.overdueAdminEmails = overdueTo.length;
  }

  if (due.length) {
    await admin.from("checkouts").update({ last_reminded_at: new Date().toISOString() }).in("id", due.map((c) => c.id));
  }

  return NextResponse.json({ ok: true, lowStockItems: low?.length ?? 0, overdue: due.length, ...result });
}
