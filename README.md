# Quality Insights — Frontend

Production-structured web UI for the Testing Pyramid quality dashboards.
React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router + Recharts.

**UI-only phase:** all data is seeded mock data served through `src/api/client.ts`
with simulated latency. When the Python/FastAPI backend lands, only the function
bodies in that one file change to `fetch()` calls (each is annotated with its
future endpoint) and `src/api/mock/` is deleted — nothing else in the app changes.

## Run

```bash
cd frontend
npm install
npm run dev        # → http://localhost:5173
```



Roles are hierarchical (manager ⊂ qa ⊂ admin); route guards redirect
unauthorized URLs to `/apps` and unauthenticated ones to `/login`
(returning to the original target after sign-in).

## Structure

```
src/
├── api/          types + mock client — the ONLY data-access surface
├── auth/         AuthContext (localStorage session) + RequireRole guard
├── layout/       AppLayout (role-filtered nav) + nav config
├── components/   Card/KpiTile/StatusChip/Meter/… + charts/ (Recharts + PyramidSvg)
├── pages/        Login · Applications · Pyramid · Dashboard · TestCases ·
│                 TestDetail · Runs · Settings · Users
└── index.css     design tokens (light/dark), Tailwind theme mapping
```

## Checks

```bash
npm run build      # TypeScript + production bundle
npm run verify     # browser-driven role-path suite (needs `npm run dev -- --port 5199` running)
```

`scripts/verify-ui.mjs` drives every role through login, RBAC blocks/allows,
drill-downs, settings save, deep-link return, session persistence, dark mode,
and a 390px overflow check — 21 assertions.
