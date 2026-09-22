import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] || 'http://127.0.0.1:4173/src/'
const output = process.argv[3] || 'captures/local-review'
mkdirSync('captures', { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
try {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${output}-hero.png` })
  await page.locator('#work').scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${output}-work.png` })
  await page.locator('#lab').scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${output}-lab.png` })
  console.log(JSON.stringify({ base, output, title: await page.title(), verify: await page.evaluate(() => window.__verify) }, null, 2))
} finally {
  await browser.close()
}
