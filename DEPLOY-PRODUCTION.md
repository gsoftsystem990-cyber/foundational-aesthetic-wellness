# Production deploy (custom domain + admin)

This project needs **Node.js hosting** (site + `/admin` run from the same Express server).  
`foundationalaestheticwellness.com` is currently on **GoDaddy Website Builder**, which cannot run Node/admin.

## What you need from the client

1. GoDaddy login (or DNS access) for `foundationalaestheticwellness.com`
2. Permission to point the domain away from Website Builder to your Node host
3. A free [Render](https://render.com) or [Railway](https://railway.app) account (or any VPS)

## Option A — Render (recommended)

1. Push this repo to GitHub (private is fine) **or** upload via Render Docker.
2. In Render: **New → Blueprint** and use `render.yaml`, **or** **New → Web Service** → Docker.
3. Set environment variables:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `PORT` | `4242` |
| `PUBLIC_SITE_URL` | `https://foundationalaestheticwellness.com` |
| `ALLOWED_ORIGINS` | `https://foundationalaestheticwellness.com,https://www.foundationalaestheticwellness.com` |
| `SESSION_SECRET` | long random string (32+ chars) |
| `ADMIN_USERNAME` | your staff username |
| `ADMIN_PASSWORD` | strong password |

4. Deploy. Note the temporary URL, e.g. `https://faw-site.onrender.com`
5. Open `https://YOUR-RENDER-URL/admin` and confirm login works.
6. In Render → Custom Domain → add `foundationalaestheticwellness.com` and `www`.

### GoDaddy DNS (after Render shows DNS targets)

In GoDaddy DNS for this domain:

- Remove Website Builder / forwarding that keeps the old DPS site
- Add the **A / CNAME** records Render shows (often CNAME `www` → `….onrender.com`, and apex per their docs)
- Wait for SSL (can take up to a few hours)

Live URLs after DNS:

- Site: `https://foundationalaestheticwellness.com/`
- Admin: `https://foundationalaestheticwellness.com/admin`

## Option B — Railway

```bash
railway login
railway init
railway up
railway domain
```

Set the same env vars as above, then attach the custom domain in Railway and update GoDaddy DNS.

## Option C — VPS (Contabo / DigitalOcean)

1. Install Node 20+, clone project, `cd server && npm ci --omit=dev`
2. Create `server/.env` for production
3. Run with PM2: `pm2 start index.js --name faw`
4. Nginx reverse proxy + Let's Encrypt for the domain
5. Point GoDaddy A record to the VPS IP

## Notes

- Admin is required and is included at `/admin` on the same host as the website.
- Free Render/Railway disks are ephemeral: patient DB/photos can reset on redeploy unless you add a persistent disk/volume.
- Stripe/WhatsApp are optional; bookings, reviews, messages, and patients work without them.
