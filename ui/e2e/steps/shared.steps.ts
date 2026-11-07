import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createBdd } from 'playwright-bdd'
import { test } from './fixtures'
import {
  chapterReviewBook,
  bibleBook,
  chapterTextV1,
  completedBook,
  diagramBook,
  groupCheckingBook,
  groupWritingBook,
  listItemFor,
  makeBook,
  planningBook,
  preparingBook,
  titleOf,
  illustratedBook,
  illustratedSettingsBook,
  settingsBook,
  tocReviewBook,
} from '../helpers/books'
import { mockBookApi, mockChapterActions, mockTocActions } from '../helpers/mocks'
import type { Book } from '../../src/api/types'
import type { World } from '../helpers/world'

export const { Given, When, Then } = createBdd(test)

/** A select's label text includes its options, so fields match on how the label starts. */
const fieldNamed = (page: Page, label: string) =>
  page.getByLabel(new RegExp(`^${label.split(' (')[0]}`))

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

Given('a completed book using {string} at {string} is open', async ({ page, world }, model, baseUrl) => {
  const book = settingsBook(model, baseUrl)
  world.listItem = listItemFor(book)
  world.detailQueue = [book]
  await mockBookApi(page, world)
  await openFromList(page, titleOf(book))
})

Given('a completed book with a large illustration is open', async ({ page, world }) => {
  world.listItem = listItemFor(illustratedBook)
  world.detailQueue = [illustratedBook]
  await mockBookApi(page, world)
  await openFromList(page, titleOf(illustratedBook))
})

Given('a completed illustrated book is open', async ({ page, world }) => {
  const book = illustratedSettingsBook()
  world.listItem = listItemFor(book)
  world.detailQueue = [book]
  await mockBookApi(page, world)
  await openFromList(page, titleOf(book))
})

Given('OpenRouter image models cannot be loaded', async ({ world }) => {
  world.imageModelsFail = true
})

Given('a completed book with diagrams is open', async ({ page, world }) => {
  world.listItem = listItemFor(diagramBook)
  world.detailQueue = [diagramBook]
  await mockBookApi(page, world)
  await openFromList(page, titleOf(diagramBook))
})

Given('a book is writing chapters 3 to 5 together', async ({ page, world }) => {
  world.listItem = listItemFor(groupWritingBook)
  world.detailQueue = [groupWritingBook]
  await mockBookApi(page, world)
  await openFromList(page, titleOf(groupWritingBook))
})

const openGeneratingBook = async (page: Page, world: World, book: Book): Promise<void> => {
  world.listItem = listItemFor(book)
  world.detailQueue = [book]
  await mockBookApi(page, world)
  await openFromList(page, titleOf(book))
}

Given('a book is checking chapters 3 to 5', async ({ page, world }) => {
  await openGeneratingBook(page, world, groupCheckingBook)
})

Given('a book is preparing its story bible', async ({ page, world }) => {
  await openGeneratingBook(page, world, preparingBook)
})

Given('a book with a story bible is open', async ({ page, world }) => {
  await openGeneratingBook(page, world, bibleBook)
})

When('the user opens the story bible', async ({ page }) => {
  await page.getByText('Story bible', { exact: true }).click()
})

Then('the story bible shows {string}', async ({ page }, text) => {
  await expect(page.getByText(text)).toBeVisible()
  await expect(page.getByText('<script>alert(1)</script>')).toBeVisible()
})

Then('no story bible is offered', async ({ page }) => {
  await expect(page.getByText('Story bible', { exact: true })).toHaveCount(0)
})

Then('{int} chapters are marked {string}', async ({ page }, count, label) => {
  await expect(page.getByText(label, { exact: true })).toHaveCount(count)
})

When('the user ticks {string}', async ({ page }, label) => {
  await page.getByRole('checkbox', { name: label }).check()
})

Then('the create request asks for diagrams', async ({ world }) => {
  expect(world.createBook?.['diagrams']).toBe(true)
})

Then('the create request does not ask for diagrams', async ({ world }) => {
  expect(world.createBook).toBeDefined()
  expect(world.createBook?.['diagrams']).toBeUndefined()
})

When('the user sets chapters at once to {string}', async ({ page }, value) => {
  await page.getByLabel('Chapters at once').fill(value)
})

Then('the create request does not set chapters at once', async ({ world }) => {
  expect(world.createBook).toBeDefined()
  expect(world.createBook?.['concurrency']).toBeUndefined()
})

