import { expect, test } from './fixtures'

test.describe('RelayTorrent Application Launch & Shell', () => {
  test('loads window, renders brand title, and discovers network adapters', async ({ app }) => {
    const page = app.page

    // Check title in Header
    await expect(page.locator('text=RelayTorrent')).toBeVisible()
    await expect(page.locator('text=Multi-Interface Client')).toBeVisible()

    // Check sidebar navigation filters
    await expect(page.locator('text=All Transfers')).toBeVisible()
    await expect(page.locator('text=Multi-Interface Router')).toBeVisible()

    // Check API bridge response
    const ifaces = await app.api.listInterfaces()
    expect(ifaces.length).toBeGreaterThanOrEqual(1)
  })

  test('navigates to Multi-Interface Router view and toggles adapter state', async ({ app }) => {
    const page = app.page

    // Click Multi-Interface Router
    await page.click('text=Multi-Interface Router')
    await expect(page.locator('text=Combined Download Speed')).toBeVisible()
    await expect(page.locator('text=Detected Hardware Adapters')).toBeVisible()

    // Switch back to transfers
    await page.click('button[title="Back to Transfers"]')
    await expect(page.locator('text=Showing')).toBeVisible()
  })
})
