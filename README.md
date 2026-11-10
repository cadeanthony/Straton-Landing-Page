# Straton – Google Ads landing page

Live at **https://agency.stratonmanagement.com** (Vercel, static, no build step).

- One page per ad group (each is a full copy: HTML, CSS and JS in one file):
  - `index.html` → `/` (onlyfans agency, best/top agency, for new creators)
  - `usa.html` → `/usa` (us / american / usa agency keywords)
  - `los-angeles.html` → `/los-angeles` (LA keywords)
  - `management.html` → `/management` (manager / management agency / company / private)
- `thank-you.html`: after a completed application. Its Google tag only loads when the visitor
  arrives from a submitted form, so the Google Ads conversion never counts refreshes or direct visits.
- `api/apply.js`: checks the CAPTCHA, then forwards the lead to Zapier → GHL.
- `vercel.json`: security headers and caching.
- `robots.txt`: lets Google's ad crawler in; the page itself is `noindex`.

## Ad-group pages
The four pages are generated from one base page by `build_pages.py` (kept outside this repo):
each gets its own title, meta description, canonical, H1, subheadline and opening line, and tags
leads in GHL as `ag-agency`, `ag-usa`, `ag-los-angeles` or `ag-management`.
The root page also still accepts `?ag=chatting` (and the older `?ag=management` / `?ag=us`).

## Before launch
- Set `FORM_ENDPOINT` in `index.html` to the Zapier webhook for this page.
- Uncomment the Google tag and replace the `AW-XXXXXXXXXX` IDs.