Then('the create request has {int} chapters at once', async ({ world }, value) => {
  expect(world.createBook?.['concurrency']).toBe(value)
})

Then('no book was created', async ({ world }) => {
  expect(world.createBook).toBeUndefined()
})

Then('the panel says {string}', async ({ page }, text) => {
  await expect(page.getByText(text)).toBeVisible()
})

Then('chapters 3, 4 and 5 are marked as writing', async ({ page }) => {
  await expect(page.getByText('Writing…')).toHaveCount(3)
})

Then('the manuscript shows the diagram and blocks the remote image', async ({ page }) => {
  const images = page.locator('.manuscript img')
  await expect(images).toHaveCount(1)
  await expect(images).toHaveAttribute('alt', "Keeper's route")
  await expect(images).toHaveAttribute('src', /^data:image\/png;base64,/)
})

Then('a diagram that was not rendered shows its source', async ({ page }) => {
  await expect(page.locator('.manuscript code').filter({ hasText: 'not a diagram' })).toBeVisible()
})

Then('the epub packages the diagram as a file', async ({ world }) => {
  const download = world.download
  expect(download).toBeDefined()
  const zip = await readFile(await download!.path())
  const text = zip.toString('latin1')
  expect(text).toContain('OEBPS/diagram-1.png')
  expect(text).toContain('href="diagram-1.png" media-type="image/png"')
  expect(text).toContain('src="diagram-1.png"')
  expect(text).not.toContain('data:image/png;base64')
})

Then('the file has no image data', async ({ world }) => {
  const download = world.download
  expect(download).toBeDefined()
  expect(await readFile(await download!.path(), 'utf8')).not.toContain('base64')
})

Given('a book with unsafe chapter text is open', async ({ page, world }) => {
  world.listItem = listItemFor(chapterReviewBook)
  world.detailQueue = [chapterReviewBook]
  world.chapterText = {
    number: 2,
    title: 'Unsafe',
    text: '**Bold claim** and $E = mc^2$.\n\n<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>',
  }
  await mockBookApi(page, world)
  await mockChapterActions(page, world)
  await openFromList(page, titleOf(chapterReviewBook))
})

Given('the book API lists a completed book', async ({ page, world }) => {
  world.listItem = listItemFor(completedBook)
  world.detailQueue = [completedBook]
  await page.reload()
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
  await page.getByLabel('Chapters', { exact: true }).fill(String(chapters))
  await page.getByLabel('Words per chapter').fill(String(words))
})

When('the user turns on illustrations', async ({ page }) => {
  await page.getByRole('checkbox', { name: /^Illustrations/ }).check()
})

When('the user selects the image model {string}', async ({ page }, label) => {
  await fieldNamed(page, 'Image model').selectOption({ label })
})

When('the user sets {string} to {string}', async ({ page }, label, value) => {
  const field = fieldNamed(page, label)
  if ((await field.evaluate((node) => node.tagName)) === 'SELECT') await field.selectOption(value)
  else await field.fill(value)
})

When('the user saves the OpenRouter key {string}', async ({ page }, key) => {
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel(/OpenRouter/).fill(key)
  await page.getByRole('dialog', { name: 'Settings' }).press('Escape')
})

When('the user selects the model {string}', async ({ page }, label) => {
  await page.getByLabel('Model', { exact: true }).click()
  await page.getByRole('option', { name: label }).click()
})

When('the user opens the completed book', async ({ page }) => {
  await page.getByRole('button', { name: titleOf(completedBook) }).click()
  await expect(page.getByText('Book complete')).toBeVisible()
})

When('the user opens settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click()
})

When('the user saves the OpenRouter API key {string}', async ({ page }, key) => {
  await page.getByLabel('OpenRouter API key').fill(key)
})

When('the user saves the cover image API key {string}', async ({ page }, key) => {
  await page.getByLabel('Cover image API key').fill(key)
})

When('the user selects the cover image model {string}', async ({ page }, label) => {
  await page.getByLabel('Cover image model').selectOption({ label })
})

Given('the server rejects the next cover with {string}', async ({ world }, message) => {
  world.coverError = message
})

Then('the cover request has image key {string} and model {string}', async ({ world }, imageApiKey, imageModel) => {
  await expect.poll(() => world.coverRequest).toEqual({ imageApiKey, imageModel })
})

