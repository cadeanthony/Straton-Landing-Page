# Straton – Google Ads landing page

Live at **https://agency.stratonmanagement.com** (Vercel, static, no build step).

- `index.html`: the whole page (HTML, CSS and JS in one file).
- `vercel.json`: security headers and caching.
- `robots.txt`: lets Google's ad crawler in; the page itself is `noindex`.

## Ad-group headlines
Add `?ag=` to the Final URL to switch the headline, intro and title:
`?ag=management` · `?ag=chatting` · `?ag=us` (no tag = "OnlyFans Agency").

## Before launch
- Set `FORM_ENDPOINT` in `index.html` to the Zapier webhook for this page.
- Uncomment the Google tag and replace the `AW-XXXXXXXXXX` IDs.
