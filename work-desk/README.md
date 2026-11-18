# Work desk

How work flows through camayankwadhera.com: it comes in through the site, gets executed with Claude, and approved results go back onto the site.

```
 Website enquiry form ──► MW Work Register (Google Sheet) ──► executed with Claude ──► /work/log on the site
   /enquire                 Enquiries → Jobs → Work Log          (logged per output)       (approved entries only)
```

**Register:** [MW Work Register](https://docs.google.com/spreadsheets/d/1WWUkZXu5kJIA1eg_xMGrhrEfxfNw5qpaMiU_knogf-Q/edit) (sheet ID `1WWUkZXu5kJIA1eg_xMGrhrEfxfNw5qpaMiU_knogf-Q`)

| Tab | Who writes it | What it holds |
|---|---|---|
| Enquiries | The website (via `intake.gs`) | Every form submission. Status: New → Replied / Converted to job / Not a fit / Spam |
| Jobs | Claude and Mayank | One row per piece of work, `JOB-0001` onwards. Client details stay here |
| Work Log | Claude and Mayank | One row per output actually produced, with a link. The full record |
| Guide | — | Short version of this page |

## 1. Intake: connect the form (once)

1. Open the register → **Extensions → Apps Script**. Replace `Code.gs` with [`intake.gs`](intake.gs). Optionally set `NOTIFY_EMAIL`. Save.
2. **Deploy → New deployment → Web app**. Execute as **Me**, access **Anyone**. Approve the permissions.
3. Copy the Web app URL (ends in `/exec`).
4. On the website host, set the build environment variable `PUBLIC_ENQUIRY_ENDPOINT` to that URL and redeploy. Locally, put it in `.env` (see `.env.example`).

Until step 4 is done, the form only previews where an enquiry would go and nothing is sent.

What the form sends: audience, name, email, organization, country, need, preferred next step, the page it came from, and a reference like `MW-261119-K3QZ` that the visitor also sees. A hidden honeypot field drops most bots. The script caps field lengths and neutralises values that start with `=`, `+`, `-` or `@` so nothing is run as a formula.

## 2. Execution: run it with Claude

In any Claude session with Google Sheets connected, say **"check the work desk"**. Claude then:

- lists new enquiries and drafts a reply for each, following the route (CA4CPA, Legal Suvidha, …);
- opens a job when you say to, and links it to the enquiry;
- appends a Work Log row for every output produced while working on a job;
- on close, sets the job to Delivered/Closed and **Publish?** to *Ask client*.

## 3. Publishing: back onto the site

A job is published only when **Publish?** is *Approved – anonymised* or *Approved – named*.

Claude writes `src/content/work-log/YYYY-MM-<slug>.md` from the job's **Public title / summary / outcome** (copy [`_template.md`](../src/content/work-log/_template.md)), builds the site, and opens a pull request. Merging it puts the entry on [`/work/log`](https://camayankwadhera.com/work/log); the three newest also appear on `/work`. Then **Publish?** becomes *Published*.

Rules for public entries:

- No client name unless the register says *Approved – named*. Otherwise describe the client (`clientDescription`), e.g. "A 12-person CPA firm in Texas".
- No figures, documents or screenshots the client hasn't approved.
- The `job` field is kept for traceability and never shown on the site.
