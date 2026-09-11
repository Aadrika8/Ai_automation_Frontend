/* Does the reworked Testing Layers page render, and does the pyramid match the data?
   Usage: node scripts/check-layers-page.mjs  (dev server on 5173, API on 8000) */
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'

const BASE = 'http://localhost:5173'
const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA &&
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
].filter(Boolean).find(p => existsSync(p))
if (!CHROME) { console.error('No Chrome found'); process.exit(2) }

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1100 })
const sleep = ms => new Promise(r => setTimeout(r, ms))

const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
await page.type('input[autocomplete="username"]', 'admin')
await page.type('input[type="password"]', 'admin123')
await page.click('button[type="submit"]')
await sleep(1500)

await page.goto(`${BASE}/apps/cellsens?release=4-5-1`, { waitUntil: 'networkidle2' })
await sleep(2500)

const text = await page.evaluate(() => document.body.innerText)
const svg = await page.evaluate(() => {
  const s = document.querySelector('svg[role="img"]')
  if (!s) return null
  return {
    label: s.getAttribute('aria-label'),
    tiers: [...s.querySelectorAll('polygon')].length,
    labels: [...s.querySelectorAll('text')].map(t => t.textContent.trim()),
  }
})

console.log('page errors      :', errors.length ? errors.slice(0, 3) : 'none')
console.log('strip shows      :',
  ['2 pyramid violations', '53.8%', '77.8%', 'not measured', 'Workbooks matched']
    .map(t => `${t}=${text.includes(t)}`).join('  '))
console.log('source line      :', text.includes('no unit.xlsx') ? 'names the missing workbook' : 'MISSING')
console.log('pyramid svg      :', svg ? `${svg.tiers} tiers` : 'NOT RENDERED')
if (svg) {
  console.log('  aria           :', svg.label)
  console.log('  tier labels    :', svg.labels.join(' | '))
}
console.log('old banner gone  :', !text.includes('Testing Pyramid Status'))
console.log('layer cards      :', text.includes('Regression Testing') && text.includes('Acceptance Testing'))

// how far down the page does the first layer card start?
const firstCardTop = await page.evaluate(() => {
  const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Unit Testing'))
  return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null
})
console.log('first layer card :', firstCardTop, 'px from the top')

await page.screenshot({ path: 'scripts/layers-page.png', fullPage: false })
await browser.close()
