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

// A 1x1 transparent PNG the server "generated" as a cover.
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

export const mockCoverApi = async (page: Page, world: World): Promise<void> => {
  await page.route('**/api/books/b1/cover', async (route) => {
    if (route.request().method() === 'POST') {
      world.coverRequest = await route.request().postDataJSON()
      if (world.coverError !== undefined) {
        const error = world.coverError
        world.coverError = undefined
        await json(route, { error }, 400)
        return
      }
      await route.fulfill({ status: 200, contentType: 'image/png', body: tinyPng })
      return
    }
    await json(route, { error: 'book has no cover yet; POST to generate one' }, 404)
  })
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
    if (route.request().method() === 'DELETE') {
      world.listItem = undefined
      await json(route, { ok: true })
      return
    }
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

  await page.route('**/api/settings', async (route) => {
    const request = route.request()
    if (request.method() === 'PUT') {
      if (world.settingsError !== undefined) {
        await json(route, { error: world.settingsError }, 500)
        return
      }
      world.settingsSaved = await request.postDataJSON()
      world.llmMaxConcurrency = Number(world.settingsSaved?.['llmMaxConcurrency'])
    }
    await json(route, { llmMaxConcurrency: world.llmMaxConcurrency })
  })

  await mockOpenRouterModels(page)
  await mockLmStudioModels(page)
  await mockCoverApi(page, world)
}

export const mockOpenRouterModels = async (page: Page): Promise<void> => {
  await page.route('**/openrouter.ai/api/v1/models', async (route) => {
    await json(route, {
      data: [
        {
          id: 'meta-llama/llama-3.3-70b-instruct',
          name: 'Llama 3.3 70B Instruct',
          supported_parameters: ['tools', 'temperature'],
        },
        {
          id: 'anthropic/claude-sonnet-4',
          name: 'Claude Sonnet 4',
          supported_parameters: ['tools'],
        },
        {
          id: 'google/gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          supported_parameters: ['temperature'],
        },
      ],
    })
  })
}

export const mockLmStudioModels = async (page: Page): Promise<void> => {
  await page.route('**/api/models/lmstudio', async (route) => {
    await json(route, { data: [{ id: 'qwen2.5-7b-instruct' }, { id: 'llama-3.2-3b-instruct' }] })
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
