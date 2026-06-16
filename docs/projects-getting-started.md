# Client Projects (My Tasks)

## Quick start: Hiring Campaign example

1. Open **My Tasks** → **Projects** tab.
2. Click **New project**, select the client, name it `Hiring Campaign`, and add an objective (roles, channels, timeline).
3. Select the project and open the **AI** tab.
4. Run **Brainstorm** (optional focus in the prompt box), then **Generate plan**.
5. Click **Apply plan to phases & tasks** to create phases and linked tasks in My Tasks.
6. Switch to **Tasks** tab to work items in Inbox / Today / Starred as usual.
7. Use **Client report** in the project header for performance context (`/reports/{clientId}`).
8. Each Monday, run **Weekly status** on the AI tab; results appear under **History**.

## API endpoints

- `GET/POST /api/projects`
- `GET/PATCH/DELETE /api/projects/[id]`
- `GET/POST /api/projects/[id]/phases`
- `PATCH/DELETE /api/projects/[id]/phases/[phaseId]`
- `GET/POST /api/projects/[id]/artifacts`
- `POST /api/projects/[id]/ai/brainstorm`
- `POST /api/projects/[id]/ai/plan`
- `POST /api/projects/[id]/ai/weekly-status`
- `POST /api/projects/[id]/tasks/from-plan`

## Database

Apply migration `supabase/migrations/20260520120000_client_projects.sql` to your Supabase project.
