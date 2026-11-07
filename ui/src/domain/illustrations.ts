export const defaultImageModelId = 'google/gemini-nano-banana-2.1'

/** Marks a saved cover model as an OpenRouter one, since OpenAI's own ids could look alike. */
export const openRouterCoverPrefix = 'openrouter:'

const portraitRatios = ['2:3', '3:4', '4:5', '9:16']

/** Covers are portrait, so take the first portrait ratio the model offers, or leave it to the model. */
export const coverAspectRatioFor = (model: ImageModel | undefined): string =>
  portraitRatios.find((ratio) => model?.aspectRatios.includes(ratio)) ?? ''

export interface ImageModel {
  readonly id: string
  readonly label: string
  readonly aspectRatios: readonly string[]
  readonly resolutions: readonly string[]
  readonly qualities: readonly string[]
  readonly maxReferences: number
}

export interface ImageChoiceValues {
  readonly imageAspectRatio: string
  readonly imageResolution: string
  readonly imageQuality: string
  readonly imageReference: boolean
}

export interface ImageChoices {
  readonly aspectRatio?: string
  readonly resolution?: string
  readonly quality?: string
  readonly useReference: boolean
}

const supported = (value: string, options: readonly string[]): string | undefined =>
  options.includes(value) ? value : undefined

/** What the chosen model can actually do. Choices are kept in the form, so switching back restores them;
  * a model the list does not describe gets its own defaults. */
export const imageChoicesFor = (model: ImageModel | undefined, values: ImageChoiceValues): ImageChoices =>
  model === undefined
    ? { useReference: false }
    : {
        aspectRatio: supported(values.imageAspectRatio, model.aspectRatios),
        resolution: supported(values.imageResolution, model.resolutions),
        quality: supported(values.imageQuality, model.qualities),
        useReference: values.imageReference && model.maxReferences > 0,
      }
