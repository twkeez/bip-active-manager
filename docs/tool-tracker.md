# BIP Control: finishing tracker

Started October 29, 2026, from the tool inventory (`docs/tool-inventory-2026-10-29.xlsx`).
Tom approved the recommendations as they stand: keep 22, merge 17, cut 8. Six tools wait on his call.

We work **one item at a time**, top to bottom. An item only moves to Done when every box in
"What done means" is true and Tom has signed off. Done items are frozen: we don't reopen them
unless something real breaks.

Status: `todo` · `doing` · `review` (waiting on Tom) · `done` · `blocked` (says on what)

## What done means

- [ ] Works on real data for several clients, not just one
- [ ] Wording approved by Tom; team-facing tools make sense to someone who isn't Tom
- [ ] Nothing fails silently: failures and missing data are shown, and Tom is told
- [ ] Cost to run is known, and any scheduled job is confirmed to run
- [ ] Decided whether the team version gets it or it stays admin-only
- [ ] Its team guide entry is correct (`lib/guide/content.ts`)
- [ ] Tom signs off

## 1. Reshape the sidebar (cuts and merges)

Cut means the page and its sidebar link go away. Its database tables stay until the team
version is updated, so nothing is lost and it can come back.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.1 | Cut: Inbox, Strategy Mapper, Vet Onboarding, Onboarding SOPs, Reference Library, Report Template, SEO Ops, Backlinks | todo | All but one already hidden; tables kept |
| 1.2 | Merge Data health into Coal Mines | todo | |
| 1.3 | Merge Follow-ups into Response Report (tab) | todo | |
| 1.4 | Merge AI Planner into Assistant | todo | |
| 1.5 | One Ads page: Ads Health with Conversion Integrity, Global Ads Optimization, PPC Defense, Ad Cost Trends as tabs | todo | |
| 1.6 | Ad Calls onto each client's page | todo | |
| 1.7 | One Connections page: Project Wiring, Ads Accounts, Bulk Auto-Discover | todo | |
| 1.8 | One Playbook: Service Playbook, Best Practices, Partnership & Boundaries | todo | Best Practices data still feeds Ads Planner |
| 1.9 | Kickoff message into Client Expectations (tab) | todo | |
| 1.10 | One audit: move anything unique from Site Audit and SEO Audits (mobile speed, keywords, re-run schedule) into Website & AI Audit, then retire both | todo | Ends the double-crawl bug |

## 2. Fix what several tools depend on

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.1 | Search Console access: 212 of 255 clients blocked | todo | Blocks Sitemaps, Client Snapshot, SEO numbers. Needs Google access from Tom's side |
| 2.2 | Google reviews refresh failing nightly for 29 clients since Sep 28 | todo | Quota, or switch to DataForSEO |
| 2.3 | Duplicate Basecamp project wiring | todo | Done inside the Connections page |
| 2.4 | Claude credits: stop a run-out from breaking jobs again | todo | Check the Nov 2 Help Desk run |

## 3. Finish each tool

Core daily tools first, then client-facing output, then the rest.

| # | Tool | Status | Notes |
|---|------|--------|-------|
| 3.1 | Clients (and the client page) | todo | The only tool the team version shows today |
| 3.2 | Response Report + Follow-ups | todo | |
| 3.3 | Daily Brief | todo | |
| 3.4 | Poobah Client Watch | todo | |
| 3.5 | My Tasks | todo | |
| 3.6 | Assistant (+ AI Planner) | todo | |
| 3.7 | Onboarding | todo | |
| 3.8 | Services & Tiers | blocked | Tom picks the one true tier list |
| 3.9 | Client Expectations (+ kickoff message) | todo | After 3.8 |
| 3.10 | Playbook | todo | |
| 3.11 | Client Snapshot | blocked | Needs 2.1 |
| 3.12 | Website & AI Audit | todo | |
| 3.13 | Reputation | blocked | Needs 2.2 |
| 3.14 | Local Grid Rank | todo | |
| 3.15 | Sitemaps | blocked | Needs 2.1 |
| 3.16 | llms.txt | todo | |
| 3.17 | Ads Health (+ tabs) | todo | |
| 3.18 | Ads Diagnostic | todo | |
| 3.19 | Coal Mines (+ Data health) | todo | |
| 3.20 | AI Spend | todo | |
| 3.21 | Connections | todo | |
| 3.22 | Help Desk Report | todo | |
| 3.23 | Team | todo | |
| 3.24 | Doc → PDF | todo | |

## Waiting on Tom

| Tool | The question |
|------|--------------|
| Illuminare Clients | Does Illuminare still need its own client list? |
| Client Briefings | Is the monthly client message Briefings, Snapshot, or one thing? |
| Ads Planner | Do you still start new ads clients from it? |
| Social Planner | Is the team using it? (Used once, Aug 14) |
| Wins | Do you post client wins? |
| Sales Lab | Do you still prospect with it? (Unused since May) |
| Meta ads | Do we need Facebook/Instagram ads reporting? (Never produced data) |
| Team version | Which kept tools should strategists see? |

## Log

- 2026-10-29: Tracker started from the inventory; recommendations approved.
