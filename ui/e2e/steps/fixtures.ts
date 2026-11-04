import { test as base } from 'playwright-bdd'
import { createWorld } from '../helpers/world'
import type { World } from '../helpers/world'

export const test = base.extend<{ world: World }>({
  world: async ({}, use) => {
    await use(createWorld())
  },
})
