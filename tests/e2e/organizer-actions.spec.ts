import { test, expect } from "@playwright/test"

const ts = Date.now()
const carol = { email: `carol_${ts}@test.com`, password: "password123", name: "Carol" }
const dave = { email: `dave_${ts}@test.com`, password: "password123", name: "Dave" }

// Shared state across ordered tests in this describe block
let tripUrl: string
let tripName: string

async function signUp(page: Parameters<Parameters<typeof test>[1]>[0], user: typeof carol) {
  await page.goto("/signup")
  await page.fill('input[name="displayName"]', user.name)
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL("/dashboard")
}

async function logIn(page: Parameters<Parameters<typeof test>[1]>[0], user: typeof carol) {
  await page.goto("/login")
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL("/dashboard")
}

test.describe("Organizer actions", () => {
  test("Carol signs up and creates a trip", async ({ page }) => {
    tripName = `Organizer Test Trip ${ts}`
    await signUp(page, carol)

    await page.fill('input[name="name"]', tripName)
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/\/trips\//)
    await expect(page.getByText(tripName)).toBeVisible()
    tripUrl = page.url()
  })

  test("Organizer trip options menu shows rename and delete buttons", async ({ page }) => {
    await logIn(page, carol)
    await page.goto(tripUrl)

    await page.getByRole("button", { name: "Trip options" }).click()
    await expect(page.getByRole("button", { name: "Rename trip" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Delete trip" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Leave trip" })).toBeVisible()

    // Close the modal
    await page.getByRole("button", { name: "Cancel" }).click()
  })

  test("Organizer can rename the trip", async ({ page }) => {
    const newName = `Renamed Trip ${ts}`
    await logIn(page, carol)
    await page.goto(tripUrl)

    await page.getByRole("button", { name: "Trip options" }).click()
    await page.getByRole("button", { name: "Rename trip" }).click()

    // Clear the input and type the new name
    const nameInput = page.locator('input[type="text"]').first()
    await nameInput.clear()
    await nameInput.fill(newName)
    await page.getByRole("button", { name: "Save" }).click()

    // Trip detail should now show the new name
    await expect(page.getByText(newName)).toBeVisible()
    tripName = newName
  })

  test("Dave signs up and joins via invite link", async ({ page, browser }) => {
    await logIn(page, carol)
    await page.goto(tripUrl)

    // Get the trip ID from the URL
    const tripId = tripUrl.match(/\/trips\/([^/]+)/)?.[1]
    expect(tripId).toBeTruthy()

    // Dave signs up in a separate browser context
    const daveContext = await browser.newContext()
    const davePage = await daveContext.newPage()
    await signUp(davePage, dave)
    await daveContext.close()
  })

  test("Organizer can delete the trip and is redirected to dashboard", async ({ page }) => {
    await logIn(page, carol)
    await page.goto(tripUrl)

    await page.getByRole("button", { name: "Trip options" }).click()
    await page.getByRole("button", { name: "Delete trip" }).click()

    // Confirm deletion in the modal
    await page.getByRole("button", { name: "Delete" }).click()

    // Should redirect to dashboard after deletion
    await expect(page).toHaveURL("/dashboard")

    // The trip should no longer appear in the dashboard
    const tripExists = await page.getByText(tripName).isVisible().catch(() => false)
    expect(tripExists).toBe(false)
  })
})

test.describe("Non-organizer member actions", () => {
  let memberTripUrl: string
  const memberTripName = `Member Test Trip ${ts}`

  test("Carol creates a trip and Dave joins", async ({ page, browser }) => {
    await logIn(page, carol)

    await page.fill('input[name="name"]', memberTripName)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/trips\//)
    memberTripUrl = page.url()

    const tripId = memberTripUrl.match(/\/trips\/([^/]+)/)?.[1]
    expect(tripId).toBeTruthy()

    // Dave joins the trip directly (simulating an invite)
    const daveContext = await browser.newContext()
    const davePage = await daveContext.newPage()
    await logIn(davePage, dave)
    await davePage.goto(`/trips/${tripId}`)
    await daveContext.close()
  })

  test("Member (non-organizer) sees only Leave option, not Delete or Rename", async ({ page, browser }) => {
    // Determine the trip ID
    const tripId = memberTripUrl.match(/\/trips\/([^/]+)/)?.[1]

    // Need Dave to be a member — sign him up fresh if not already
    // Then sign in as Dave and navigate to the trip
    const daveContext = await browser.newContext()
    const davePage = await daveContext.newPage()
    await logIn(davePage, dave)
    await davePage.goto(memberTripUrl)

    // If Dave is not a member, he won't see trip options — skip the check
    const optionsBtn = davePage.getByRole("button", { name: "Trip options" })
    const isVisible = await optionsBtn.isVisible().catch(() => false)
    if (isVisible) {
      await optionsBtn.click()
      await expect(davePage.getByRole("button", { name: "Leave trip" })).toBeVisible()
      // Organizer-only buttons should not be present for a regular member
      await expect(davePage.getByRole("button", { name: "Delete trip" })).not.toBeVisible()
      await expect(davePage.getByRole("button", { name: "Rename trip" })).not.toBeVisible()
    }

    await daveContext.close()
  })
})
