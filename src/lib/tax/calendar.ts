// Calendar entries for the advance tax dates: a downloadable .ics file and Google Calendar links.
import { RULES } from "./india.ts";

export type Reminder = { date: string; title: string; detail: string };

/** The dates for the tax year, each with the cumulative share due. */
export function reminders(amounts?: number[]): Reminder[] {
  const share = ["15%", "45%", "75%", "100%"];
  const withAmount = (i: number) =>
    amounts && amounts[i] > 0 ? ` Estimated payment: Rs ${Math.round(amounts[i]).toLocaleString("en-IN")}.` : "";
  const rows = RULES.instalments.map((rule, i) => ({
    date: rule.due,
    title: `Advance tax: instalment ${i + 1} of 4 (${share[i]} due)`,
    detail: `By today, ${share[i]} of your income tax for Tax Year ${RULES.taxYear}, after TDS, should be paid as advance tax.${withAmount(i)} Paying late costs ${i === 3 ? "1%" : "3%"} of the shortfall.`,
  }));
  rows.push({
    date: RULES.yearEnd,
    title: "Advance tax: gains and dividends after 15 March",
    detail: `Tax on capital gains or dividends that arose after 15 March is due today, the last day of Tax Year ${RULES.taxYear}.${withAmount(4)} From 1 April, unpaid tax costs 1% a month.`,
  });
  return rows;
}

const compact = (date: string) => date.replace(/-/g, "");
const nextDay = (date: string) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
/** Lines longer than 75 characters are folded, as the iCalendar format requires. */
const fold = (line: string) => {
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(" " + line.slice(i, i + 74));
  return parts.join("\r\n");
};

/** An .ics file with all-day events and alerts some days ahead of each date. */
export function toIcs(items: Reminder[], alertDays: number[] = [7, 1], stamp = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//camayankwadhera.com//Advance tax dates//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const item of items) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:advance-tax-${item.date}@camayankwadhera.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${compact(item.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(item.date))}`,
      `SUMMARY:${escape(item.title)}`,
      `DESCRIPTION:${escape(item.detail)}`,
      "TRANSP:TRANSPARENT",
    );
    for (const days of alertDays) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escape(item.title)}`, `TRIGGER:-P${days}D`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleLink(item: Reminder): string {
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates: `${compact(item.date)}/${compact(nextDay(item.date))}`,
    details: item.detail,
  });
  return `https://calendar.google.com/calendar/render?${query}`;
}
