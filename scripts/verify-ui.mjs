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
await shot('f2_apps')
await goSettled(`${BASE}/apps/cellsens/pyramid`)
await shot('f3_pyramid')
await goSettled(`${BASE}/apps/cellsens/unit`)
await page.waitForFunction(() => document.body.innerText.includes('Pass-rate trend'), { timeout: 6000 })
text = await bodyText()
ok('manager dashboard has no drill-down link', !text.includes('View test cases'))
await shot('f4_dashboard_manager')
await goSettled(`${BASE}/runs`)
ok('manager blocked from /runs', (await path()) === '/apps')
await goSettled(`${BASE}/settings`)
ok('manager blocked from /settings', (await path()) === '/apps')
await goSettled(`${BASE}/apps/cellsens/unit/tests`)
ok('manager blocked from tests drill-down', (await path()) === '/apps')

/* ---- QA ---- */
await login('qa', 'qa123')
ok('qa login lands on /apps', (await path()) === '/apps')
await goSettled(`${BASE}/apps/cellsens/unit`)
await page.waitForFunction(() => document.body.innerText.includes('Pass-rate trend'), { timeout: 6000 })
ok('qa dashboard shows drill-down', (await bodyText()).includes('View test cases'))
await goSettled(`${BASE}/apps/cellsens/unit/tests?status=Failed`)
await page.waitForSelector('table a', { visible: true, timeout: 6000 })
await shot('f5_tests_failed')
const testHref = await page.$eval('table a', a => a.getAttribute('href'))
await goSettled(`${BASE}${testHref}`)
await page.waitForFunction(() => document.body.innerText.includes('Run history'), { timeout: 6000 })
text = await bodyText()
ok('test detail shows failure + stack trace',
  text.includes('Failure details') && text.includes('Traceback (most recent call last)') && text.includes('Failing step'))
await shot('f6_test_detail')
await goSettled(`${BASE}/runs`)
ok('qa can open /runs', (await path()) === '/runs')
await shot('f7_runs')
await goSettled(`${BASE}/settings`)
ok('qa blocked from /settings', (await path()) === '/apps')

/* ---- ADMIN ---- */
await login('admin', 'admin123')
ok('admin login lands on /apps', (await path()) === '/apps')
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
await goSettled(`${BASE}/runs`)
ok('logged-out deep link bounces to /login', (await path()) === '/login')
await fillViaChip('qa')
await page.evaluate(() => document.querySelector('form')?.requestSubmit())
await page.waitForFunction(() => location.pathname !== '/login', { timeout: 6000 }).catch(() => {})
ok('post-login returns to deep link /runs', (await path()) === '/runs')
await page.reload({ waitUntil: 'networkidle0' })
await sleep(600)
ok('session survives reload', (await path()) === '/runs')

/* ---- dark mode + mobile ---- */
await goSettled(`${BASE}/apps/cellsens/unit`)
await page.waitForFunction(() => document.body.innerText.includes('Pass-rate trend'), { timeout: 6000 })
await page.click('button[aria-label*="dark mode"]').catch(() => {})
await shot('f10_dashboard_dark')
ok('dark class applied', await page.evaluate(() => document.documentElement.classList.contains('dark')))
await page.click('button[aria-label*="light mode"]').catch(() => {})
await page.setViewport({ width: 390, height: 844 })
await goSettled(`${BASE}/apps/cellsens/unit`)
await page.waitForFunction(() => document.body.innerText.includes('Pass-rate trend'), { timeout: 6000 })
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
