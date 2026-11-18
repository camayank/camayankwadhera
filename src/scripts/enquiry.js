// Enquiry form: preselect the audience from ?audience=, show which venture the enquiry concerns,
// and on submit open the visitor's own email app with the message filled in.
const TO = "camayankwadhera@gmail.com";
const ROUTES = {
  "accounting-us": { to: "CA4CPA", next: "a sample close pack, then a scope call" },
  "accounting-intl": { to: "CA4CPA", next: "sample output, then a scope call" },
  "founder-compliance": { to: "Legal Suvidha", next: "a compliance discussion" },
  "founder-software": { to: "DigiComply", next: "a product walkthrough" },
  "founder-advisory": { to: "MKW Advisors", next: "an advisory scope discussion" },
  "founder-growth": { to: "GrowBiz", next: "a growth discussion" },
  board: { to: "MKW Advisors", next: "a discussion of the mandate" },
  college: { to: "CorpReady", next: "a partnership discussion" },
  employer: { to: "CorpReady", next: "a hiring and talent discussion" },
  speaking: { to: "Mayank Wadhera", next: "confirming topic, audience, dates and format" },
};

const form = document.getElementById("enquiry");
if (form) {
  const audience = form.elements.audience;
  const wanted = new URLSearchParams(location.search).get("audience");
  if (wanted && ROUTES[wanted]) audience.value = wanted;

  const hint = document.getElementById("route-hint");
  const showHint = () => {
    const route = ROUTES[audience.value];
    hint.textContent = route ? `This concerns ${route.to}. The usual next step is ${route.next}.` : "";
  };
  audience.addEventListener("change", showHint);
  showHint();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = (name) => form.elements[name].value.trim();
    const route = ROUTES[audience.value];
    const label = audience.options[audience.selectedIndex].text;
    const subject = `Enquiry for ${route ? route.to : "Mayank Wadhera"} from ${value("name")}`;
    const body = [
      `I am: ${label}`,
      `Name: ${value("name")}`,
      `Organization: ${value("organization")}`,
      `Country: ${value("country")}`,
      `Preferred next step: ${value("next_step")}`,
      "",
      value("need"),
    ].join("\n");
    location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}
