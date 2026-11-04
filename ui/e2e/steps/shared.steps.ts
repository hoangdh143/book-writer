import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createBdd } from 'playwright-bdd'
import { test } from './fixtures'
import {
  chapterReviewBook,
  chapterTextV1,
  completedBook,
  listItemFor,
  makeBook,
  planningBook,
  titleOf,
  tocReviewBook,
} from '../helpers/books'
import { mockBookApi, mockChapterActions, mockTocActions } from '../helpers/mocks'

export const { Given, When, Then } = createBdd(test)

const openFromList = async (page: Page, name: string): Promise<void> => {
  await page.goto('/')
  await page.getByRole('button', { name }).click()
}

// ---- background / setup ------------------------------------------------------

Given('the book API is mocked', async ({ page, world }) => {
  await mockBookApi(page, world)
  await page.goto('/')
})

Given('the server rejects book creation with {string}', async ({ world }, message) => {
  world.createError = message
})

Given('a book waiting for TOC review is open', async ({ page, world }) => {
  world.listItem = listItemFor(tocReviewBook)
  world.detailQueue = [tocReviewBook]
  await mockBookApi(page, world)
  await mockTocActions(page, world)
  await openFromList(page, titleOf(tocReviewBook))
})

Given('a book with chapter 2 awaiting review is open', async ({ page, world }) => {
  world.listItem = listItemFor(chapterReviewBook)
  world.detailQueue = [chapterReviewBook]
  world.chapterText = chapterTextV1
  await mockBookApi(page, world)
  await mockChapterActions(page, world)
  await openFromList(page, titleOf(chapterReviewBook))
})

Given('a completed book is open', async ({ page, world }) => {
  world.listItem = listItemFor(completedBook)
  world.detailQueue = [completedBook]
  await mockBookApi(page, world)
  await openFromList(page, titleOf(completedBook))
})

Given('the book detail endpoint fails', async ({ page, world }) => {
  world.listItem = listItemFor(planningBook)
  world.detailStatus = 500
  world.detailError = 'database on fire'
  await mockBookApi(page, world)
})

Given('the book detail endpoint returns not found', async ({ page, world }) => {
  world.listItem = listItemFor(planningBook)
  world.detailStatus = 404
  world.detailError = 'no book with id b1'
  await mockBookApi(page, world)
})

Given('the book reports status {string}', async ({ page, world }, status) => {
  const book = makeBook({ status })
  world.listItem = listItemFor(book)
  world.detailQueue = [book]
  await mockBookApi(page, world)
})

Given('the book endpoint is offline', async ({ page, world }) => {
  world.listItem = listItemFor(planningBook)
  world.offline = true
  await mockBookApi(page, world)
})

// ---- actions -----------------------------------------------------------------

When('the user writes the idea {string}', async ({ page }, idea) => {
  await page.getByPlaceholder('A cozy mystery set in a lighthouse village…').fill(idea)
})

When('the user sets chapters to {int} and words per chapter to {int}', async ({ page }, chapters, words) => {
  await page.getByLabel('Chapters').fill(String(chapters))
  await page.getByLabel('Words / chapter').fill(String(words))
})

When('the user selects the model {string}', async ({ page }, label) => {
  await page.getByLabel('Model', { exact: true }).click()
  await page.getByRole('option', { name: label }).click()
})

When('the user opens settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click()
})

When('the user saves the OpenRouter API key {string}', async ({ page }, key) => {
  await page.getByLabel('OpenRouter API key').fill(key)
})

When('the user clicks {string}', async ({ page }, name) => {
  await page.getByRole('button', { name }).click()
})

When('the user sets the outline title to {string}', async ({ page }, title) => {
  await page.getByLabel('Title', { exact: true }).fill(title)
})

