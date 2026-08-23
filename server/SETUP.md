# Membership payment setup (Stripe test mode)

This API lives in `server/`. The public website stays static. Card numbers never touch this app or the website forms.

## 1. Where each environment variable goes

Create `server/.env` from `server/.env.example` on the machine that runs this API (never GitHub Pages, never the browser).

| Variable | Where | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | `server/.env` only | Creates Checkout Sessions and verifies subscriptions. Never frontend. |
| `STRIPE_PUBLISHABLE_KEY` | `server/.env` | Reserved for future Stripe.js; Checkout redirect does not need it in the page. |
| `STRIPE_WEBHOOK_SECRET` | `server/.env` only | Verifies Stripe webhook signatures. |
| `STRIPE_PRICE_ID` | `server/.env` | Fallback recurring Price ID. |
| `STRIPE_PRICE_ADULT` / `STRIPE_PRICE_CHILD` | `server/.env` | Plan-specific recurring prices. |
| `PUBLIC_SITE_URL` | `server/.env` | Success/cancel return URLs. |
| `ALLOWED_ORIGINS` | `server/.env` | CORS allow-list for the website origin. |
| `SESSION_SECRET` | `server/.env` | Required in production. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `server/.env` | Staff dashboard at `/admin`. |
| `NOTIFY_EMAIL` | `server/.env` | Office alerts (no card data). |
| `PATIENT_ADAPTER` | `server/.env` | `local` or `http`. |
| `membershipApiUrl` | `assets/js/site-config.js` | Public URL of this API, e.g. `https://api.example.com`. Not a Stripe secret. |

## 2. Run Stripe in test mode

1. Client opens Stripe Dashboard → toggle **Test mode**.
2. Developers → API keys → copy `sk_test_...` and `pk_test_...` into `.env`.
3. Products → add Adult and Child products with **recurring yearly** prices. Copy `price_...` IDs.
4. In `server/`: `npm install` then `npm start` (port 4242).
5. Set `membershipApiUrl` in `site-config.js` to that API origin when hosted.

Until keys are real test keys (not placeholders), checkout returns: **Online payment is currently unavailable.**

## 3. Webhook setup

Local:

```
stripe listen --forward-to localhost:4242/webhooks/stripe
```

Paste the `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

Hosted: Stripe Dashboard → Developers → Webhooks → add `https://YOUR_API/webhooks/stripe`.

Subscribe at least:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`

Memberships activate only after a verified webhook, not because the browser opened the success page.

## 4. Switch test → live

Replace `sk_test_` / `pk_test_` / test `price_` / test webhook secret with live values. Set `NODE_ENV=production`, `SESSION_SECRET`, admin credentials, HTTPS, and `ALLOWED_ORIGINS` to the live site only. Restart the API.

## 5. Must change before production

- Real live Stripe keys on the **client’s** account
- HTTPS on the API
- Strong `ADMIN_PASSWORD` and `SESSION_SECRET`
- Restrict CORS origins
- Point `membershipApiUrl` at the production API
- Confirm webhook endpoint is live and signature-verified
- Patient matching: keep `PATIENT_ADAPTER=local` until the practice PMS API is ready
- Do not commit `.env` or `server/data/`

## Test cards (test mode only)

Use Stripe’s `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP. Failures: `4000 0000 0000 9995`.
