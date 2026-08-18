# Quality Insights — Frontend

Web UI for per-layer QA data ingested from the test team's Excel sheets.
React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router + Recharts.

Talks to the FastAPI backend (`../Ai_automation_Backend`) through
`src/api/client.ts` — the only data-access surface. Set `VITE_API_URL` in `.env`
if the API is not on `http://localhost:8000`.

## Run

```bash
npm install
npm run dev        # → http://localhost:5173  (backend must be running)
```

Roles are hierarchical (manager ⊂ qa ⊂ admin); route guards redirect
unauthorized URLs to `/apps` and unauthenticated ones to `/login`
(returning to the original target after sign-in).

## What each role sees

- **manager** — browse applications → testing layers → ingested data + dashboard.
- **qa** — everything above, plus **Upload Excel** per layer with a
  merge-or-replace choice when data already exists (result summary reports
  new / updated / unchanged / duplicate-skipped rows).
- **admin** — everything above, plus **Add / Delete application**, **Add /
  Delete layer** (cascades to the layer's data), **Delete uploaded data** (per
  layer), Settings, and **Add / Delete users** (cannot delete their own account).

## Structure

```
src/
├── api/          types + HTTP client — the ONLY data-access surface
├── auth/         AuthContext (localStorage session) + RequireRole guard
├── layout/       AppLayout (role-filtered nav) + nav config
├── components/   Card/KpiTile/Segmented/Modal/FileDrop/UploadDialog + charts/
├── pages/        Login · Applications · Layers · Layer (Data | Dashboard) ·
│                 Settings · Users
└── index.css     design tokens (light/dark), Tailwind theme mapping
```

The layer page renders whatever columns the backend discovered in the uploaded
sheet (`ColumnDef[]`), grouped by section — no column names are hardcoded, so
each layer can carry a different Excel schema. The Dashboard tab shows real
aggregates (totals per numeric column, per-section chart + donut, largest
specs) and an honest placeholder where pass-rate trends will land once run
results are ingested.

## Checks

```bash
npm run build      # TypeScript + production bundle
npm run verify     # browser-driven role-path suite (needs `npm run dev -- --port 5199` running)
```

`scripts/verify-ui.mjs` drives every role through login, RBAC blocks/allows,
layer browsing, upload/add-layer dialogs, settings save, deep-link return,
session persistence, dark mode, and a 390px overflow check — 33 assertions.
