/**
 * camayankwadhera.com → MW Work Register
 *
 * Receives enquiry-form posts from the website, appends them to the
 * "Enquiries" tab of the MW Work Register sheet, and emails a notification.
 *
 * Set up (once, about two minutes):
 *   1. Open the MW Work Register sheet → Extensions → Apps Script.
 *   2. Replace everything in Code.gs with this file and save.
 *   3. Deploy → New deployment → type "Web app".
 *        Execute as: Me      Who has access: Anyone
 *      Approve the permission prompt (it needs the sheet and email).
 *   4. Copy the Web app URL (ends in /exec) and set it as
 *      PUBLIC_ENQUIRY_ENDPOINT on the website (see work-desk/README.md).
 *
 * After editing this script later: Deploy → Manage deployments → edit →
 * Version: New version. The URL stays the same.
 */

const SHEET_ID = "1WWUkZXu5kJIA1eg_xMGrhrEfxfNw5qpaMiU_knogf-Q";
const TAB = "Enquiries";
const NOTIFY_EMAIL = ""; // e.g. "you@example.com"; leave empty to skip email

// Keep in step with src/scripts/enquiry.js
const ROUTES = {
  "accounting-us": "CA4CPA",
  "accounting-intl": "CA4CPA KPO Solutions",
  "founder-compliance": "Legal Suvidha",
  "founder-software": "DigiComply",
  "founder-advisory": "MKW Advisors",
  "founder-growth": "GrowBiz10x",
  board: "MKW Advisors",
  college: "CorpReady Academy",
  employer: "CorpReady Academy",
  speaking: "Mayank Wadhera (direct)",
};

const LIMITS = { short: 200, need: 5000 };

function doPost(e) {
  const p = (e && e.parameter) || {};

  // Honeypot: real people never fill the hidden "website" field.
  if (p.website) return reply_({ ok: true });

  const email = clean_(p.email, LIMITS.short);
  const name = clean_(p.name, LIMITS.short);
  const need = clean_(p.need, LIMITS.need);
  if (!name || !need || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply_({ ok: false, error: "missing or invalid fields" });
  }

  const audience = ROUTES[p.audience] ? p.audience : "";
  const ref = /^MW-\d{6}-[A-Z0-9]{4}$/.test(p.ref || "") ? p.ref : makeRef_();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB);
    sheet.appendRow([
      new Date(),
      ref,
      audience || clean_(p.audience, 60),
      ROUTES[audience] || "Mayank Wadhera (direct)",
      name,
      email,
      clean_(p.organization, LIMITS.short),
      clean_(p.country, LIMITS.short),
      need,
      clean_(p.next_step, 60),
      clean_(p.source, LIMITS.short),
      "New",
    ]);
  } finally {
    lock.releaseLock();
  }

  if (NOTIFY_EMAIL) {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      replyTo: email,
      subject: `New enquiry ${ref} → ${ROUTES[audience] || "direct"}: ${name}`,
      body: [
        `${name} <${email}>`,
        `${clean_(p.organization, LIMITS.short)} · ${clean_(p.country, LIMITS.short)}`,
        `Preferred next step: ${clean_(p.next_step, 60)}`,
        "",
        need,
        "",
        `Sheet: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
      ].join("\n"),
    });
  }

  return reply_({ ok: true, ref });
}

function doGet() {
  return reply_({ ok: true, service: "camayankwadhera enquiry intake" });
}

// Trim, cap length, and stop a value being read as a spreadsheet formula.
function clean_(value, max) {
  let s = String(value || "").trim().slice(0, max);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function makeRef_() {
  const d = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyMMdd");
  const r = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0");
  return `MW-${d}-${r}`;
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
