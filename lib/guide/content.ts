import type { Guide } from "@/lib/guide/types";

// THE TEAM GUIDE. One entry per sidebar link, in sidebar order. When you add,
// rename, move or change a sidebar tool, update its entry here (and `updated`).
// lib/guide/content.test.ts fails when the sidebar and this file disagree.
// Plain English, written for the team: what it's for, what you can do there,
// and anything that would otherwise surprise you.

export const GUIDE: Guide = {
  updated: "October 22, 2026",
  intro: [
    "BIP Control is Beyond Indigo's home base for running client work: who our clients are, what they bought, what they're waiting on, how their marketing is performing and what we need to do next.",
    "This guide walks through the sidebar from top to bottom. Each tool says what it's for, what you can do there, and anything good to know before you rely on it.",
  ],
  basics: [
    {
      heading: "Signing in",
      body: "Use your @beyondindigo.com Google account. Nobody else can sign in.",
    },
    {
      heading: "Admins vs. strategists",
      body: "Tools marked Admins are only in an admin's sidebar. Strategists start from Clients, where each client's page links out to the tools for that client.",
    },
    {
      heading: "Where the data comes from",
      body: "Basecamp, Google Ads, Google Analytics, Search Console, Business Profiles, Meta and Harvest sync in on a schedule. Data health shows anything that failed or came back incomplete.",
    },
    {
      heading: "AI features cost money",
      body: "Research, scoring and assistant tools call paid AI. They say so before they run; use them on purpose, not to see what happens.",
    },
  ],
  sections: [
    {
      title: "Main",
      intro: "The everyday tools at the top of the sidebar.",
      items: [
        {
          href: "/assistant",
          label: "Assistant",
          adminOnly: true,
          purpose: "A chat assistant that plans your day and keeps your task list tidy.",
          youCan: [
            "Start with \"Plan my day\" or ask your own question",
            "Review the task changes it suggests, apply the ones you want, and Undo any of them",
            "See \"How I got this\" for where each answer came from",
          ],
          notes: [
            "Your calendar shows up only if Google Calendar is connected, and it's read-only.",
            "Conversations aren't saved. Each question uses a few paid AI calls.",
          ],
        },
        {
          href: "/daily-brief",
          label: "Daily Brief",
          adminOnly: true,
          purpose:
            "The morning overview: every active client, most urgent first (onboarding, clients chasing us, clients needing action, clients to keep an eye on), under a live Today panel.",
          youCan: [
            "Read today's calendar, tasks due or overdue, and Coal Mines alerts",
            "Build or refresh today's brief, and open earlier days' briefs",
          ],
          notes: [
            "It builds itself each weekday morning. If today's isn't built yet, a banner says you're looking at an older one. A manual rebuild can take a minute or two.",
          ],
        },
        {
          href: "/dashboard/clients",
          label: "Clients",
          purpose: "The client directory, and the way into everything about one client.",
          youCan: [
            "Search by client or strategist, and filter by strategist, status or service",
            "Open a client to see their pulse (hours, communication, connections, last report, website stage), plan and tier, onboarding research, and linked accounts",
            "From a client's page, jump to their reporting, SEO, ads, social, reputation and sitemaps",
          ],
          notes: [
            "New clients come in through Onboarding.",
            "Onboarding research on a client's page is a dated snapshot and doesn't refresh on its own.",
          ],
        },
        {
          href: "/response-report",
          label: "Response Report",
          purpose: "Every Basecamp project: who spoke last, when we last replied, and when the client last reached out.",
          youCan: [
            "Switch between Waiting on us, Waiting on client, No activity and All",
            "Sort, search and filter by who replied last",
            "Notify a strategist by email (it then appears on Follow-ups)",
            "Dismiss a project, stop tracking it with a reason, or restore it",
          ],
          notes: ["Data comes from the Basecamp sync (the last sync time is shown) and goes back about 180 days."],
        },
        {
          href: "/follow-ups",
          label: "Follow-ups",
          adminOnly: true,
          purpose: "Keeps the things you've asked strategists to do until they're done.",
          youCan: ["See open reminders and your own notes", "Mark items done, and reopen anything finished in the last 30 days"],
          notes: [
            "Notes are created from the Response Report and close themselves when the person replies in that Basecamp thread.",
            "Overdue items get one reminder email, then appear in the morning email until they're closed.",
          ],
        },
        {
          href: "/client-watch",
          label: "Poobah Client Watch",
          adminOnly: true,
          purpose: "A close-watch list for clients we're worried about: a current status, open items, a running log and account basics for each.",
          youCan: ["Add a client to the watch list", "Filter by status", "Update a client's status, open items and log"],
          notes: [
            "Claude can read and update it too. Every change records who made it and when; nothing is deleted.",
            "This is separate from the daily \"Client watch\" routine in Coal Mines.",
          ],
        },
        {
          href: "/client-snapshot",
          label: "Client Snapshot",
          adminOnly: true,
          purpose:
            "The Monthly Snapshot pilot: a simple client-facing page with a few key numbers and the work we did, to replace AgencyAnalytics dashboards.",
          youCan: [
            "Open any client's snapshot to preview it",
            "See which clients are in the pilot, when each was last published and sent, and how often it's been viewed",
          ],
          notes: ["Clients only see what you publish, at their own private link on the client reports site."],
        },
        {
          href: "/client-briefings",
          label: "Client Briefings",
          adminOnly: true,
          purpose: "Preview the briefing note for one client before anything is sent.",
          youCan: [
            "Pick a client and read their findings, what data we couldn't see, and the note as it would arrive",
            "See what the next scheduled reminder runs would send",
            "Send yourself a test",
          ],
          notes: ["Nothing on this page emails anyone except the test you send to yourself."],
        },
        {
          href: "/onboarding",
          label: "Onboarding",
          purpose:
            "Onboard a new client: upload the pipeline form (and the website team's kickoff doc), check the practice details, and research runs on its own. You finish with the Basecamp kickoff message and the client's plan document.",
          youCan: [
            "Start a new client, or pick up one that's onboarding now",
            "Fill in practice details: street, ZIP, practice type, opening date, ad budget, what counts as a lead",
            "Mark onboarding done to take a client off the list",
          ],
          notes: [
            "Research uses paid AI with web search. It won't run without the client's state, and it refuses results about the wrong place.",
          ],
        },
        {
          href: "/my-tasks",
          label: "My Tasks",
          adminOnly: true,
          purpose: "Your personal task board.",
          youCan: [
            "Quick-add tasks and tick them done",
            "Switch between Board, Starred, Today, Week and Done",
            "Link a task to a client, project and phase, and attach files",
            "Ask Claude about a task (it confirms first)",
          ],
          notes: ["You only see your own tasks."],
        },
        {
          href: "/team",
          label: "Team",
          adminOnly: true,
          purpose: "Manage who can sign in and what they can see.",
          youCan: [
            "Invite a teammate as a Strategist or Admin",
            "Change someone's role",
            "Make a set-password link to send them yourself",
          ],
          notes: ["It won't let you remove the last admin."],
        },
      ],
    },
    {
      title: "Coal Mines",
      intro: "The early-warning system: scheduled checks that tell us when something needs attention.",
      items: [
        {
          href: "/coal-mines",
          label: "Coal Mines",
          adminOnly: true,
          purpose:
            "Everything that keeps watch, in one place. Routines run on a schedule and keep a history; canaries are checks that run each time you open the page.",
          youCan: [
            "Pick a routine or canary and see what it found",
            "Run a routine now, change its settings, and choose which clients it watches",
            "Mark a flagged thread done when it was handled outside Basecamp",
          ],
          notes: ["Canaries only report; they never change anything. Setting changes apply from the next run."],
        },
        {
          href: "/data-health",
          label: "Data health",
          adminOnly: true,
          purpose:
            "Anything that means our data may be incomplete: a scheduled job that failed or didn't run, a login that stopped working, or a read that came back cut short.",
          youCan: ["See how each job last ran, and which logins are broken", "Mark warnings resolved"],
          notes: [
            "Each problem is emailed once. While a cut-short read is unresolved, client report and briefing exports are blocked so nothing goes out incomplete.",
          ],
        },
        {
          href: "/basecamp-projects",
          label: "Project Wiring",
          adminOnly: true,
          purpose: "Connect each client to the right Basecamp project.",
          youCan: [
            "Fix tracked clients that aren't linked to a project",
            "Unlink clients that share a project",
            "Link, import, ignore or restore projects with no client",
          ],
          notes: [
            "A client that isn't linked to a project is invisible to the thread monitor, not just quiet.",
            "Importing a near-duplicate creates a second record for the same practice; link to the existing client instead.",
          ],
        },
      ],
    },
    {
      title: "Inbox",
      items: [
        {
          href: "/inbox",
          label: "Inbox",
          purpose: "Triage your Gmail without leaving BIP Control.",
          youCan: [
            "Connect Gmail and sync new or recent mail",
            "Have Claude score how important each message is",
            "Archive, delete, flag, turn a message into a task, or open it in Gmail",
          ],
          notes: ["You only see your own mail. It can't send email; replies happen in Gmail."],
        },
      ],
    },
    {
      title: "Illuminare",
      intro: "A second, fully separate client portfolio with its own Basecamp account.",
      items: [
        {
          href: "/illuminare",
          label: "Clients",
          purpose: "Illuminare's client list: account plans, deliverables and Basecamp communication, with a health rating for each client.",
          youCan: [
            "See who needs attention, who's on watch and who's on track",
            "Open a client",
            "Connect Illuminare's Basecamp account and match its projects to clients",
          ],
          notes: ["Uses a different Basecamp login from Beyond Indigo's. Without it, the communication-based health ratings don't work."],
        },
      ],
    },
    {
      title: "Onboarding",
      intro: "Older planning tools for new and prospective practices. Day-to-day onboarding happens on the Onboarding page at the top.",
      items: [
        {
          href: "/onboarding-strategy-mapper",
          label: "Strategy Mapper",
          adminOnly: true,
          purpose: "Builds a client-facing onboarding strategy report for a new or prospective practice: market audit, keyword list and launch roadmap.",
          youCan: [
            "Fill in practice details and optionally upload a sales file or logo",
            "Fetch and edit competitor research, and run a website audit",
            "Generate the report and copy it into Google Docs",
          ],
          notes: [
            "Copy the report out when you're done; don't rely on it being saved.",
            "If live research isn't available it says so; placeholder competitors are only used when you choose them on the form.",
          ],
        },
        {
          href: "/vet-onboarding",
          label: "Vet Onboarding",
          adminOnly: true,
          purpose: "An intake form for a new vet client that produces an AI onboarding plan.",
          youCan: [
            "Complete the three-step form, or upload a PDF, Word or text file to fill it in",
            "Switch the plan between Client View and Strategy View",
            "Run a Full Discovery questionnaire for a deeper report",
          ],
          notes: ["Start Over clears everything, and plans aren't saved. Some client-facing figures in the plan are illustrative, so check them before sharing."],
        },
      ],
    },
    {
      title: "Services",
      intro: "What we sell, how we deliver it, and what we tell clients to expect.",
      items: [
        {
          href: "/services",
          label: "Services & Tiers",
          purpose: "What we offer and how the Foundation, Premium and Premium Plus plans differ.",
          youCan: ["Browse the tier tables", "Admins can edit them"],
          notes: [
            "Opened from a client's page, it shows that client's own plan instead of the full catalogue. Onboarding and the client document use these tiers.",
          ],
        },
        {
          href: "/playbook",
          label: "Service Playbook",
          purpose: "Best practices, deliverables and guidelines, by service and tier.",
          youCan: ["Browse by service and expand items", "Admins can add, edit and delete items"],
        },
        {
          href: "/onboarding-sops",
          label: "Onboarding SOPs",
          purpose: "The step-by-step instructions for each onboarding step.",
          youCan: ["Read or edit each step's SOP"],
          notes: ["Changes apply right away to new clients and anyone currently onboarding."],
        },
        {
          href: "/client-expectations",
          label: "Client Expectations",
          purpose:
            "The shared wording behind each client's \"Your Marketing Plan & Expectations\" document, and where you produce a client's branded PDF or Word copy.",
          youCan: [
            "Edit the text for each service, including the \"What we need from you\" checklist",
            "Reorder sections and manage the glossary",
            "Pick a client and generate their document",
          ],
          notes: [
            "A client's document only includes the services they have. Each tier's real scope sits beside the text so we don't promise extra work.",
          ],
        },
        {
          href: "/onboarding-settings",
          label: "Onboarding Basecamp Message",
          adminOnly: true,
          purpose: "The master Basecamp kickoff message posted to every new client.",
          youCan: ["Write shared wording for each service, plus wording for each tier", "See what each tier includes while you write"],
          notes: ["Each client gets their tier's wording, or the shared wording when a tier's box is empty. Practice details fill in automatically."],
        },
        {
          href: "/best-practices",
          label: "Best Practices",
          purpose:
            "The rules we always apply (standard negative keywords, campaign setup, constant keywords) and an \"I have this issue\" playbook of fixes for common ads and SEO problems.",
          youCan: ["Search by symptom and read the fix", "Edit entries"],
          notes: ["Onboarding, the Ads Planner and the diagnostic tools build on these, so edits here change what they produce."],
        },
        {
          href: "/services/partnership",
          label: "Partnership & Boundaries",
          purpose: "How we partner at each level, our on-demand rates, and the lines to hold when clients ask for more.",
          youCan: ["Read it", "Admins can edit it"],
        },
        {
          href: "/services/library",
          label: "Reference Library",
          purpose: "Documents, templates and links strategists need, such as brand guides and tier breakdowns.",
          youCan: ["Browse by category and open items", "Admins can add a link or upload a file"],
        },
      ],
    },
    {
      title: "Ads",
      intro: "Google Ads tools. Ads data syncs from Google Ads once a day, early morning Eastern.",
      items: [
        {
          href: "/ads-health",
          label: "Ads Health",
          purpose: "One summary of every Google Ads account, flagging budget, quality and conversion-tracking problems.",
          youCan: ["See which of the three problem areas need attention", "Open a flagged client's Ads tab, or the detailed radar page"],
          notes: ["A summary of Global Ads Optimization, PPC Defense and Conversion Integrity, as of the last daily sync."],
        },
        {
          href: "/ads-diagnostic",
          label: "Ads Diagnostic",
          adminOnly: true,
          purpose: "A deep check-up of one account over the last 30 days: how often ads show at the top, and whether budget or ad rank is holding them back.",
          youCan: [
            "Pick a client to open their Ads audit page on the Live diagnosis tab (the Saved audit tab has the stored audit, its history and export)",
            "See spend, conversions and a prioritized fix list with suggested budget, bid and device changes",
            "Copy negative keywords, and draft ad copy with AI",
          ],
          notes: [
            "Pulls live from Google Ads. It never changes anything in the account; you make the changes yourself.",
            "If part of the pull fails, a yellow box lists what couldn't be checked; those parts are missing, not clean.",
          ],
        },
        {
          href: "/conversion-integrity",
          label: "Conversion Integrity",
          purpose: "Finds campaigns whose conversion tracking looks broken or inflated, across all accounts.",
          youCan: [
            "See problems by severity, with what to check for each",
            "Flag one for a manual tag check, or mute it (saved for the whole team; Show muted brings them back)",
            "Open the client's Ads workspace",
          ],
          notes: ["It reads the daily ads sync; it doesn't scan the client's website. The tag check itself happens in Google Ads or Tag Assistant."],
        },
        {
          href: "/ads-planner",
          label: "Ads Planner",
          adminOnly: true,
          purpose: "Enter a practice's website and get a starter Google Ads plan.",
          youCan: ["Generate ad groups and keywords, a negative keyword list, and budget notes", "Copy each list"],
          notes: ["Built on the Best Practices library plus AI. Plans aren't saved, and nothing is created in Google Ads."],
        },
        {
          href: "/global-ads-optimization",
          label: "Global Ads Optimization",
          purpose: "One table of quality and budget problems across every ads account: ad relevance, expected click-through, Quality Score, budget limits and lost rank.",
          youCan: ["Filter and sort by problem, severity or client", "Sync all accounts now", "Jump to Google Ads or the client"],
          notes: ["Warns about accounts that haven't synced. A failed sync usually means a wrong customer ID or missing manager-account access."],
        },
        {
          href: "/ppc-defense",
          label: "PPC Defense",
          purpose: "Finds wasted spend: keywords Google says land on a poor page, and budget hogs (over 30% of spend with fewer than 2 conversions).",
          youCan: [
            "Review landing-page problems and budget hogs",
            "Copy a task for the web team to your clipboard",
            "Dismiss a budget hog once it's handled (saved for the team), and open the client's Ads tab",
          ],
          notes: ["Dismissing only hides it here; changes to keywords are made in Google Ads."],
        },
        {
          href: "/ad-spend-trends",
          label: "Ad Cost Trends",
          adminOnly: true,
          purpose: "Whether each client's ad spend is rising, flat or falling, from their history of 30-day snapshots.",
          youCan: ["See typical monthly spend across our clients", "Scan each client's spend, history chart and trend"],
          notes: ["View only. Failed syncs and one-off spikes are left out. Typical spend covers our clients only, not all vet hospitals."],
        },
        {
          href: "/ads-calls",
          label: "Ad Calls",
          adminOnly: true,
          purpose: "Individual phone calls from Google Ads call buttons, from each client's latest 30 days.",
          youCan: ["See total, received and missed calls and average length", "Filter by client and by received or missed"],
          notes: ["Google only gives the caller's area code, never the full number, and drops older calls."],
        },
        {
          href: "/ads-accounts",
          label: "Ads Accounts",
          adminOnly: true,
          purpose: "Clients who pay for ads but have no Google Ads account linked, so they get no ads reporting.",
          youCan: ["See likely matches for each client", "Attach the right account with one click"],
          notes: ["Nothing attaches automatically: the wrong account would show one practice another's spend."],
        },
      ],
    },
    {
      title: "Tools",
      items: [
        {
          href: "/help-desk-report",
          label: "Help Desk Report",
          adminOnly: true,
          purpose:
            "Zendesk help-desk tickets for every client on the Master Sheet (who writes in, what they ask for, how often and when last), written to a Google Sheet.",
          youCan: [
            "Run everything: pull new tickets, match them to clients and write the sheet",
            "Fix unmatched tickets on the sheet's Unmatched tab; your fixes are picked up on the next run",
          ],
          notes: [
            "Updates itself every Monday morning (about 7 AM Eastern): new tickets are pulled, sorted and written to the sheet. Run everything any time for a fresh copy.",
            "Ticket text is client correspondence, so it's admins only. It never writes to the Master Sheet itself.",
          ],
        },
        {
          href: "/ai-planner",
          label: "AI Planner",
          adminOnly: true,
          purpose: "Brainstorm and plan a client project or campaign with AI (a dental month, reactivating lapsed clients, a new service launch).",
          youCan: ["Pick a client, project type and goal", "Brainstorm ideas, keep the ones you like, and build a plan", "Edit sections and copy the text"],
          notes: ["Plans aren't saved; copy them out before you leave."],
        },
        {
          href: "/social-planner",
          label: "Social Planner",
          purpose: "Build a client's monthly social calendar from the idea bank, awareness days and recurring series, and send clients the list of photos we need.",
          youCan: [
            "Choose a client and month, drag ideas onto days, edit posts, and have AI draft them",
            "Export the month as a spreadsheet",
            "Manage the idea bank, series and celebration days",
          ],
          notes: ["Only admins create or edit series. Celebration-day dates are re-checked each year."],
        },
        {
          href: "/wins",
          label: "Wins",
          adminOnly: true,
          purpose: "Finds brag-worthy client results in ads, traffic and social data and turns them into social posts for Beyond Indigo.",
          youCan: ["Tick the wins to feature", "Choose whether to name the client", "Draft LinkedIn, Facebook or Instagram posts and copy them"],
          notes: ["Posts leave client names out unless you tick the option."],
        },
        {
          href: "/reports/template",
          label: "Report Template",
          adminOnly: true,
          purpose: "The master layout for client performance reports: which sections and metrics appear.",
          youCan: ["Preview with sample data", "Unlock with the template password and show or hide sections", "Download a sample PDF"],
          notes: ["Saved changes become the default for every client's report."],
        },
        {
          href: "/reports/doc-to-pdf",
          label: "Doc → PDF",
          purpose: "Turns any document into a Beyond Indigo Pets branded PDF.",
          youCan: ["Upload a Word file or paste text", "Set the client name, report type and date", "Edit lines and download the PDF"],
          notes: ["For a Google Doc, download it as Word first, then upload it. Nothing is saved."],
        },
      ],
    },
    {
      title: "SEO",
      items: [
        {
          href: "/seo-audits",
          label: "SEO Audits",
          purpose: "Recurring SEO audits for clients, every 3 or 6 months.",
          youCan: [
            "Enroll a client and set how often",
            "See which audits are due and notify the strategist",
            "Start an audit (site scan plus an AI draft), edit it, download it as Word and mark it complete",
          ],
          notes: ["You see the audits you own. An audit takes a few minutes."],
        },
        {
          href: "/sitemaps",
          label: "Sitemaps",
          purpose: "The health of every client website's sitemap: last update, page count, stale pages, and Search Console submitted vs. indexed.",
          youCan: ["Search and filter clients", "Re-check a client's sitemap now"],
          notes: ["Search Console numbers refresh daily; the sitemap itself is only checked when someone clicks Check."],
        },
        {
          href: "/seo-ops",
          label: "SEO Ops",
          purpose: "The weekly and monthly SEO checklist across all SEO clients.",
          youCan: ["See each client's completion and top blocker", "Show just your clients", "Open a client's SEO Ops tab to work the checklist"],
          notes: ["Some items tick themselves from Search Console and ranking data; others are manual."],
        },
        {
          href: "/site-audit",
          label: "Site Audit",
          purpose: "A full technical website audit: pages, sitemap, crawl, structured data, technical SEO, mobile speed, keywords and an AI summary.",
          youCan: ["Enter a URL and run every step, or re-run one", "Browse the report and copy it into Google Docs"],
          notes: ["Opened from a client's page, it fills in their website. It takes a few minutes."],
        },
        {
          href: "/local-rank",
          label: "Local Grid Rank",
          purpose: "How a practice ranks in Google's local map results across a 5×5 grid around it.",
          youCan: ["Pick a client, up to 3 keywords and a radius", "See the heat map, average rank, top-3 share and nearby competitors", "Look at past scans"],
          notes: ["Needs the client's Google Place ID. Every scan runs live searches."],
        },
        {
          href: "/backlinks",
          label: "Backlinks",
          purpose: "Who links to a client's website: referring domains, backlinks, spam score and domain rank.",
          youCan: ["Look up a domain", "Review linking domains with anchor text and dates"],
          notes: ["Each lookup costs about 5¢ and results aren't saved. Open it from a client's page to look up that client."],
        },
        {
          href: "/reputation",
          label: "Reputation",
          purpose: "What a practice's Google reviews say.",
          youCan: ["Fetch or refresh a client's reviews", "Generate an AI analysis", "See the star breakdown and review topics"],
          notes: ["Needs the client's Google Place ID. Fetching costs about 3¢; regenerating the analysis reuses stored reviews."],
        },
        {
          href: "/llms-txt",
          label: "llms.txt",
          adminOnly: true,
          purpose: "Creates the llms.txt files that help AI tools understand a client's website.",
          youCan: ["Generate them from the site's sitemap", "Preview, copy or download them"],
          notes: ["It only creates the files; someone has to upload them to the website's root folder."],
        },
      ],
    },
    {
      title: "Utilities",
      items: [
        {
          href: "/bulk-discover",
          label: "Bulk Auto-Discover",
          adminOnly: true,
          purpose: "Scans client websites for missing Google Analytics IDs and Google Place IDs and saves them.",
          youCan: ["Run the scan, stop it partway, and watch each client's result"],
          notes: ["Only fills in empty fields; it never overwrites an existing ID."],
        },
      ],
    },
    {
      title: "Sales",
      items: [
        {
          href: "/sales-lab",
          label: "Sales Lab",
          adminOnly: true,
          purpose: "For prospects: reads a practice's website and writes a prompt that builds a demo site in Hostinger Horizons, plus a summary for the strategist.",
          youCan: ["Enter the prospect's website and optional details", "Copy the strategist summary and the demo-site prompt", "Reopen recent runs"],
          notes: ["It doesn't build the demo site itself."],
        },
      ],
    },
  ],
};
