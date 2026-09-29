import { expect, test } from './fixtures'

test.describe('RelayTorrent Torrent Workflows', () => {
  test('opens and closes Add Torrent modal', async ({ app }) => {
    const page = app.page

    await page.click('button:has-text("Add Torrent")')
    await expect(page.locator('text=Add New Torrent')).toBeVisible()
    await expect(page.locator('button:has-text("Magnet Link")')).toBeVisible()
    await expect(page.locator('button:has-text(".torrent File")')).toBeVisible()

    await page.click('button:has-text("Cancel")')
    await expect(page.locator('text=Add New Torrent')).not.toBeVisible()
  })

  test('opens and updates Preferences / Settings modal', async ({ app }) => {
    const page = app.page

    await page.click('button[title="Preferences"]')
    await expect(page.locator('text=Preferences & Settings')).toBeVisible()
    await expect(page.locator('text=Default Download Directory')).toBeVisible()

    await page.click('button:has-text("Cancel")')
    await expect(page.locator('text=Preferences & Settings')).not.toBeVisible()
  })
})
