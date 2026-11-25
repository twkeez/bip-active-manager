import type { Guide } from "@/lib/guide/types";

// THE TEAM GUIDE. One entry per sidebar link, in sidebar order. When you add,
// rename, move or change a sidebar tool, update its entry here (and `updated`).
// lib/guide/content.test.ts fails when the sidebar and this file disagree.
// Plain English, written for the team: what it's for, what you can do there,
// and anything that would otherwise surprise you.

export const GUIDE: Guide = {
  updated: "November 25, 2026",
  intro: [
    "BIP Control is Beyond Indigo's home base for running client work: who our clients are, what they bought, what they're waiting on, how their marketing is performing and what we need to do next.",
    "This guide walks through the sidebar from top to bottom, in its six sections: Home, Clients, Reporting, Onboarding, Playbook and Admin. Each tool says what it's for, what you can do there, and anything good to know before you rely on it.",
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
      body: "Basecamp, Google Ads, Google Analytics, Search Console, Business Profiles and Facebook and Instagram sync in on a schedule. Data health shows anything that failed or came back incomplete.",
    },
    {
      heading: "AI features cost money",
      body: "Research and summary tools call paid AI. They say so before they run; use them on purpose, not to see what happens.",
    },
  ],
  sections: [
    {
      title: "Home",
      intro: "Your day: who's waiting on us, where each client stands, and last month's reports.",
      items: [
        {
          href: "/home",
          label: "Home",
          purpose: "Where the day starts: who's waiting on a reply from us in Basecamp, where each client stands (Client Watch), and which of last month's reports aren't sent yet, for your clients or for everyone.",
          youCan: [
            "Switch between My clients (clients whose Strategist on the Master Sheet names you, alone or shared like Daniel/Tom) and Everyone",
            "Open a client waiting on us, or their last Basecamp message",
            "In Client Watch, open a client to see what we owe, open asks, our commitments not yet done, the latest report seen, flags and a suggested next action",
            "Have Claude read one client's Basecamp threads again with Read now",
            "Open a report that isn't sent yet",
            "In Everyone, see each strategist's numbers side by side",
          ],
          notes: [
            "The Basecamp numbers are the Response Report's, and the report states are Monthly reports'. Go there for every client, other months and the actions.",
            "The reports shown are for last month, the month reports are written for. It moves on at the start of each month.",
            "Report tracking began November 25, 2026. An October report finished before then shows Not started until it's marked on Monthly reports.",
            "Strategists in the Everyone table are named as in column I of the Master Sheet.",
            "Client Watch is Claude reading each client's Basecamp threads from the last 90 days (180 when a client has been quiet). It's read again on weekday mornings for clients with new posts. Each read is dated; check the thread before acting on it.",
            "Client Watch is for the team only. The next action is a suggestion for the strategist, never something sent to the client.",
            "Client Watch only sees Basecamp. A reply by email or phone won't show, so a client can look like they're waiting when they aren't.",
            "Each read is a paid Claude call. Read now costs one read; the weekday refresh only reads clients with new posts.",
            "Nothing is sent from Home. Read now only reads Basecamp and saves Claude's notes.",
          ],
        },
        {
          href: "/response-report",
          label: "Response Report",
          purpose: "Every Master Sheet client with a Package: who spoke last, when we last replied, and when the client last reached out.",
          youCan: [
            "Switch between Waiting on us, Haven't heard from us, Waiting on client, No activity and All",
            "Mark a client low contact (or remove it) from the row's menu, or on the client's page",
            "Mark a client cancelling or a former client from the row menu or the client page; it moves to the Excluded list at the bottom, where it can be put back",
            "Open Not on the Master Sheet to see Basecamp projects with no roster client behind them (they aren't counted in the numbers)",
            "Sort, search and filter by who replied last",
            "Notify a strategist by email (it then appears on the Follow-ups tab)",
            "Dismiss a project, or stop tracking one that isn't on the Master Sheet (with a reason), or restore it",
            "Admins: on the Follow-ups tab, see what you've asked strategists to do, mark items done, and reopen anything finished in the last 30 days",
          ],
          notes: [
            "Data comes from the Basecamp sync (the last sync time is shown) and goes back about 180 days.",
            "The roster line at the top counts every client on Master Sheet 2026 with a Package, and names any that aren't matched to a client with a Basecamp project. Clients are matched by exact name only; the sheet is re-read every morning.",
            "Haven't heard from us means we spoke last (or not at all) and our last post is 15 or more days old; 30 or more for low-contact clients and clients whose Strategist on the sheet is Alex. A client waiting on us is listed there only.",
            "Low contact also lists the client as Paused, so use it only for deliberately quiet accounts.",
            "Excluded clients are counted in the roster line and listed with who marked them and when; they are never dropped without a trace.",
            "The roster line also names any Basecamp project that more than one client record points at. Two Master Sheet practices sharing one project is fine; anything else is listed as wiring to fix on Project Wiring.",
            "The line at the top says how many Master Sheet clients were checked and names every one not reported: not matched, excluded, or could not be read (a failed sync, or a project Basecamp no longer lists). Those rows carry a red Could not be read note.",
            "Only Basecamp is read: email, calls and meetings don't count as contact here.",
            "The sheet decides who is covered: a roster client shows even if its project was marked not tracked, the strategist shown is the one on the sheet, and two practices sharing one Basecamp project each get a row.",
            "Follow-ups close themselves when the person replies in that Basecamp thread. Overdue ones get one reminder email, then appear in the morning email until they're closed.",
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
            "Through the same connector, Claude can also read the Basecamp Response Report and the Basecamp conversation of any Master Sheet client with a Package, whether or not it is on the watch list. Each answer says how many clients were checked and names any that could not be read.",
            "This is separate from the daily \"Client watch\" routine in Coal Mines.",
          ],
        },
      ],
    },
    {
      title: "Clients",
      intro: "The client directory and each client's page.",
      items: [
        {
          href: "/dashboard/clients",
          label: "Clients",
          purpose: "The client directory, and the way into everything about one client.",
          youCan: [
            "Search by client or strategist, and filter by strategist, status or service",
            "Open a client to see their pulse (hours, communication, connections, last report, website stage), plan and tier, onboarding research, and linked accounts",
            "From a client's page, see their reporting, SEO, ads, social and sitemaps",
            "On the Connections tab, set the client's IDs, contact, city, tracked keywords and the ZIP codes the monthly rankings scan checks",
          ],
          notes: [
            "New clients come in through Onboarding.",
            "Onboarding research on a client's page is a dated snapshot and doesn't refresh on its own.",
          ],
        },
      ],
    },
    {
      title: "Reporting",
      intro: "What clients see about their results.",
      items: [
        {
          href: "/reporting",
          label: "Monthly reports",
          purpose:
            "Every client with a Package on the Master Sheet, and where its report stands for the month: Not started, Draft, Reviewed or Sent.",
          youCan: [
            "Pick a month and filter by state or strategist",
            "Open a client's report, then start its draft, mark it reviewed, or mark it sent and say how it went out",
            "On the report's Summary tab, write the month's summary and next steps, or have AI draft them from the report's numbers, then edit and approve them",
          ],
          notes: [
            "Strategists see only their own clients, and need Reporting opened for them on the Team page.",
            "Report numbers come from each source's latest finished sync, so they may not line up exactly with the calendar month.",
            "Nothing AI-written goes to a client by itself. A summary shows on the PDF and Word report only once a strategist approves it, changing it takes it off until it's approved again, and a report can't be marked Reviewed or Sent (or its Snapshot emailed) while a summary waits for approval.",
            "Sending a Client Snapshot email marks that client's report sent by Snapshot, for the month most of the snapshot covers. Downloading a PDF or Word file doesn't, because a download doesn't mean the client has it.",
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
      ],
    },
    {
      title: "Onboarding",
      intro: "Bringing a new client in.",
      items: [
        {
          href: "/onboarding",
          label: "Onboarding",
          adminOnly: true,
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
      ],
    },
    {
      title: "Playbook",
      intro: "What we sell, what we promise and how we do the work.",
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
          href: "/client-expectations",
          label: "Client Expectations",
          adminOnly: true,
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
      ],
    },
    {
      title: "Admin",
      intro: "Admins only: people and access, the early-warning checks and account wiring.",
      items: [
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
        {
          href: "/coal-mines",
          label: "Coal Mines",
          adminOnly: true,
          purpose:
            "Everything that keeps watch, in one place: data health (scheduled syncs, broken logins and incomplete reads), routines that run on a schedule and keep a history, and canaries that run each time you open the page.",
          youCan: [
            "See how each scheduled sync last ran, which logins are broken, and any read that came back cut short; mark cut-short reads resolved",
            "Pick a routine or canary and see what it found",
            "Run a routine now, change its settings, and choose which clients it watches",
            "Mark a flagged thread done when it was handled outside Basecamp",
          ],
          notes: [
            "Canaries only report; they never change anything. Setting changes apply from the next run.",
            "Each data problem is emailed once. While a cut-short read is unresolved, client report and briefing exports are blocked so nothing goes out incomplete.",
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
  ],
};