Then('the cover request carries no image settings', async ({ world }) => {
  await expect.poll(() => world.coverRequest).toEqual({})
})

Then('the generated cover is shown', async ({ page }) => {
  await expect(page.getByRole('img', { name: 'Generated book cover' })).toBeVisible()
})

Then('the cover error says {string}', async ({ page }, message) => {
  await expect(page.getByText(message)).toBeVisible()
})

Then('the cover image API key shows {string}', async ({ page }, key) => {
  await expect(page.getByLabel('Cover image API key')).toHaveValue(key)
})

Then('the cover image model shows {string}', async ({ page }, model) => {
  await expect(page.getByLabel('Cover image model')).toHaveValue(model)
})

Given('the server rejects saving settings with {string}', async ({ world }, message) => {
  world.settingsError = message
})

When('the user sets concurrent LLM calls to {string}', async ({ page }, value) => {
  const field = page.getByLabel('Concurrent LLM calls')
  await expect(field).toBeEnabled()
  await field.fill(value)
})

When('the user saves concurrent LLM calls', async ({ page }) => {
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Save', exact: true }).click()
})

Then('concurrent LLM calls shows {int}', async ({ page }, value) => {
  await expect(page.getByLabel('Concurrent LLM calls')).toHaveValue(String(value))
})

Then('the server saved concurrent LLM calls as {int}', async ({ page, world }, value) => {
  await expect.poll(() => world.settingsSaved).toEqual({ llmMaxConcurrency: value })
  await expect(page.getByLabel('Concurrent LLM calls')).toHaveValue(String(value))
})

