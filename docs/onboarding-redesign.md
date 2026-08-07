# Onboarding Redesign — Build Spec

**Status:** proposal / not started
**Goal:** Make client onboarding feel like software you can't mess up — led through it once by a strict linear wizard, then living forever after as a by-service overview where every piece of info is readily available and editable.

> This spec is a plan only. No code has been changed. It's written to be built in phases so the current onboarding keeps working the whole way through.

---

## 1. The vision in one paragraph

Onboarding becomes **two views of one dataset**. The **first pass** is a strict linear wizard: one step at a time, a visible progress rail, a single primary "next" button, and no way to silently skip required work. **After the first pass**, the same client is shown as a **by-service overview map**: a control panel grouped by service (SEO, PPC, Social, Blog, Reviews) where each section shows *the actual captured data* — the keywords chosen, the kickoff date, the audit score — and lets you dive in to review, redo, or change any of it. The wizard is the *path*; the map is the *filing cabinet*. They share the same underlying step modules.

---

## 2. The two modes

### Mode A — Guided wizard (first run)
- **Layout:** progress rail on the left, one focused step on the right.
- **Rail:** every step listed with unmistakable status — ✅ done · 🔵 current · ⚪ upcoming · 🔒 locked-until-launch.
- **Focus pane:** the current step's action UI (profile editor, keyword picker, campaign planner, etc.) plus a primary **"Mark done → Next"** button.
- **Motion:** linear by default; the wizard always pulls you to the next incomplete *required* step. You *can* click any step in the rail to jump (nothing is lost), but the happy path is a straight line.
- **Order:** foundation steps first, then per-service, in a sensible do-this-first sequence (existing `sort_order`).

### Mode B — By-service overview map (after first run)
- **Layout:** grouped cards, one group per active service, plus a shared foundation group.
- **Each card shows the captured value, not just a checkmark** (see §4).
- **Each card is a live window:** clicking it re-opens *the same step module the wizard used*, so you can edit or re-run just that piece.

### When it flips (the rule)
The flip is **not a one-time event**. The rule is:

> **Show the guided wizard whenever there is a clear next required thing to do. Otherwise, show the map.**

- Required steps still undone → land in the wizard.
- All current required steps done → land in the map.
- Launch unlocks new deferred steps weeks later → the wizard naturally re-surfaces for those.
- A toggle is always available to switch views manually.

---

## 3. Foolproof principles (the "can't mess it up" rules)

1. **One decision at a time** in the wizard — the focus pane never shows more than the current step.
2. **The system tracks completion, not the human** — the rail and map always show what's done and what's left; the user never has to remember.
3. **Skipping is allowed but never silent** — you can jump around, but incomplete required steps stay flagged, and a persistent banner shows *"N steps left before this client can go active: X, Y, Z"* at all times.
4. **Resumability** — walk away mid-onboarding, come back to exactly where you were; half-finished state is saved (already true today, keep it).
5. **Honest progress** — the progress number can never read 100% while real work is queued (see §6).

---

## 4. What each service card surfaces (the "all info readily available" part)

The map groups by service. Not every step is service-specific, so there's a shared group on top.

**🏛 Account & Foundation** *(always present)*
- Profile & services · Kickoff thread · Discovery · Client meeting · Weekly cadence

**🔍 SEO** *(if active)*
- Keyword research · Site audit *(at launch)* · Baseline rankings *(at launch)*

**📣 Google Ads / PPC** *(if active)*
- Account setup · Competitor ads · Campaign plan · Conversion tracking *(at launch)* · Launch *(at launch)*

**📱 Social** *(if active)*
- Connection health · Brand assets

**✍️ Blog** *(if active)* — Content schedule

**⭐ Reviews / ORM** *(if active)* — GBP connection · GatherUp

**Card content spec (example rows):**
| Step | Status | Captured summary | Actions |
|---|---|---|---|
| Keyword research | ✅ | 12 keywords selected · updated Aug 3 | View / Edit |
| Kickoff thread | ✅ | Sent Aug 2 · client replied Aug 4 | View |
| Site audit | ✅ | Score 82 · run Aug 5 | Re-run |
| Campaign plan | 🔵 | Draft saved, not finalized | Continue |
| PPC launch | 🔒 | Comes at launch (Sep 1) | — |

