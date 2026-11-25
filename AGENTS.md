<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Keep the team guide current

`lib/guide/content.ts` is the BIP Control team guide (shown at /guide, printed at /guide-print, downloaded as Word). When you add, rename, remove or meaningfully change a sidebar tool, update its entry there in the same change and bump `updated`. `lib/guide/content.test.ts` fails when the sidebar and the guide disagree.

# House rules for new code

- **Sidebar:** links live in `lib/nav/sections.ts`, in six sections (Home, Clients, Reporting, Onboarding, Playbook, Admin). Add a tool to the section it belongs to, and its guide entry in the same place.
- **AI models:** use `MODELS` from `lib/ai/models.ts`; never write a model id anywhere else. `lib/ai/models.test.ts` enforces it.
- **Reading lists:** use `fetchAllRows` (`lib/data-integrity/fetch-all.ts`). Don't add `.limit()` to a list someone relies on, and never turn a failed read into an empty list. `lib/data-integrity/limit-ratchet.test.ts` fails on a new limit.
- **API routes:** start with `requireSignedIn()` or `requireAdminRole()` from `lib/auth/guard.ts`. `lib/auth/route-access.test.ts` fails on a route that checks nobody.
