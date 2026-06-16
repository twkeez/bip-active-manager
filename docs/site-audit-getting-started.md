# Site Audit

Internal URL-first website audits with staged execution.

## Quick start

1. Open **Site Audit** at `/site-audit` (link also on the dashboard header).
2. Paste a URL (e.g. `https://example-vet.com`) and click **Add**.
3. Click **Run full audit** — stages run sequentially with live progress.
4. Review tabs: Overview, Structure, Sitemap, Schema, SEO issues, Keywords, Lighthouse.

## Stages

| Stage | What it checks |
|-------|----------------|
| discovery | Homepage meta, robots.txt |
| sitemap | sitemap.xml URL count and samples |
| crawl | Up to 20 internal pages |
| schema | JSON-LD types and recommendations |
| technical_seo | Homepage SEO + crawl issue counts |
| lighthouse | PageSpeed mobile scores |
| keywords | GSC (if property accessible) or AI content analysis |
| summary | AI executive summary |

## Requirements

- `GOOGLE_PAGESPEED_API_KEY` for Lighthouse stage
- `GEMINI_API_KEY` for keywords (AI fallback) and summary stages
- Google OAuth or service account with Search Console access for measured keyword data

## Database

Apply migration `supabase/migrations/20260521120000_website_audits.sql`.

## API

- `GET/POST /api/site-audit/runs`
- `GET/DELETE /api/site-audit/runs/[id]`
- `POST /api/site-audit/runs/[id]/run-all`
- `POST /api/site-audit/runs/[id]/stages/[stage]`