Then('saving concurrent LLM calls is disabled', async ({ page }) => {
  await expect(page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
})

Then('the settings dialog says {string}', async ({ page }, message) => {
  await expect(page.getByRole('dialog', { name: 'Settings' }).getByText(message)).toBeVisible()
})

When('the user clicks inside the settings dialog', async ({ page }) => {
  await page.getByRole('dialog', { name: 'Settings' }).click({ position: { x: 4, y: 4 } })
})

When('the user presses Escape', async ({ page }) => {
  await page.keyboard.press('Escape')
})

When('the user clicks {string}', async ({ page }, name) => {
  await page.getByRole('button', { name }).click()
})

When('the user sets the outline title to {string}', async ({ page }, title) => {
  await page.getByLabel('Title', { exact: true }).fill(title)
})

When('the user writes the review comment {string}', async ({ page }, comment) => {
  await page.getByLabel(/Feedback \(/).fill(comment)
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

When('the user changes the book idea to {string}', async ({ page }, idea) => {
  await page.getByRole('textbox', { name: 'Book idea' }).fill(idea)
})

Then('the TOC approve request has idea {string}', async ({ world }, idea) => {
  expect((world.tocApprove as { prompt?: string }).prompt).toBe(idea)
})

Then('the TOC approve request has no idea', async ({ world }) => {
  expect((world.tocApprove as { prompt?: string }).prompt).toBeUndefined()
})

Then('the TOC revise request has idea {string}', async ({ world }, idea) => {
  expect((world.tocRevise as { prompt?: string }).prompt).toBe(idea)
})

Then('there is no {string} button', async ({ page }, name) => {
  await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
})

Then('the new book form reads {string}, {string} chapters of {string} words, {string} at once', async ({ page }, idea, chapters, words, atOnce) => {
  await expect(page.getByRole('heading', { name: 'New book' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Book idea' })).toHaveValue(idea)
  await expect(page.getByLabel('Chapters', { exact: true })).toHaveValue(chapters)
  await expect(page.getByLabel('Words per chapter')).toHaveValue(words)
  await expect(page.getByLabel('Chapters at once')).toHaveValue(atOnce)
})

Then('no book has been created', async ({ world }) => {
  expect(world.createBook).toBeUndefined()
})

Then('the create request has idea {string}, {int} chapters of {int} words, {int} at once, scholar and diagrams', async ({ world }, idea, chapters, words, atOnce) => {
  expect(world.createBook).toMatchObject({
    prompt: idea,
    chapters,
    wordsPerChapter: words,
    concurrency: atOnce,
    scholar: true,
    diagrams: true,
  })
})

Then('the create request has no illustrations', async ({ world }) => {
  expect(world.createBook).toBeDefined()
  expect(world.createBook?.['illustrations']).toBeUndefined()
})

Then('the create request has illustrations {string}', async ({ world }, expected) => {
  expect(world.createBook?.['illustrations']).toEqual(JSON.parse(expected))
})

Then('the image model options are {string}', async ({ page }, labels) => {
  await expect(fieldNamed(page, 'Image model').locator('option')).toHaveText(labels.split(', '))
})

Then('{string} offers {string}', async ({ page }, label, options) => {
  await expect(fieldNamed(page, label).locator('option')).toHaveText(options.split(', '))
})

Then('{string} reads {string}', async ({ page }, label, value) => {
  await expect(fieldNamed(page, label)).toHaveValue(value)
})

Then('the form has no {string} field', async ({ page }, label) => {
  await expect(fieldNamed(page, label)).toHaveCount(0)
})

Then('the manuscript shows the illustration', async ({ page }) => {
  const images = page.locator('.manuscript img')
  await expect(images).toHaveCount(1)
  await expect(images).toHaveAttribute('alt', 'The lighthouse at dusk')
  await expect(images).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
})

Then('the saved copy leaves the large image out', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => (localStorage.getItem('book-writer-completed-books') ?? '').includes('Illustration not in the saved copy'))).toBe(true)
  const size = await page.evaluate(() => (localStorage.getItem('book-writer-completed-books') ?? '').length)
  expect(size).toBeLessThan(100_000)
})

Then('the epub packages the illustration as a JPEG', async ({ world }) => {
  const zip = await readFile(await world.download!.path())
  expect(zip.toString('latin1')).toContain('OEBPS/diagram-1.jpeg')
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

Then('the epub embeds non-empty katex fonts', async ({ world }) => {
  const download = world.download
  expect(download).toBeDefined()
  const buf = await readFile(await download!.path())
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  expect(eocd).toBeGreaterThanOrEqual(0)
  const count = buf.readUInt16LE(eocd + 10)
  const fonts = []
  let p = buf.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(p + 28)
    const size = buf.readUInt32LE(p + 20)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    if (name.endsWith('.woff2')) fonts.push({ name, size })
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32)
  }
  expect(fonts.length).toBe(20)
  for (const font of fonts) expect(font.size).toBeGreaterThan(1000)
})

Then('the epub embeds a cover image', async ({ world }) => {
  const download = world.download
  expect(download).toBeDefined()
  const buf = await readFile(await download!.path())
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  expect(eocd).toBeGreaterThanOrEqual(0)
  const count = buf.readUInt16LE(eocd + 10)
  const names = new Set<string>()
  const contents = new Map<string, string>()
  let p = buf.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const size = buf.readUInt32LE(p + 24)
    const localOffset = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    names.add(name)
    const localNameLen = buf.readUInt16LE(localOffset + 26)
    const localExtraLen = buf.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    contents.set(name, buf.toString('utf8', dataStart, dataStart + size))
    p += 46 + nameLen + extraLen + commentLen
  }
  expect(names.has('OEBPS/cover.png')).toBe(true)
  expect(names.has('OEBPS/cover.xhtml')).toBe(true)
  expect(contents.get('OEBPS/content.opf')).toContain('properties="cover-image"')
  expect(contents.get('OEBPS/cover.xhtml')).toContain('src="cover.png"')
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

Then('the page explains {string}', async ({ page }, fragment) => {
  await expect(page.getByText(fragment)).toBeVisible()
})

Then('the chapter shows bold text {string} and rendered math', async ({ page }, text) => {
  await expect(page.locator('.manuscript strong')).toHaveText(text)
  await expect(page.locator('.manuscript .katex').first()).toBeVisible()
})

Then('the chapter contains no injected markup', async ({ page }) => {
  await expect(page.locator('.manuscript img, .manuscript script')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

Then('the idea still reads {string}', async ({ page }, idea) => {
  await expect(page.getByRole('textbox', { name: 'Book idea' })).toHaveValue(idea)
})

Then('the settings dialog is open', async ({ page }) => {
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
})

Then('the settings dialog is closed', async ({ page }) => {
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden()
})

Then('the book list is empty', async ({ page }) => {
  await expect(page.getByText('No books yet.')).toBeVisible()
})

Then('the error panel {string} is visible', async ({ page }, title) => {
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
})

Then('the book renders normally', async ({ page }) => {
  await expect(page.getByText('Planning the book')).toBeVisible()
})

Then('the empty state is visible', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'New book' })).toBeVisible()
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
