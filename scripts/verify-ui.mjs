/* Drives the Quality Insights frontend through every role path.
   Usage: npm run dev -- --port 5199   then   node scripts/verify-ui.mjs [shotsDir] */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'

const BASE = 'http://localhost:5199'
const SHOTS = process.argv[2] ?? '/tmp/qi-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const ok = (name, pass, extra = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
})
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
await page.waitForFunction(() => document.body.innerText.includes('Regression testing'), { timeout: 6000 })
text = await bodyText()
ok('layers page lists the four layers',
  ['Regression testing', 'System testing', 'Feature testing', 'Acceptance testing'].every(l => text.includes(l)))
ok('manager has no upload button', !text.includes('Upload Excel'))
await shot('f3_layers')
await goSettled(`${BASE}/apps/cellsens/layers/regression?view=data`)
await page.waitForFunction(
  () => /Camera testing|No data uploaded yet/.test(document.body.innerText), { timeout: 6000 })
text = await bodyText()
ok('regression data view renders sections or empty state',
  text.includes('Camera testing') || text.includes('No data uploaded yet'))
ok('data/dashboard toggle present', text.includes('Dashboard'))
ok('global back button present', text.includes('Back'))
await shot('f4_layer_data')
await goSettled(`${BASE}/apps/cellsens/layers/regression`) // dashboard is the default view
await sleep(600)
text = await bodyText()
ok('dashboard is the default view', text.includes('Records by section') || text.includes('No data uploaded yet'))
ok('run-results placeholder honest', !text.includes('Pass-rate trend ·'))
await shot('f5_layer_dashboard')
await goSettled(`${BASE}/settings`)
ok('manager blocked from /settings', (await path()) === '/apps')

/* ---- QA ---- */
await login('qa', 'qa123')
ok('qa login lands on /apps', (await path()) === '/apps')
await goSettled(`${BASE}/apps/cellsens`)
await page.waitForFunction(() => document.body.innerText.includes('Regression testing'), { timeout: 6000 })
text = await bodyText()
ok('qa sees upload buttons', text.includes('Upload Excel'))
ok('qa has no Add layer button', !text.includes('Add layer'))
await goSettled(`${BASE}/apps/cellsens/layers/regression`)
await clickButton('Upload Excel')
ok('upload dialog opens', (await bodyText()).includes('Drop an Excel file here'))
await shot('f6_upload_dialog')
await page.keyboard.press('Escape')
await goSettled(`${BASE}/settings`)
ok('qa blocked from /settings', (await path()) === '/apps')

/* ---- ADMIN ---- */
await login('admin', 'admin123')
ok('admin login lands on /apps', (await path()) === '/apps')
text = await bodyText()
ok('admin sees Add application', text.includes('Add application'))
await goSettled(`${BASE}/apps/cellsens`)
await page.waitForFunction(() => document.body.innerText.includes('Regression testing'), { timeout: 6000 })
ok('admin sees Add layer', (await bodyText()).includes('Add layer'))
ok('admin sees delete-layer buttons',
  await page.$('button[aria-label^="Delete "]') !== null)
await clickButton('Add layer')
ok('add-layer modal opens', (await bodyText()).includes('Add testing layer'))
await shot('f7_add_layer')
await page.keyboard.press('Escape')
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
await page.keyboard.press('Escape')
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
await goSettled(`${BASE}/apps/cellsens/layers/regression`)
await sleep(600)
await page.click('button[aria-label*="dark mode"]').catch(() => {})
await shot('f10_layer_dark')
ok('dark class applied', await page.evaluate(() => document.documentElement.classList.contains('dark')))
await page.click('button[aria-label*="light mode"]').catch(() => {})
await page.setViewport({ width: 390, height: 844 })
await goSettled(`${BASE}/apps/cellsens/layers/regression`)
await sleep(600)
const overflow = await page.evaluate(() => document.documentElement.scrollWidth)
ok('no horizontal overflow at 390px', overflow <= 392, `scrollWidth=${overflow}`)
await shot('f11_mobile')

} catch (err) {
  ok('script completed without crash', false, String(err).split('\n')[0])
} finally {
  await browser.close()
}
console.log(results.join('\n'))
const failed = results.some(r => r.startsWith('FAIL'))
console.log(failed ? 'RESULT: FAILURES PRESENT' : 'RESULT: ALL CHECKS PASS')
process.exit(failed ? 1 : 0)
