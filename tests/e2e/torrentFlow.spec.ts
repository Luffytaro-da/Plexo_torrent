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

  test('switches settings sections, applies changes, and resets a section', async ({ app }) => {
    const page = app.page

    await page.click('button[title="Preferences"]')
    await expect(page.locator('text=Preferences & Settings')).toBeVisible()

    // Switch to Appearance section
    await page.click('button:has-text("Appearance")')
    await expect(page.locator('text=Color Theme')).toBeVisible()
    await expect(page.locator('text=Interface Density')).toBeVisible()

    // Switch to Connection section
    await page.click('button:has-text("Connection")')
    await expect(page.locator('text=Incoming Peer Port')).toBeVisible()
    await expect(page.locator('text=Peer Connection Limits')).toBeVisible()

    // Switch to Diagnostics section
    await page.click('button:has-text("Diagnostics")')
    await expect(page.locator('text=Telemetry & Diagnostic Tracking')).toBeVisible()

    // Apply changes
    await page.click('button:has-text("Apply")')
    await expect(page.locator('text=Applied')).toBeVisible()

    // Reset section
    await page.click('button:has-text("Reset Section")')

    // Close modal
    await page.click('button:has-text("OK")')
    await expect(page.locator('text=Preferences & Settings')).not.toBeVisible()
  })

  test('applies theme selection, persists across modal reopen, and transforms document', async ({
    app
  }) => {
    const page = app.page

    await page.click('button[title="Preferences"]')
    await expect(page.locator('text=Preferences & Settings')).toBeVisible()

    // Switch to Appearance section
    await page.click('button:has-text("Appearance")')
    await expect(page.locator('text=Color Theme')).toBeVisible()

    // Select Light theme
    await page.selectOption('select:has-text("Dark (Navy / Default)")', 'light')

    // Document root must immediately have theme-light class
    const hasLightClass = await page.evaluate(() =>
      document.documentElement.classList.contains('theme-light')
    )
    expect(hasLightClass).toBe(true)

    // Click Apply
    await page.click('button:has-text("Apply")')
    await expect(page.locator('text=Applied')).toBeVisible()

    // Close modal with X
    await page.click('button[title="Close"]')
    await expect(page.locator('text=Preferences & Settings')).not.toBeVisible()

    // Root should still have theme-light
    const stillLight = await page.evaluate(() =>
      document.documentElement.classList.contains('theme-light')
    )
    expect(stillLight).toBe(true)

    // Reopen modal and verify form retained Light theme
    await page.click('button[title="Preferences"]')
    await expect(page.locator('text=Preferences & Settings')).toBeVisible()
    await page.click('button:has-text("Appearance")')

    const selectedTheme = await page.inputValue('select:has-text("Light")')
    expect(selectedTheme).toBe('light')

    // Reset back to Dark and close
    await page.click('button:has-text("Reset Section")')
    await page.click('button:has-text("OK")')
  })
})
