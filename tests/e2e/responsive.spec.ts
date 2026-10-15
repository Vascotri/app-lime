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
      options: ['Groceries', 'Home', 'Kids', 'Pharmacy', 'Gifts', 'Dog', 'Other'],
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

      /*
       * Every input must be reachable by its visible name. These labels sat
       * beside their controls with nothing connecting them, so a screen reader
       * announced "edit text, blank" for the whole form.
       */
      const unlabelled = await dialog.evaluate((root) => {
        const bad: string[] = []
        for (const field of Array.from(root.querySelectorAll('input, select, textarea'))) {
          const id = field.getAttribute('id')
          const named =
            (id && root.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
            field.getAttribute('aria-label') ||
            field.closest('label')
          if (!named) bad.push(field.getAttribute('type') ?? field.tagName.toLowerCase())
        }
        return bad
      })
      expect(unlabelled, `unlabelled controls in the ${modal.name} modal`).toEqual([])

      await assertNoHorizontalOverflow(page, `/ (${modal.name} modal)`)
      await assertControlsOnScreen(page)

      // The dialog itself must not exceed the viewport.
      const box = await dialog.boundingBox()
      expect(box!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
    })
  }

  /**
   * The connect prompt depends on a Google API call the test environment
   * cannot make, so stub the status endpoint and drive each state directly.
   */
  test.describe('Google Calendar connect prompt', () => {
    async function stubStatus(page: Page, body: unknown, status = 200) {
      await page.route('**/api/google/status', (route) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        }),
      )
    }

    test('invites a first connection', async ({ page }) => {
      await stubStatus(page, { connected: false, reason: 'not_connected' })
      await page.goto('/', { waitUntil: 'networkidle' })

      await expect(page.getByText('Connect Google Calendar')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible()
      // The access promise is load-bearing for trust — it must not go missing.
      await expect(page.getByText(/only see the family calendar it creates/i)).toBeVisible()

      await assertNoHorizontalOverflow(page, '/ (connect prompt)')
      await assertControlsOnScreen(page)
    })

    test('asks an older session to re-consent', async ({ page }) => {
      // Signed in before the calendar scopes existed: a session is present but
      // unusable, and the wording has to explain why rather than just repeat
      // the first-run invitation.
      await stubStatus(page, { connected: false, reason: 'missing_scopes' })
      await page.goto('/', { waitUntil: 'networkidle' })

      await expect(page.getByText('Reconnect Google Calendar')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Reconnect' })).toBeVisible()
    })

    test('stays out of the way once connected', async ({ page }) => {
      await stubStatus(page, { connected: true, calendarId: 'family@group.calendar.google.com' })
      await page.goto('/', { waitUntil: 'networkidle' })

      await expect(page.getByText(/connect google calendar/i)).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible()
    })

    test('does not cry wolf when the status check itself fails', async ({ page }) => {
      // A broken status endpoint says nothing about whether the calendar works,
      // so it must not push a connect prompt at someone already connected.
      await stubStatus(page, { error: 'boom' }, 500)
      await page.goto('/', { waitUntil: 'networkidle' })

      await expect(page.getByText(/connect google calendar/i)).toHaveCount(0)
    })
  })

  /**
   * Reading events from Google introduces failure modes Supabase never had.
   * The one that matters is that none of them may look like "nothing on."
   */
  test.describe('calendar failure states', () => {
    async function stubEvents(page: Page, status: number, body: unknown) {
      await page.route('**/api/events', (route) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        }),
      )
    }

    test('an expired Google grant offers a reconnect, not an empty calendar', async ({ page }) => {
      await stubEvents(page, 409, { error: 'reconnect_required' })
      await page.goto('/', { waitUntil: 'networkidle' })

      await expect(page.getByText(/needs reconnecting/i)).toBeVisible()
      await expect(page.getByText(/your events are safe/i)).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Reconnect' }),
        'an expired grant must be recoverable from the panel itself',
      ).toBeVisible()

      // The lie we are guarding against.
      await expect(page.getByText(/no events in the next 14 days/i)).toHaveCount(0)
    })

    test('an unreachable calendar offers a retry, not an empty calendar', async ({ page }) => {
      await stubEvents(page, 502, { error: 'calendar_unavailable' })
      await page.goto('/', { waitUntil: 'networkidle' })

      await expect(page.getByText(/couldn't load your calendar/i)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
      await expect(page.getByText(/no events in the next 14 days/i)).toHaveCount(0)
    })

    test('a genuinely empty calendar still says so', async ({ page }) => {
      // The counterpart: the empty state must survive, or the error state has
      // simply replaced one wrong message with another.
      await stubEvents(page, 200, [])
      await page.goto('/', { waitUntil: 'networkidle' })

      await expect(page.getByText(/no events in the next 14 days/i)).toBeVisible()
      await expect(page.getByText(/couldn't load your calendar/i)).toHaveCount(0)
    })

    test('a personal event offers no edit or delete the app cannot perform', async ({ page }) => {
      // Read scope only on personal calendars, so the row must not pretend.
      await stubEvents(page, 200, [
        {
          id: 'personal-1',
          title: 'Dentist',
          start_at: '2099-01-01T09:00:00.000Z',
          end_at: null,
          all_day: false,
          recurrence: 'none',
          category: 'other',
          attendees: 'jennifer',
          notes: null,
          created_by: '',
          created_at: '2099-01-01T09:00:00.000Z',
          origin: 'personal',
        },
      ])
      await page.goto('/', { waitUntil: 'networkidle' })

      await expect(page.getByText('Dentist')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Delete event' })).toHaveCount(0)
    })

    test("the other person's private event shows as Busy only", async ({ page }) => {
      await stubEvents(page, 200, [
        {
          id: 'private-1',
          title: 'Busy',
          start_at: '2099-01-01T09:00:00.000Z',
          end_at: null,
          all_day: false,
          recurrence: 'none',
          category: 'other',
          attendees: 'jennifer',
          notes: null,
          created_by: '',
          created_at: '2099-01-01T09:00:00.000Z',
          origin: 'personal',
          busy: true,
        },
      ])
      await page.goto('/', { waitUntil: 'networkidle' })

      await expect(page.getByText('Busy')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Delete event' })).toHaveCount(0)
    })

    test('the error state fits the phone', async ({ page }) => {
      await stubEvents(page, 409, { error: 'reconnect_required' })
      await page.goto('/', { waitUntil: 'networkidle' })
      await assertNoHorizontalOverflow(page, '/ (calendar error)')
      await assertControlsOnScreen(page)
    })
  })

  test('a new event is sent as wall-clock time, not a UTC instant', async ({ page }) => {
    /*
     * Regression: the form used to stamp a "Z" onto the time typed, so 09:00
     * was saved as 09:00 UTC — an hour out in Lisbon, and wrong by a varying
     * amount anywhere else. It must send the time as typed.
     */
    await page.goto('/', { waitUntil: 'networkidle' })

    let body: Record<string, unknown> | undefined
    await page.route('**/api/events', async (route) => {
      if (route.request().method() === 'POST') {
        body = route.request().postDataJSON()
        return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.getByRole('button', { name: 'Add event' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('e.g. Dinner with family').fill('Swimming')
    await dialog.getByRole('button', { name: 'Jennifer', exact: true }).click()
    await dialog.getByRole('button', { name: 'Kids', exact: true }).click()
    await dialog.getByRole('button', { name: 'Add event' }).click()

    await expect.poll(() => body?.title).toBe('Swimming')
    expect(body!.start_local, 'wall-clock time must not carry a Z').not.toContain('Z')
    expect(body!.start_local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
    expect(body!.attendees).toBe('jennifer')
    expect(body!.category).toBe('kids')
  })

  test('one occurrence of a series cannot pretend to edit the rule', async ({ page }) => {
    await page.route('**/api/events', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'inst-1',
            title: 'School run',
            start_at: '2099-01-01T08:30:00.000Z',
            end_at: null,
            all_day: false,
            recurrence: 'none',
            recurring: true,
            category: 'kids',
            attendees: 'vasco',
            notes: null,
            created_by: '',
            created_at: '2099-01-01T08:30:00.000Z',
            origin: 'family',
          },
        ]),
      }),
    )
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByText('School run').click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/changes apply to this date only/i)).toBeVisible()
    await expect(dialog.getByLabel('Repeat')).toBeDisabled()
  })

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
