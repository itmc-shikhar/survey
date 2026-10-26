# Noticed — soft-launch survey site

Landing page + one-question-per-screen survey (top 10 questions per gender, defined in `lib/questions.ts`). Next.js 16, MongoDB.

## Run locally

```bash
cp .env.example .env.local                          # paste your MongoDB Atlas connection string
npm install
node --env-file=.env.local scripts/setup-db.mjs     # once: creates collections + indexes in MONGODB_DB
npm run dev                                         # http://localhost:3000
npm test                                            # question/validation self-checks
```

## Deploy (Vercel + MongoDB Atlas, both free tiers)

1. **Atlas:** create a free M0 cluster → Database Access: add a user → Network Access: allow `0.0.0.0/0` (Vercel has no fixed IPs) → Connect → Drivers → copy the URI.
2. **Vercel:** import this folder (root directory `noticed_web`) → add env vars `MONGODB_URI` and `MONGODB_DB=noticed` → deploy.
3. Open the site, submit one test response, check it appears in Atlas → Browse Collections.

## Where the data goes

| Collection | Contents |
|---|---|
| `responses` | `respondentId`, `branch` (woman/man/other), `answers` (keyed by question ID), `ref`, `vouchBy`, `startedAt`, `submittedAt`, `durationSec`, `device` |
| `contacts` | Only for people who left a number/email: `respondentId`, `phone`, `email`, `platform`, `consent`. Kept separate from answers. |

## Links to share

- Per channel: `https://<site>/?ref=insta-pune` (any code: letters, numbers, `-`, `_`, max 40)
- Respondents' share links (`?ref=<their id>`) and women's vouch links (`?vouch=<her id>`) are generated on the thank-you screen.

## Private insights page

`/insights-d99d5rfhj7`: browser login prompt, any username, password = `ADMIN_PASSWORD` env var. Shows the funnel (where people drop off), per-channel and per-place numbers, option counts by gender, every response, and a CSV download. The password is checked in `proxy.ts` (login prompt) and again in the page and export route.

Anonymous funnel events (`events` collection) record page visits, question views, skips and chosen options per random session ID. They never contain typed text, phone numbers or emails (`lib/track.ts` drops them server-side too).

## Changing questions

Edit `lib/questions.ts` only. The UI renders from it and the API validates against it. Bump `FORM_VERSION` when you change wording so old and new answers can be told apart. Run `npm test` after.

## Known limits

- No rate limiting (honeypot field only). Add Vercel Firewall rules if spam appears.
- No results dashboard yet: use Atlas Charts or export from Atlas.
