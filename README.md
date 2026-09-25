# fireworkspr.net

The Fireworks PR website, moved off Squarespace to Cloudflare.
It's a static site in `public/` served by a small Cloudflare Worker (`src/worker.js`), which handles:

- the contact form (`POST /api/contact`, emailed to info@fireworkspr.net)
- redirecting `fireworkspr.net` to `www.fireworkspr.net`
- redirecting the old Squarespace URL `/home` to `/`

## Pages

| Path | What |
|---|---|
| `/` | Home (KABOOM hero + portrait) |
| `/contact/` | Contact form |
| `/press/` | Searchable press release archive (data: `public/press/releases.json`) |

## Press release archive

Research files live in `data/press/*.json` (one per employer, with `verified` and `unverified` lists).
Only **verified** entries are published. After editing them, rebuild the site data:

```sh
python3 scripts/build_press.py
```

## Local preview

```sh
npx wrangler dev
```

## Going live on Cloudflare (one-time)

1. **Add the domain to Cloudflare.** Cloudflare dashboard → *Add a domain* → `fireworkspr.net` (Free plan).
   Cloudflare will scan your existing DNS. **Keep any MX/TXT records for email.**
   Delete the Squarespace `A`/`CNAME` records for `@` and `www`.
2. **Point the nameservers.** At your registrar (Squarespace Domains, if the domain was bought there),
   replace the nameservers with the two Cloudflare gives you. Wait for Cloudflare to say *Active*.
3. **Enable Email Routing.** Cloudflare → fireworkspr.net → *Email* → *Email Routing* → *Get started*.
   Add and verify `amybessette@icloud.com` as a destination address, let Cloudflare add its MX/TXT records,
   then under *Routing rules* turn on **Catch-all → Send to an email → amybessette@icloud.com**.
   Every address @fireworkspr.net (info@, amy@, …) then forwards there, and so do contact-form submissions.
4. **Deploy.** Cloudflare → *Workers & Pages* → *Create* → *Import a repository* → pick this repo.
   Name the Worker `fireworkspr-net` (it must match `wrangler.toml`) and leave the build command empty.
   Then on the Worker's *Domains* tab, click *Add Domain* for `fireworkspr.net` and again for `www.fireworkspr.net`.
   Every push to the production branch redeploys automatically.
5. **Cancel Squarespace** only after `https://www.fireworkspr.net` is serving from Cloudflare.
   If the domain is registered at Squarespace, transfer it to Cloudflare Registrar first (or keep renewing it there).
