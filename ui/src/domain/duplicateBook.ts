import type { Book } from '../api/types'
import { initialValues } from '../components/CreateBookForm/CreateBookFields'
import type { FormValues } from '../components/CreateBookForm/CreateBookFields'
import { modelFieldsFor } from './models'
import type { ModelPreset } from './models'

/** The New book form for a copy of this book. A saved copy from before settings were sent has none,
  * so its numbers fall back to the form's defaults. */
export const duplicateValues = (book: Book, livePresets: readonly ModelPreset[]): FormValues => {
  const settings = book.settings
  return {
    ...initialValues,
    ...modelFieldsFor(book.model, settings?.baseUrl, livePresets),
    prompt: book.prompt,
    scholar: book.scholar === true,
    ...(settings == null
      ? {}
      : {
          chapters: String(settings.chapters),
          wordsPerChapter: String(settings.wordsPerChapter),
          chaptersAtOnce: String(settings.concurrency),
          diagrams: settings.diagrams,
        }),
  }
}
