/* Drives the Quality Insights frontend through every role path.
   Usage: npm run dev -- --port 5199   then   node scripts/verify-ui.mjs [shotsDir] */
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'fs'

const BASE = 'http://localhost:5199'
const SHOTS = process.argv[2] ?? '/tmp/qi-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const ok = (name, pass, extra = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)

/* Chrome lives in a different place on every OS; CHROME_PATH wins if set. */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA &&
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)
const executablePath = CHROME_CANDIDATES.find(p => existsSync(p))
if (!executablePath) {
  console.error('No Chrome found. Set CHROME_PATH to the browser executable.')
  process.exit(2)
}

const browser = await puppeteer.launch({ executablePath, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 980 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const path = () => page.evaluate(() => location.pathname)
const bodyText = () => page.evaluate(() => document.body.innerText)

async function shot(name) {
  await sleep(600)
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}
/** goto and give client-side redirects/data a beat to settle */
async function goSettled(url) {
  await page.goto(url, { waitUntil: 'networkidle0' })
  await sleep(500)
}
async function typeReactInput(selector, value) {
  // typing can race React mount on cached loads: type, verify the controlled
  // input kept the value, retry if React wiped it
  await page.waitForSelector(selector, { visible: true })
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.click(selector, { clickCount: 3 })
    await page.type(selector, value)
    await sleep(250)
    const got = await page.$eval(selector, el => el.value)
    if (got === value) return
    await sleep(400)
  }
  throw new Error(`could not type into ${selector}`)
}
const CHIP_LABEL = { manager: 'Manager', qa: 'QA', admin: 'Admin' }
async function fillViaChip(user) {
  // the demo-account chip sets both fields through React state — immune to
  // the type-before-mount race; if React isn't live yet the click is a no-op
  // and we retry
  const label = CHIP_LABEL[user]
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.evaluate(l => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === l)
      btn?.click()
    }, label)
    await sleep(250)
    const v = await page.$eval('input[autocomplete="username"]', el => el.value).catch(() => '')
    if (v === user) return
  }
  throw new Error(`could not fill login form for ${user}`)
}
async function login(user, pass) {
  await goSettled(`${BASE}/login`)
  await page.evaluate(() => localStorage.removeItem('qi.session'))
  await goSettled(`${BASE}/login`)
  if (CHIP_LABEL[user] && pass !== 'wrongpass') {
    await fillViaChip(user)
  } else {
    await typeReactInput('input[autocomplete="username"]', user)
    await typeReactInput('input[type="password"]', pass)
  }
  await page.evaluate(() => document.querySelector('form')?.requestSubmit())
  await page.waitForFunction(
    () => location.pathname !== '/login' || document.body.innerText.includes('Invalid'),
    { timeout: 6000 },
  ).catch(() => {})
  await sleep(400)
}
/** Leave whatever dialog is open by reloading the page it sits on.
    Dismissing it in-place (Escape, or its Close button) proved unreliable to
    drive from outside: when it silently stays open its card covers the
    controls underneath, and the next click lands on the dialog instead — which
    fails several steps later, far from the cause. A navigation cannot half-work.
    `settled` is text that proves the underlying page finished loading. */
