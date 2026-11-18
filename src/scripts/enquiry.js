// Enquiry form: preselect the audience from ?audience=, and show where the enquiry will be routed.
const ROUTES = {
  "accounting-us": { to: "CA4CPA", next: "A sample close pack, then a scope call" },
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

const form = document.getElementById("enquiry");
if (form) {
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

  form.addEventListener("submit", (event) => {
    if (form.getAttribute("action")) return; // a real endpoint is connected: let the browser submit
    event.preventDefault();
    const route = ROUTES[audience.value] || { to: "Mayank Wadhera (direct)", next: "Reply by email" };
    const out = document.getElementById("routed");
    out.hidden = false;
    out.querySelector("[data-to]").textContent = route.to;
    out.querySelector("[data-next]").textContent = route.next;
    out.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}
