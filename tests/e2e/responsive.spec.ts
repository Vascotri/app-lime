import { test, expect } from '@playwright/test'

/**
 * Mobile responsive gate — 375px viewport.
 * Every key route must FIT A PHONE:
 *   1. no horizontal overflow (never scrolls sideways)
 *   2. every button/link stays fully on-screen
 *
 * The login page is tested unauthenticated (no session needed).
 * The dashboard requires auth so we only check the login page here;
 * add authenticated routes once Playwright auth helpers are wired up.
 */
const ROUTES = ['/login']

for (const path of ROUTES) {
  test(`no horizontal overflow at phone width: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' })
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(
      scrollWidth,
      `${path} scrolls horizontally on mobile (content ${scrollWidth}px > viewport ${clientWidth}px). ` +
        'Common causes: a fixed/explicit width, a non-wrapping string, or a content-sized grid track.',
    ).toBeLessThanOrEqual(clientWidth + 1)
  })

  test(`interactive elements stay within the viewport: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' })
    const vw = page.viewportSize()!.width
    const offenders = await page.evaluate((vw) => {
      const bad: string[] = []
      for (const el of Array.from(document.querySelectorAll("button, a, [role='button']"))) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) continue
        if (r.right > vw + 1 || r.left < -1) {
          bad.push((el.textContent || el.tagName).trim().slice(0, 40) || '<unlabeled>')
        }
      }
      return bad
    }, vw)
    expect(offenders, `Spilling outside the phone viewport: ${offenders.join(', ')}`).toEqual([])
  })
}
