# Quality Insights — Frontend

Web UI for per-release, per-layer QA data read from the test team's Excel
sheets on disk. React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router +
Recharts.

Nothing is uploaded from the browser: the server reads each release's folder.
The upload flow is commented out rather than deleted — see *Re-enabling upload*
in the backend README.

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

## Releases

An application is browsed one release at a time. The release lives in the
`release` query parameter, so every layer and data URL is a deep link into one
release's data:

```
/apps/cellsens                                  → the current release
/apps/cellsens?release=v4-3                     → an older release
/apps/cellsens/layers/regression?release=v4-3&view=data
```

The **Release** switcher sits in the page header on both the layers page and the
layer page. It lists every release newest-first with its record and layer
counts, marks the current one, and is where admins create a release, promote an
older one, or delete one. Without the parameter the app opens the current
release; an unknown release id falls back to it rather than erroring.

Each release keeps its own testing layers, its own Excel column schema and its
own rows, so switching release swaps the whole view and loading a new release
never rewrites an old one. A layer that exists in one release but not another is
reported as such instead of 404-ing.

## What each role sees

- **manager** — browse applications → releases → testing layers → ingested data
  and dashboard.
- **qa** — everything above, plus **Load from Excel**, which reads the
  release's own folder and records a snapshot per testing type. The dialog asks
  which month the data describes (defaulting to the current one); there is no
  merge-or-replace choice. The result summary reports each type's new snapshot
  number and what changed since the one before it — or says nothing was
  recorded, when the data had not changed.
- **admin** — everything above, plus **New / delete release** and **make
  current**, **Add / Delete application**, **Add / Delete layer** (per release,
  cascading to that release's data), **Delete ingested data** (per layer, per
  release), **Delete snapshot** from the History tab, the Excel root and
  per-release folder override in Settings and on the layers page, and
  **Add / Delete users** (cannot delete their own account).

## Files, snapshots and history

**One Excel file is one dataset.** A testing type fed by several workbooks
keeps them entirely separate in storage — separate records, columns and
per-file metrics. A **File** selector sits beside the tabs when a testing type
has more than one workbook; with only one it just names the file and its load
time.

On the **Dashboard** the selector also offers **All n files — merged**, which
totals every file's current snapshot — and that is what the Dashboard **opens
on** unless a particular file or snapshot is named in the URL. A testing type
with one workbook simply shows that workbook. Merging is a read-time view:
nothing is written, and the measures are the union of what the files carry,
each summed over the files that have it. Records are always read one file at a
time.

Every load records a complete, read-only snapshot per file. The layer page has
three tabs:

- **Dashboard** and **Data** show the current snapshot by default, or an
  earlier one behind a banner making clear it is history.
- **History** is common to the testing type: every file's snapshots together,
  newest load first, each naming its file and flagged current for its own
  file — with month, record count, columns, exact load time and what changed
  since that file's previous load. The bars are coloured per file, and a diff
  only ever compares a file with itself. **Select a row to open that
  snapshot**; the row on screen is highlighted. There is no file picker on this
  tab, since history always covers every file. Admins delete a bad snapshot
  from here; that file's previous snapshot becomes current again.

A snapshot is addressed in the URL alongside the release, so any point in
history is a link:

```
/apps/cellsens/layers/regression?release=4-5-1&file=part-a.xlsx
/apps/cellsens/layers/regression?release=4-5-1&snapshot=<id>
/apps/cellsens/layers/regression?release=4-5-1&merged=1
```

Without a file the views open on the **most recently loaded** one.

Each snapshot renders with **its own columns**, so a sheet whose format changed
between loads still reads correctly when you look back at it.

## Where the data comes from

The Excel source card on the layers page shows the one folder this release
reads:

```
<Excel root>\cellSens\4.5.1\regression.xlsx
```

The two folder names are the application's and the release's, exactly as shown
in the UI, so there is nothing to configure per application or per release — the
card just tells you which folder to create. A release whose workbooks live
elsewhere gets a single **Change folder** override, relative to the Excel root.
The Excel root itself is set once, by an admin, in Settings.

## Structure

```
src/
├── api/          types + HTTP client — the ONLY data-access surface
├── auth/         AuthContext (localStorage session) + RequireRole guard
├── layout/       AppLayout (role-filtered nav, release-preserving back) + nav config
├── lib/          useData · useRelease (resolves ?release= → active release) · format · palette
├── components/   Card/KpiTile/Segmented/Modal/ReleaseSwitcher/SyncDialog +
│                 charts/  (UploadDialog + FileDrop are commented out)
├── pages/        Login · Applications · Layers · Layer (Data | Dashboard) ·
│                 Settings · Users
└── index.css     design tokens (light/dark), Tailwind theme mapping
```

The layer page renders whatever columns the backend discovered in *that
release's* uploaded sheet (`ColumnDef[]`), grouped by section — no column names
are hardcoded, so each release of each layer can carry a different Excel schema.
The Dashboard tab shows real aggregates for the selected release (totals per
numeric column, per-section chart + donut, largest specs) and an honest
placeholder where pass-rate trends will land once run results are ingested.

The testing-pyramid check on the layers page compares layers **within one
release**, since a release owns its own layers.

## Checks

```bash
npm run build      # TypeScript + production bundle
npm run verify     # browser-driven role-path suite (needs `npm run dev -- --port 5199` running)
```

`scripts/verify-ui.mjs` drives every role through login, RBAC blocks/allows,
release switching and deep links, layer browsing, the per-file selector,
snapshot history, the load/add-layer/new-release dialogs, the absence of any
upload affordance, settings save, deep-link return, session persistence, dark
mode, and a 390px overflow check — 64 assertions. It finds Chrome automatically on macOS,
Windows and Linux; set `CHROME_PATH` to override.
