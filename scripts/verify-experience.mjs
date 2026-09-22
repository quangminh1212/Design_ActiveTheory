import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

const serve = createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html'
    const file = normalize(join(ROOT, pathname))
    if (!file.startsWith(ROOT)) return response.writeHead(403).end('forbidden')
    const info = await stat(file)
    if (!info.isFile()) return response.writeHead(404).end('not found')
    const body = await readFile(file)
    response.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'content-length': body.length })
    response.end(body)
  } catch {
    response.writeHead(404).end('not found')
  }
})

const errors = []
const failures = []
const checks = []
const assert = (condition, message) => {
  checks.push({ ok: Boolean(condition), message })
  if (!condition) throw new Error(message)
}

console.log('starting verify server')
await new Promise((resolveServer) => serve.listen(0, '127.0.0.1', resolveServer))
const address = serve.address()
const baseUrl = `http://127.0.0.1:${address.port}/src/`
console.log(`verify server: ${baseUrl}`)
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu-sandbox'] })
console.log('browser launched')

try {
  const rootPage = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 })
  await rootPage.goto(baseUrl.replace('/src/', '/'), { waitUntil: 'domcontentloaded' })
  await rootPage.waitForURL('**/src/', { timeout: 5000 })
  assert(rootPage.url().endsWith('/src/'), 'root entry redirects to /src/')
  await rootPage.close()

  for (const viewport of [{ width: 1440, height: 900, name: 'desktop' }, { width: 390, height: 844, name: 'mobile' }]) {
    console.log(`checking ${viewport.name}`)
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 })
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`${viewport.name}: ${message.text()}`) })
    page.on('pageerror', (error) => errors.push(`${viewport.name}: ${error.message}`))
    page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`) })

    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    console.log(`${viewport.name}: loaded`)
    await page.waitForTimeout(250)
    const verify = await page.evaluate(() => window.__verify)
    assert(verify?.ready === true, `${viewport.name}: runtime verify hook is ready`)
    assert(verify?.canvas === true, `${viewport.name}: canvas initialized`)
    assert(await page.locator('h1').isVisible(), `${viewport.name}: hero heading is visible`)
    assert(await page.locator('#about').count() === 1 && await page.locator('#work').count() === 1, `${viewport.name}: primary sections exist`)

    await page.locator('.about-copy a[href="#work"]').click()
    await page.waitForTimeout(650)
    console.log(`${viewport.name}: navigated`)
    assert(await page.locator('#work').evaluate((node) => node.getBoundingClientRect().top < window.innerHeight), `${viewport.name}: smooth navigation reaches work`)

    await page.locator('[data-project="museum"]').click()
    console.log(`${viewport.name}: project clicked`)
    assert(await page.locator('#project-dialog').evaluate((node) => node.open), `${viewport.name}: project dialog opens`)
    assert((await page.locator('#dialog-description').textContent()).length > 20, `${viewport.name}: project dialog is populated`)
    await page.locator('.dialog-close').click()

    if (viewport.name === 'mobile') {
      await page.locator('.menu-toggle').click()
      assert(await page.locator('.menu-toggle').getAttribute('aria-expanded') === 'true', 'mobile: menu opens')
      await page.waitForTimeout(350)
      const menuState = await page.locator('#primary-nav').evaluate((node) => ({ opacity: getComputedStyle(node).opacity, pointerEvents: getComputedStyle(node).pointerEvents, parent: node.parentElement.className }))
      console.log('mobile menu state', menuState)
      assert(menuState.opacity === '1' && menuState.pointerEvents === 'auto', 'mobile: menu is visible')
    }
    await page.close()
    console.log(`${viewport.name}: closed`)
  }
  assert(errors.length === 0, `browser console has no errors (${errors.join('; ')})`)
  assert(failures.length === 0, `all local requests succeed (${failures.join('; ')})`)
  console.log(JSON.stringify({ baseUrl, checks, errors, failures }, null, 2))
} finally {
  await browser.close()
  await new Promise((resolveServer) => serve.close(resolveServer))
}
