import { test, expect } from "@playwright/test";

/**
 * The mobile bar. Every key route must FIT A PHONE:
 *   1. no horizontal overflow (the page never scrolls sideways), and
 *   2. every button/link stays fully on-screen.
 *
 * Add each new user-facing route to ROUTES as the app grows — overlays/modals included (drive the
 * app to the state that shows them, then assert). This is the regression net for the whole class of
 * "cut off / not centered on mobile" bugs.
 */
const ROUTES = ["/"];

for (const path of ROUTES) {
  test(`no horizontal overflow at phone width: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      scrollWidth,
      `${path} scrolls horizontally on mobile (content ${scrollWidth}px > viewport ${clientWidth}px). ` +
        "Common causes: a fixed/explicit width, a non-wrapping string (long URL, email, code), or a " +
        "content-sized grid/flex track. Fix with max-width:100%, min-width:0, overflow-wrap:anywhere, " +
        "or grid-template-columns:minmax(0,1fr) — never a magic pixel width.",
    ).toBeLessThanOrEqual(clientWidth + 1); // +1 absorbs sub-pixel rounding
  });

  test(`interactive elements stay within the viewport: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const vw = page.viewportSize()!.width;
    const offenders = await page.evaluate((vw) => {
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll("button, a, [role='button']"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue; // skip hidden
        if (r.right > vw + 1 || r.left < -1) {
          bad.push((el.textContent || el.tagName).trim().slice(0, 40) || "<unlabeled>");
        }
      }
      return bad;
    }, vw);
    expect(offenders, `Spilling outside the phone viewport: ${offenders.join(", ")}`).toEqual([]);
  });
}
