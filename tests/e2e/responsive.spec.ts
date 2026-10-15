import { test, expect, type Page } from '@playwright/test'
import { sessionCookie } from './session'

/**
 * Mobile responsive gate — 375px viewport.
 *   1. no horizontal overflow (the page never scrolls sideways)
 *   2. every button/link stays fully on-screen
 *   3. the dashboard doesn't reserve screens of empty space
 */

async function assertNoHorizontalOverflow(page: Page, path: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(
    scrollWidth,
    `${path} scrolls horizontally on mobile (content ${scrollWidth}px > viewport ${clientWidth}px). ` +
      'Common causes: a fixed width, a non-wrapping string, or a content-sized grid track.',
  ).toBeLessThanOrEqual(clientWidth + 1)
}

async function assertControlsOnScreen(page: Page) {
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
}

test.describe('signed out', () => {
  test('login page fits the phone', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' })
    await assertNoHorizontalOverflow(page, '/login')
    await assertControlsOnScreen(page)
  })

  test('the dashboard is not reachable without a session', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('signed in', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([await sessionCookie()])
  })

  test('dashboard fits the phone', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    // All three panels rendered, so the assertions below cover the real layout.
    await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Shopping' })).toBeVisible()

    await assertNoHorizontalOverflow(page, '/')
    await assertControlsOnScreen(page)
  })

  test('empty panels do not reserve screens of blank space', async ({ page }) => {
    // Regression: each panel carried a fixed min-height of ~60dvh, so three
    // empty panels stacked to roughly two phone screens of mostly nothing.
    // With no data they should now hug their content and fit about one screen.
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Shopping' })).toBeVisible()

    const viewportHeight = page.viewportSize()!.height
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight)

    expect(
      scrollHeight,
      `Empty dashboard is ${scrollHeight}px tall against a ${viewportHeight}px viewport ` +
        `(${(scrollHeight / viewportHeight).toFixed(2)} screens). Panels are reserving height ` +
        'they are not using — check for a min-height applied below the lg breakpoint.',
    ).toBeLessThanOrEqual(viewportHeight * 1.25)
  })

  test('each panel keeps its add control reachable', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    for (const label of ['Add event', 'Add task', 'Add item']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible()
    }
  })

  /**
   * Modals are the densest screens in the app and the likeliest to overflow a
   * phone — the event form now carries attendees, category and recurrence on
   * top of the original fields.
   */
  const modals = [
    {
      name: 'event',
      open: 'Add event',
      heading: 'New event',
      options: ['Vasco', 'Jennifer', 'Both', 'Home', 'Kids', 'Personal', 'Work', 'Other'],
    },
    {
      name: 'task',
      open: 'Add task',
      heading: 'New task',
      options: ['Vasco', 'Jennifer', 'Both', 'Home', 'Kids', 'Personal', 'Car', 'Dog', 'Travel', 'Gifts', 'Other'],
    },
    {
      name: 'item',
      open: 'Add item',
      heading: 'Add item',
      options: ['Groceries', 'Home', 'Kids', 'Other'],
    },
  ]

  for (const modal of modals) {
    test(`${modal.name} modal fits the phone and offers every option`, async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: modal.open }).click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(page.getByRole('heading', { name: modal.heading })).toBeVisible()

      for (const option of modal.options) {
        await expect(
          dialog.getByRole('button', { name: option, exact: true }),
          `${modal.name} modal is missing the "${option}" option`,
        ).toBeVisible()
      }

      await assertNoHorizontalOverflow(page, `/ (${modal.name} modal)`)
      await assertControlsOnScreen(page)

      // The dialog itself must not exceed the viewport.
      const box = await dialog.boundingBox()
      expect(box!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
    })
  }

  test('a picker records the selection it was given', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Add task' }).click()

    const dialog = page.getByRole('dialog')
    const travel = dialog.getByRole('button', { name: 'Travel', exact: true })

    await expect(travel).toHaveAttribute('aria-pressed', 'false')
    await travel.click()
    await expect(travel).toHaveAttribute('aria-pressed', 'true')

    // Selecting one option clears the previous one.
    const car = dialog.getByRole('button', { name: 'Car', exact: true })
    await car.click()
    await expect(car).toHaveAttribute('aria-pressed', 'true')
    await expect(travel).toHaveAttribute('aria-pressed', 'false')
  })
})