**Group headers roll up status:** e.g. *"SEO · 1 of 3 · on track"* or *"PPC · blocked: conversion tracking"*.

**Connections health folds into the service groups** — GBP under Reviews, FB/IG under Social, GA4/Ads under PPC — instead of being a separate global widget.

---

## 5. The entry moment (intake / pipeline form)

The entry stays what it is today — upload the BIP pipeline document, Claude parses it, the drawer is the review surface. The hand-holding improvement is **confidence signaling** on the parsed result:

- Visually distinguish **"Claude filled this confidently"** from **"please check this."**
- Surface low-confidence / conflicting fields at the top — especially the existing `locationConflict` flag.
- Frame the review as *"confirm these few things I wasn't sure about"* rather than *"re-read this whole form."*

Goal: the first click feels like verification, not re-entry.

---

## 6. Progress model fix

Today the progress % counts only foundation-phase required steps, so a client can read **100%** with launch deliverables still pending. Fix:

- Report **two honest numbers** — e.g. *"Foundation 6/6 · Launch 2/5"* — or a single bar with a locked launch segment.
- The headline number never says 100% while any required work (including deferred) remains.
- Keep `readyToGraduate` server-side gating as-is; just make the *display* honest.

Touch point: `lib/clients/onboarding.ts` (`evaluateClientOnboarding`).

---

## 7. Architecture — the enabling refactor

This is what makes the two modes possible without duplicating logic.

### 7a. Extract each step into a self-contained module
Today the ~1300-line `components/dashboard/onboarding-wizard.tsx` hard-codes a giant if/else keyed on each step's `verification` string. Refactor each step's action UI into its own component with a common contract, e.g.:

```
StepModule = {
  key,                    // e.g. "research_keywords"
  Summary(client)         // compact "captured value" row for the map card
  Action(client)          // the full interactive UI (picker, planner, etc.)
  status(client)          // done | current | blocked | locked
}
```

Both shells render the same modules:
- **Wizard shell** renders one module's `Action` at a time, in sequence.
- **Map shell** renders each module's `Summary`, expanding to `Action` on click.

### 7b. Unify the two drifting renders
Today there are two separate implementations of the checklist:
- `components/dashboard/onboarding-wizard.tsx` (at `/onboarding`)
- `components/dashboard/client-onboarding-view.tsx` (client workspace tab)

Give them distinct jobs instead of letting them duplicate:
- `/onboarding` wizard → **Mode A** (guided first-run).
- client workspace onboarding tab → **Mode B** (the map).

Both consume the shared step modules from 7a, so they can never drift again.

### 7c. Data model
Largely **no schema changes needed** — the current tables already support this:
- `client_onboarding_templates` (step catalog) — unchanged.
- `client_onboarding_items` (per-client per-step state) — unchanged; already stores `completed_at`, `notes`, `phase`, `required_for_graduation`, `requires_service`.
- `client_onboarding_intake` — unchanged.
- `clients.onboarding_status` — unchanged.
- *Possible small add:* a per-step confidence/last-run timestamp is already largely covered by `completed_at`; only add columns if a specific card summary needs data not already stored.

---

## 8. Phasing (nothing breaks mid-flight)

**Phase 0 — Module extraction (invisible).**
Refactor the wizard's per-step if/else into step modules (§7a). No UX change; behavior identical. This de-risks everything after.

**Phase 1 — Guided wizard.**
Turn `/onboarding` into the linear stepper: progress rail, single focus pane, "Mark done → Next," honest progress (§6), persistent "N steps left" banner (§3.3). Still uses the same steps/data.

**Phase 2 — By-service map.**
Build the Mode B overview from the step modules; make the client workspace onboarding tab render it (§4, §7b). Fold connections-health into service groups. Implement the flip rule (§2).

**Phase 3 — Intake confidence signaling.**
Add the parse-confidence UX to the intake drawer (§5).

**Phase 4 — Cleanup.**
Delete the now-dead second render and any orphaned if/else. Confirm no divergence remains.

Each phase is independently shippable and leaves onboarding fully working.

---

