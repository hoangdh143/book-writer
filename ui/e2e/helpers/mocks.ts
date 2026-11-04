import type { Page, Route } from '@playwright/test'
import {
  chapterReviewBook,
  chapterTextV2,
  generatingBook,
  listItemFor,
  planningBook,
  tocReviewBookV2,
} from './books'
import type { World } from './world'

const json = async (route: Route, body: unknown, status = 200): Promise<void> => {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

export const mockBookApi = async (page: Page, world: World): Promise<void> => {
  await page.route('**/api/books', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      world.createBook = await request.postDataJSON()
      if (world.createError !== undefined) {
        await json(route, { error: world.createError }, 400)
        return
      }
      world.created = true
      await json(route, { id: 'b1' }, 201)
      return
    }
    const list = world.created
      ? [listItemFor({ ...planningBook, prompt: String(world.createBook?.['prompt'] ?? planningBook.prompt) })]
      : world.listItem === undefined
        ? []
        : [world.listItem]
    await json(route, list)
  })

  await page.route('**/api/books/b1', async (route) => {
    if (world.offline) {
      await route.abort()
      return
    }
    if (world.detailStatus !== 200) {
      await json(route, { error: world.detailError }, world.detailStatus)
      return
    }
    const shifted = world.detailQueue.shift()
    const body = shifted ?? world.detailQueue[0] ?? planningBook
    await json(route, body)
  })

  await page.route('**/api/books/b1/chapters/2', async (route) => {
    await json(route, world.chapterText)
  })
}

export const mockTocActions = async (page: Page, world: World): Promise<void> => {
  await page.route('**/api/books/b1/toc/approve', async (route) => {
    world.tocApprove = await route.request().postDataJSON()
    world.detailQueue = [generatingBook]
    await json(route, { ok: true })
  })
  await page.route('**/api/books/b1/toc/revise', async (route) => {
    world.tocRevise = await route.request().postDataJSON()
    world.detailQueue = [tocReviewBookV2]
    await json(route, { ok: true })
  })
}

export const mockChapterActions = async (page: Page, world: World): Promise<void> => {
  await page.route('**/api/books/b1/chapters/2/approve', async (route) => {
    world.chapterApprove = await route.request().postDataJSON()
    world.detailQueue = [generatingBook]
    await json(route, { ok: true })
  })
  await page.route('**/api/books/b1/chapters/approve-rest', async (route) => {
    world.approveRest = await route.request().postDataJSON()
    world.detailQueue = [generatingBook]
    await json(route, { ok: true })
  })
  await page.route('**/api/books/b1/chapters/2/revise', async (route) => {
    world.chapterRevise = await route.request().postDataJSON()
    world.chapterText = chapterTextV2
    world.detailQueue = [generatingBook, chapterReviewBook]
    await json(route, { ok: true })
  })
}