When('the user writes the review comment {string}', async ({ page }, comment) => {
  await page.getByLabel(/Comment \(/).fill(comment)
})

When('a book is selected', async ({ page }) => {
  await openFromList(page, titleOf(planningBook))
})

When('the book is open', async ({ page }) => {
  await openFromList(page, titleOf(planningBook))
})

When('the user retries after the endpoint recovers', async ({ page, world }) => {
  world.offline = false
  world.detailStatus = 200
  world.detailQueue = [planningBook]
  await page.getByRole('button', { name: 'Try again' }).click()
})

When('the endpoint comes back', async ({ world }) => {
  world.offline = false
  world.detailStatus = 200
  world.detailQueue = [planningBook]
})

When('the server goes offline', async ({ world }) => {
  world.offline = true
})

When('the user reloads the page', async ({ page }) => {
  await page.reload()
})

When('the user downloads the export in format {string}', async ({ page, world }, label) => {
  await page.getByLabel('Format').selectOption({ label })
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download' }).click()
  world.download = await downloadPromise
})

// ---- outcomes ----------------------------------------------------------------

Then('the create request has model {string} and base url {string}', async ({ world }, model, baseUrl) => {
  expect(world.createBook?.['model']).toBe(model)
  expect(world.createBook?.['baseUrl']).toBe(baseUrl)
})

Then('the create request has api key {string}', async ({ world }, apiKey) => {
  expect(world.createBook?.['apiKey']).toBe(apiKey)
})

Then('the book appears in the list', async ({ page }) => {
  await expect(page.locator('nav').getByText('A heist on a floating city')).toBeVisible()
})

Then('the panel shows a planning book', async ({ page }) => {
  await expect(page.getByText('Planning the book')).toBeVisible()
})

Then('the form shows the error {string}', async ({ page }, message) => {
  await expect(page.getByText(message)).toBeVisible()
})

Then('an error toast contains {string}', async ({ page }, fragment) => {
  await expect(page.getByRole('alert').filter({ hasText: fragment })).toBeVisible()
})

Then('the TOC approve request has mode {string}, comment {string} and title {string}', async ({ world }, mode, comment, title) => {
  const body = world.tocApprove as { mode?: string; comment?: string; edits?: { title?: string } }
  expect(body.mode).toBe(mode)
  expect(body.comment).toBe(comment)
  expect(body.edits?.title).toBe(title)
})

Then('the book enters generation', async ({ page }) => {
  await expect(page.getByText('Generating')).toBeVisible()
})

Then('the {string} button is disabled', async ({ page }, name) => {
  await expect(page.getByRole('button', { name })).toBeDisabled()
})

Then('the TOC revise request has comment {string}', async ({ world }, comment) => {
  expect((world.tocRevise as { comment?: string }).comment).toBe(comment)
})

Then('a fresh outline arrives', async ({ page }) => {
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('The Floating Heist v2')
})

Then('the chapter approve request has comment {string}', async ({ world }, comment) => {
  expect((world.chapterApprove as { comment?: string }).comment).toBe(comment)
})

Then('the approve-rest request has no comment', async ({ world }) => {
  expect(world.approveRest).toEqual({})
})

Then('the chapter revise request has comment {string}', async ({ world }, comment) => {
  expect((world.chapterRevise as { comment?: string }).comment).toBe(comment)
})

Then('the chapter text becomes {string}', async ({ page }, text) => {
  await expect(page.getByText(text)).toBeVisible()
})

Then('the downloaded file is named {string}', async ({ world }, name) => {
  expect(world.download?.suggestedFilename()).toBe(name)
})

Then('the file contains {string}', async ({ world }, fragment) => {
  const download = world.download
  expect(download).toBeDefined()
  const path = (await download!.path()) as string
  expect(await readFile(path, 'utf8')).toContain(fragment)
})

Then('the file does not contain {string}', async ({ world }, fragment) => {
  const download = world.download
  expect(download).toBeDefined()
  const path = (await download!.path()) as string
  expect(await readFile(path, 'utf8')).not.toContain(fragment)
})

Then('the error panel {string} is visible', async ({ page }, title) => {
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
})

Then('the book renders normally', async ({ page }) => {
  await expect(page.getByText('Planning the book')).toBeVisible()
})

Then('the empty state is visible', async ({ page }) => {
  await expect(page.getByText('Create a book to start the pipeline.')).toBeVisible()
})

Then('the fallback shows {string}', async ({ page }, text) => {
  await expect(page.getByText(text)).toBeVisible()
})

Then('the error explains {string}', async ({ page }, fragment) => {
  await expect(page.getByText(fragment)).toBeVisible()
})

Then('the saved-copy banner is visible', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Reconnecting — showing your saved copy' })).toBeVisible()
})

Then('the book shows a completed view', async ({ page }) => {
  await expect(page.getByText('Book complete')).toBeVisible()
})