## 9. What to preserve (don't break)

- The pipeline-document upload + AI parse + review drawer — Tom likes this entry; keep it.
- Server-side graduation gating (`completeOnboardingForClient` throws unless `readyToGraduate`).
- Per-service seeding (`startOnboardingForClient` / `syncOnboardingItemsToServices`) and the `requires_service` logic.
- Auto-verification of steps from data (connections, snapshots, comms events, kickoff date) — the wizard should reflect these, not replace them with manual toggles.
- Resumable half-finished state.

---

## 10. Decisions (settled)

1. **Wizard order:** keep the existing `sort_order` as the baseline, with one change — **discovery runs before the kickoff thread.** The flow does discovery first, then guides the strategist through reach-out. The kickoff step should be able to *use discovery output* (competitors, themes) to inform the kickoff message, so the reach-out is informed rather than generic.
2. **Card summaries:** drafted — see §4a below.
3. **Group ordering in the map:** **needs-attention floats to the top.** Groups/cards with blocked or overdue items sort above healthy ones.
4. **Re-run semantics:** **overwrite** the prior result (no history kept).
5. **The capstone report:** lives as **its own card** ("Finish" group), not a separate top-level action.

## 4a. Card summary reference (draft)

Each card shows a done-state line and a not-yet-state line so status reads at a glance.

**🏛 Account & Foundation**
| Step | Done | Not-yet | Action |
|---|---|---|---|
| Client created | "Added Aug 1 · from Pipeline_Form.pdf" | — | — |
| Profile | "Sarah · Tier 2 · Mon–Fri 8–5" | "Needs strategist & hours" | Edit |
| Services | "SEO, PPC, Social active" | "Confirm services" | Edit |
| Kickoff thread | "Started Aug 2" | "Not started" | Generate / Open |
| Discovery | "Run Aug 2 · 3 competitors, 5 themes" | "Not run" | Run / View |
| Client meeting | "Held Aug 6" / "Scheduled Aug 6, 2pm" | "Not scheduled" | Set date |
| Client reply | "Client replied Aug 4" | "Awaiting reply · 2 days" | (auto) |
| Weekly cadence | "Last touch Aug 5 · on cadence" | "Overdue 3 days" | (auto) |
| First deliverables | "Sent Aug 7" | "Pending" | Mark done |

**🔍 SEO**
| Step | Done | Not-yet | Action |
|---|---|---|---|
| Keyword research | "12 keywords · updated Aug 3" | "No keywords yet" | View / Edit |
| Site audit *(launch)* | "Score 82 · run Aug 5" | "Not run" | Run |
| Baseline rankings *(launch)* | "Captured Aug 5 · avg pos 14" | "Pending" | Capture |

**📣 Google Ads / PPC**
| Step | Done | Not-yet | Action |
|---|---|---|---|
| Account setup | "Linked · Paws — 481-…" | "Not linked" | Connect |
| Competitor ads | "6 ads saved" | "None yet" | View / Refresh |
| Campaign plan | "Finalized Aug 4" / "Draft saved" | "Not started" | Continue / View |
| Conversion tracking *(launch)* | "Verified" | "Not verified" | Check |
| Launch *(launch)* | "Launched Sep 1" | "Comes at launch" | Launch |

**📱 Social**
| Step | Done | Not-yet | Action |
|---|---|---|---|
| Connection health | "FB + IG connected · healthy" | "IG not connected" | Connect |
| Brand assets | "Pulled Aug 3 · logo + 4 colors" | "Not pulled" | Pull from site |

**✍️ Blog** — Content schedule: "2/mo · next Aug 15" / "Not scheduled" · Set schedule

**⭐ Reviews / ORM**
| Step | Done | Not-yet | Action |
|---|---|---|---|
| GBP connection | "Connected · healthy" | "Not connected" | Connect |
| GatherUp | "Active" | "Not set up" | Set up |

**🏁 Finish** — Onboarding report: "Generated Aug 8" / "Ready to generate" · Generate

**Data caveat:** most summaries use data already stored (dates, scores, counts, tiers, connection health). Four need a small "store a summary snippet" tweak: discovery counts, competitor-ad count, baseline avg position, brand-kit details. Not structural.
