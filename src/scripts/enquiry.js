// Enquiry form: preselect the audience from ?audience=, show where the enquiry will be routed,
// and send it to the intake endpoint (work-desk/intake.gs), which writes it to the MW Work Register.
// Keep ROUTES in step with work-desk/intake.gs.
const ROUTES = {
  "accounting-us": { to: "CA4CPA", next: "A sample month, then a scope call" },
  "accounting-intl": { to: "CA4CPA KPO Solutions", next: "Sample output, then a scope call" },
  "founder-compliance": { to: "Legal Suvidha", next: "Compliance enquiry" },
  "founder-software": { to: "DigiComply", next: "Product walkthrough" },
  "founder-advisory": { to: "MKW Advisors", next: "Advisory scope discussion" },
  "founder-growth": { to: "GrowBiz10x", next: "Growth execution discussion" },
  board: { to: "MKW Advisors", next: "Share the mandate and request a discussion" },
  college: { to: "CorpReady Academy", next: "Diagnostic, orientation or campus pilot discussion" },
  employer: { to: "CorpReady Academy", next: "Hiring and talent readiness discussion" },
  speaking: { to: "Mayank Wadhera (direct)", next: "Confirm topic, audience, dates and format" },
};
const FALLBACK = { to: "Mayank Wadhera (direct)", next: "Reply by email" };

// Reference shown to the visitor and stored in the sheet, e.g. MW-261118-K3QZ
function makeRef() {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString(); // IST date
  const ymd = d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `MW-${ymd}-${Array.from(bytes, (b) => chars[b % chars.length]).join("")}`;
}

function show(panel, route, ref) {
  for (const id of ["routed", "sent", "send-failed"]) document.getElementById(id).hidden = id !== panel.id;
  const to = panel.querySelector("[data-to]");
  const next = panel.querySelector("[data-next]");
  const refEl = panel.querySelector("[data-ref]");
  if (to) to.textContent = route.to;
  if (next) next.textContent = route.next;
  if (refEl) refEl.textContent = ref;
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
}

const form = document.getElementById("enquiry");
if (form) {
  const endpoint = form.dataset.endpoint || "";
  const audience = form.elements.audience;
  const wanted = new URLSearchParams(location.search).get("audience");
  if (wanted && ROUTES[wanted]) audience.value = wanted;

  const hint = document.getElementById("route-hint");
  const showHint = () => {
    const route = ROUTES[audience.value];
    hint.textContent = route ? `This will go to ${route.to}. Usual next step: ${route.next}.` : "";
  };
  audience.addEventListener("change", showHint);
  showHint();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const route = ROUTES[audience.value] || FALLBACK;

    if (!endpoint) {
      show(document.getElementById("routed"), route);
      return;
    }

    const button = form.querySelector("[data-submit]");
    const label = button.textContent;
    const ref = makeRef();
    form.elements.ref.value = ref;
    form.elements.source.value = document.referrer || location.href;
    button.disabled = true;
    button.textContent = "Sending…";

    try {
      // Apps Script does not send CORS headers, so the response is opaque: a resolved fetch means
      // the request reached Google; only a network failure rejects.
      await fetch(endpoint, { method: "POST", mode: "no-cors", body: new URLSearchParams(new FormData(form)) });
      form.reset();
      showHint();
      form.hidden = true;
      show(document.getElementById("sent"), route, ref);
    } catch {
      show(document.getElementById("send-failed"), route);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}