async function leaveModal(url, settled) {
  await goSettled(url)
  await page.waitForFunction(t => document.body.innerText.includes(t),
                             { timeout: 8000 }, settled)
  await page.waitForFunction(
    () => document.querySelector('[role="dialog"]') === null, { timeout: 4000 })
}
let bodyTextCache = ''
/** Choose the merged entry in the file dropdown and wait for the totals. */
async function openReleaseSwitcherless() {
  await page.evaluate(() =>
    document.querySelector('button[aria-label="Choose which Excel file to view"]')?.click())
  await sleep(400)
  await page.evaluate(() => {
    const opt = [...document.querySelectorAll('[role="option"]')]
      .find(o => o.innerText.includes('merged'))
    opt?.click()
  })
  await page.waitForFunction(
    () => document.body.innerText.includes('Merged from'), { timeout: 8000 }).catch(() => {})
  await sleep(400)
  bodyTextCache = await bodyText()
}
async function openReleaseSwitcher() {
  // a leftover dialog would swallow the click, so fail loudly instead
  await page.waitForFunction(
    () => document.querySelector('[role="dialog"]') === null, { timeout: 4000 })
  await page.waitForSelector('button[aria-label="Switch release"]', { visible: true })
  // dispatched through the element like every other click here: a coordinate
  // click can land a frame before React has bound the handler and be swallowed
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.evaluate(() =>
      document.querySelector('button[aria-label="Switch release"]')?.click())
    await sleep(300)
    const open = await page.evaluate(
      () => document.querySelector('[role="listbox"][aria-label="Releases"]') !== null)
    if (open) return
  }
  throw new Error('release switcher did not open')
}
async function clickButton(label) {
  await page.evaluate(l => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(l))
    btn?.click()
  }, label)
  await sleep(400)
}

try {
/* ---- login page + wrong password ---- */
await goSettled(`${BASE}/login`)
await shot('f1_login')
await login('manager', 'wrongpass')
ok('wrong password shows error', (await bodyText()).includes('Invalid username or password'))

/* ---- MANAGER ---- */
await login('manager', 'manager123')
ok('manager lands on /apps', (await path()) === '/apps')
let text = await bodyText()
ok('manager nav hides Settings/Users', !text.includes('Settings') && !text.includes('Users'))
ok('manager has no Add application button', !text.includes('Add application'))
await shot('f2_apps')
await goSettled(`${BASE}/apps/cellsens`)
await page.waitForFunction(() => document.body.innerText.includes('Unit Testing'), { timeout: 6000 })
text = await bodyText()
ok('layers page lists the five default layers',
  ['Unit Testing', 'Regression Testing', 'Feature Testing', 'System Testing',
   'Acceptance Testing'].every(l => text.includes(l)))
ok('manager has no load button', !text.includes('Load from Excel'))
ok('no upload affordance anywhere', !text.includes('Upload Excel'))
ok('release switcher is shown', await page.$('button[aria-label="Switch release"]') !== null)
ok('source card names the folder to use', text.includes('Excel source'))
ok('manager cannot create releases', !text.includes('New release'))
await shot('f3_layers')

/* ---- releases: switching, deep links, isolation ---- */
const releaseNames = await page.evaluate(async () => {
  const token = JSON.parse(localStorage.getItem('qi.session')).token
  const res = await fetch('http://localhost:8000/api/apps/cellsens/releases',
    { headers: { Authorization: `Bearer ${token}` } })
  return (await res.json()).map(r => ({ id: r.id, name: r.name, current: r.current }))
})
ok('application has at least one release', releaseNames.length >= 1)
const current = releaseNames.find(r => r.current) ?? releaseNames[0]
ok('switcher shows the current release', (await bodyText()).includes(current.name))
await goSettled(`${BASE}/apps/cellsens?release=${current.id}`)
await page.waitForFunction(() => document.body.innerText.includes('Unit Testing'), { timeout: 6000 })
ok('release deep link renders that release', (await bodyText()).includes(current.name))
await goSettled(`${BASE}/apps/cellsens?release=does-not-exist`)
await page.waitForFunction(() => document.body.innerText.includes('Unit Testing'), { timeout: 6000 })
ok('unknown release falls back to the current one', (await bodyText()).includes(current.name))
await goSettled(`${BASE}/apps/cellsens`)
await page.waitForFunction(() => document.body.innerText.includes('Unit Testing'), { timeout: 6000 })
await openReleaseSwitcher()
const switcherText = await bodyText()
ok('switcher lists every release', releaseNames.every(r => switcherText.includes(r.name)))
await shot('f3b_release_switcher')
await page.mouse.click(20, 400)   // click away to dismiss the dropdown
await sleep(200)
await goSettled(`${BASE}/apps/cellsens/layers/unit?view=data`)
// Whether this testing type holds data depends on the database this runs
// against, so accept a rendered table or an empty state. The wait is
// advisory: if it times out the assertion still reports what was on screen,
// which says more than an aborted run does.
const LOADED_OR_EMPTY = String.raw`\brows\b|No data loaded yet|No matching records`
await page.waitForFunction(
  src => new RegExp(src).test(document.body.innerText),
  { timeout: 8000 }, LOADED_OR_EMPTY,
).catch(() => {})
text = await bodyText()
ok('data view renders records or an empty state',
  new RegExp(LOADED_OR_EMPTY).test(text),
  text.split('\n').filter(Boolean).slice(-2).join(' / '))
ok('data/dashboard toggle present', text.includes('Dashboard'))
ok('global back button present', text.includes('Back'))
ok('layer page names the release', text.includes(current.name))
await goSettled(`${BASE}/apps/cellsens/layers/unit?view=data&release=${current.id}`)
await sleep(400)
await clickButton('Dashboard')
ok('switching tab keeps the release in the URL',
  (await page.evaluate(() => location.search)).includes(`release=${current.id}`))
await shot('f4_layer_data')
await goSettled(`${BASE}/apps/cellsens/layers/unit`) // dashboard is the default view
await sleep(600)
text = await bodyText()
ok('dashboard is the default view', text.includes('Records by section') || text.includes('No data loaded yet'))
ok('run-results placeholder honest', !text.includes('Pass-rate trend ·'))
await shot('f5_layer_dashboard')

/* ---- one file, one dataset ---- */
// find a testing type fed by more than one workbook; the selector only shows
// itself when there is a choice to make
const multiFile = await page.evaluate(async () => {
  const token = JSON.parse(localStorage.getItem('qi.session')).token
  const head = { Authorization: `Bearer ${token}` }
  const releases = await (await fetch(
    'http://localhost:8000/api/apps/cellsens/releases', { headers: head })).json()
  const release = releases.find(r => r.current) ?? releases[0]
  if (!release) return null
  const layers = await (await fetch(
    `http://localhost:8000/api/apps/cellsens/releases/${release.id}/layers`,
    { headers: head })).json()
  for (const layer of layers) {
    const files = await (await fetch(
      `http://localhost:8000/api/apps/cellsens/releases/${release.id}` +
      `/layers/${layer.id}/files`, { headers: head })).json()
    if (files.length > 1) return { release: release.id, layer: layer.id, files }
  }
  return null
})
if (multiFile) {
  await goSettled(
    `${BASE}/apps/cellsens/layers/${multiFile.layer}?release=${multiFile.release}`)
  await page.waitForFunction(
    () => document.querySelector('button[aria-label="Choose which Excel file to view"]'),
    { timeout: 8000 }).catch(() => {})
  ok('file selector appears when a testing type has several files',
    await page.$('button[aria-label="Choose which Excel file to view"]') !== null)

  await page.evaluate(() =>
    document.querySelector('button[aria-label="Choose which Excel file to view"]')?.click())
  await sleep(400)
  // the merged entry is an option too, so count only the file entries
  const fileOptions = await page.$$('[role="option"]:not([data-merged])')
  ok('every file is offered separately', fileOptions.length === multiFile.files.length,
    `${fileOptions.length} file options for ${multiFile.files.length} files`)
  ok('the dropdown offers a merged total for the dashboard',
    (await bodyText()).includes('merged'))
  await shot('f5c_file_selector')

  // switching file must change what the page shows, and say so in the URL
  const before = await bodyText()
  await page.evaluate(() => {
    const opts = [...document.querySelectorAll('[role="option"]')]
    opts[1]?.click()
  })
  await sleep(1200)
  ok('choosing a file puts it in the URL',
    (await page.evaluate(() => location.search)).includes('file='))
  ok('choosing a file changes the metrics shown', (await bodyText()) !== before)
  await shot('f5d_file_selected')

  // the merged entry totals every file's current snapshot — a dashboard view,
  // computed on read; the records stay one file per snapshot
  await openReleaseSwitcherless()
  ok('merged totals are reachable from the dropdown',
    (await bodyText()).includes('Merged from'))
  ok('merged says it is a read-time view',
    (await bodyText()).includes('merged at read time'))
  ok('merged names the files it added up',
    multiFile.files.every(f => bodyTextCache.includes(f.fileName)))
  await shot('f5e_merged_dashboard')

  // history covers every file, not just the selected one
  await goSettled(`${BASE}/apps/cellsens/layers/${multiFile.layer}` +
                  `?release=${multiFile.release}&view=history`)
  await page.waitForFunction(
    () => /snapshot|Nothing loaded/.test(document.body.innerText), { timeout: 8000 })
    .catch(() => {})
  const historyText = await bodyText()
  ok('history spans every file of the testing type',
    historyText.includes(`across ${multiFile.files.length} files`) ||
    historyText.includes('Every load of this testing type'))
  // the rows are the control now — the one on screen is marked current
  ok('exactly one history row reads as the one on screen',
    (await page.$$('[role="button"][aria-current="true"]')).length === 1)
  ok('history rows are openable without a separate button',
    (await page.$$('[role="button"][aria-label^="Open snapshot"]')).length > 0
      && !/Viewing/.test(await bodyText()))
  await shot('f5f_common_history')
} else {
  ok('file selector appears when a testing type has several files', true,
    'skipped — no multi-file testing type loaded')
}

/* ---- snapshot history ---- */
await goSettled(`${BASE}/apps/cellsens/layers/unit?view=history`)
await sleep(700)
text = await bodyText()
ok('history tab renders',
  /Nothing loaded yet|Every load of this testing type/.test(text))
ok('history is offered as a tab', text.includes('History'))
await shot('f5b_history')
await goSettled(`${BASE}/settings`)
ok('manager blocked from /settings', (await path()) === '/apps')

/* ---- QA ---- */
await login('qa', 'qa123')
ok('qa login lands on /apps', (await path()) === '/apps')
await goSettled(`${BASE}/apps/cellsens`)
await page.waitForFunction(() => document.body.innerText.includes('Unit Testing'), { timeout: 6000 })
text = await bodyText()
ok('qa sees load buttons', text.includes('Load from Excel'))
ok('qa gets no upload button either', !text.includes('Upload Excel'))
ok('qa has no Add layer button', !text.includes('Add layer'))
await goSettled(`${BASE}/apps/cellsens/layers/unit`)
await clickButton('Load from Excel')
const loadDialog = await bodyText()
ok('load dialog opens',
  /Which month|Excel root folder|does not exist|not configured/.test(loadDialog))
ok('load dialog asks for a period, not a merge mode',
  !loadDialog.includes('Replace') && !loadDialog.includes('Merge with existing'))
await shot('f6_load_dialog')
await leaveModal(`${BASE}/apps/cellsens/layers/unit`, 'Load from Excel')
await goSettled(`${BASE}/settings`)
ok('qa blocked from /settings', (await path()) === '/apps')

/* ---- ADMIN ---- */
await login('admin', 'admin123')
ok('admin login lands on /apps', (await path()) === '/apps')
text = await bodyText()
ok('admin sees Add application', text.includes('Add application'))
await goSettled(`${BASE}/apps/cellsens`)
await page.waitForFunction(() => document.body.innerText.includes('Unit Testing'), { timeout: 6000 })
ok('admin sees Add layer', (await bodyText()).includes('Add layer'))
ok('admin sees delete-layer buttons',
  await page.$('button[aria-label^="Delete "]') !== null)
await clickButton('Add layer')
ok('add-layer modal opens', (await bodyText()).includes('Add testing layer'))
ok('add-layer modal names the release', (await bodyText()).includes(current.name))
await shot('f7_add_layer')
await leaveModal(`${BASE}/apps/cellsens`, 'Unit Testing')
await openReleaseSwitcher()
ok('admin sees New release', (await bodyText()).includes('New release'))
await clickButton('New release')
await page.waitForFunction(
  () => document.body.innerText.includes('Testing layers'), { timeout: 4000 }).catch(() => {})
const releaseModal = await bodyText()
ok('new-release modal opens', releaseModal.includes('Testing layers'))
ok('new-release modal offers to copy layers', releaseModal.includes('Same layers as'))
await shot('f7c_new_release')
await goSettled(`${BASE}/apps`)
ok('admin sees delete-application buttons',
  await page.$('button[aria-label^="Delete "]') !== null)
await goSettled(`${BASE}/users`)
await page.waitForFunction(() => document.body.innerText.includes('Add user'), { timeout: 6000 })
text = await bodyText()
ok('users page shows Add user + self is not deletable',
  text.includes('Add user') && text.includes('you'))
ok('other users have delete buttons',
  await page.$('button[aria-label^="Delete "]') !== null)
await clickButton('Add user')
ok('add-user modal opens', (await bodyText()).includes('Full name'))
await shot('f7b_add_user')
await goSettled(`${BASE}/settings`)
ok('admin can open /settings', (await path()) === '/settings')
await page.waitForSelector('button[type="submit"]', { visible: true })
await page.evaluate(() => document.querySelector('form')?.requestSubmit())
await page.waitForFunction(() => document.body.innerText.includes('Saved'), { timeout: 6000 }).catch(() => {})
ok('settings save shows confirmation', (await bodyText()).includes('Saved'))
await shot('f8_settings')
await goSettled(`${BASE}/users`)
ok('admin can open /users', (await path()) === '/users')
await shot('f9_users')

/* ---- deep-link + session ---- */
await page.evaluate(() => localStorage.removeItem('qi.session'))
await goSettled(`${BASE}/apps/cellsens`)
ok('logged-out deep link bounces to /login', (await path()) === '/login')
await fillViaChip('qa')
await page.evaluate(() => document.querySelector('form')?.requestSubmit())
await page.waitForFunction(() => location.pathname !== '/login', { timeout: 6000 }).catch(() => {})
ok('login always lands on /apps', (await path()) === '/apps')
await goSettled(`${BASE}/apps/cellsens`)
await page.reload({ waitUntil: 'networkidle0' })
await sleep(600)
ok('session survives reload', (await path()) === '/apps/cellsens')

/* ---- dark mode + mobile ---- */
await goSettled(`${BASE}/apps/cellsens/layers/unit`)
await sleep(600)
await page.click('button[aria-label*="dark mode"]').catch(() => {})
await shot('f10_layer_dark')
ok('dark class applied', await page.evaluate(() => document.documentElement.classList.contains('dark')))
await page.click('button[aria-label*="light mode"]').catch(() => {})
await page.setViewport({ width: 390, height: 844 })
await goSettled(`${BASE}/apps/cellsens/layers/unit`)
await sleep(600)
const overflow = await page.evaluate(() => document.documentElement.scrollWidth)
ok('no horizontal overflow at 390px', overflow <= 392, `scrollWidth=${overflow}`)
await shot('f11_mobile')

} catch (err) {
  ok('script completed without crash', false, String(err).split('\n')[0])
  try {
    const where = await page.evaluate(() => ({
      url: location.pathname + location.search,
      dialogs: [...document.querySelectorAll('[role="dialog"]')]
        .map(d => d.getAttribute('aria-label')),
      listbox: !!document.querySelector('[role="listbox"][aria-label="Releases"]'),
      switcher: !!document.querySelector('button[aria-label="Switch release"]'),
      head: document.body.innerText.split('\n').filter(Boolean).slice(0, 12),
    }))
    console.error('CRASH CONTEXT ' + JSON.stringify(where, null, 1))
    console.error((err && err.stack ? err.stack : String(err)).split('\n').slice(0, 4).join('\n'))
    await page.screenshot({ path: `${SHOTS}/zz_crash.png`, fullPage: true }).catch(() => {})
  } catch { /* the page may be gone */ }
} finally {
  await browser.close()
}
console.log(results.join('\n'))
const failed = results.some(r => r.startsWith('FAIL'))
console.log(failed ? 'RESULT: FAILURES PRESENT' : 'RESULT: ALL CHECKS PASS')
process.exit(failed ? 1 : 0)
