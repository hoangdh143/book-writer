import { useOpenRouterImageModels } from '../api/openrouter'
import { coverAspectRatioFor, openRouterCoverPrefix } from '../domain/illustrations'
import { imageModels } from '../domain/models'
import { fieldLabel, hint, input } from '../domain/uiClasses'
import { useSettingsStore } from '../store/settingsStore'

const CoverModelSelect = () => {
  const imageModel = useSettingsStore((state) => state.imageModel)
  const setImageModel = useSettingsStore((state) => state.setImageModel)
  const openRouter = useOpenRouterImageModels()
  const openRouterModels = openRouter.data ?? []
  const savedOpenRouterId = imageModel.startsWith(openRouterCoverPrefix)
    ? imageModel.slice(openRouterCoverPrefix.length)
    : undefined
  const listsSaved = openRouterModels.some((model) => model.id === savedOpenRouterId)
  const knownImageModel =
    savedOpenRouterId !== undefined || imageModels.some((model) => model.id === imageModel) ? imageModel : ''

  const choose = (value: string) => {
    const id = value.startsWith(openRouterCoverPrefix) ? value.slice(openRouterCoverPrefix.length) : undefined
    setImageModel(value, id === undefined ? '' : coverAspectRatioFor(openRouterModels.find((model) => model.id === id)))
  }

  return (
    <>
      <label className={fieldLabel}>
        Cover image model
        <select className={input} value={knownImageModel} onChange={(event) => choose(event.target.value)}>
          <option value="">Server default</option>
          <optgroup label="OpenAI (uses the cover image API key)">
            {imageModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="OpenRouter (uses the OpenRouter API key)">
            {savedOpenRouterId !== undefined && !listsSaved ? (
              <option value={imageModel}>{savedOpenRouterId}</option>
            ) : null}
            {openRouterModels.map((model) => (
              <option key={model.id} value={`${openRouterCoverPrefix}${model.id}`}>
                {model.label}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {openRouter.isError ? (
        <p className="text-sm text-amber-300">
          Could not load OpenRouter’s image models.{' '}
          <button type="button" className="text-sky-300 underline hover:text-sky-200" onClick={() => void openRouter.refetch()}>
            Try again
          </button>
        </p>
      ) : null}
    </>
  )
}

export const CoverImageSettings = () => {
  const imageApiKey = useSettingsStore((state) => state.imageApiKey)
  const setImageApiKey = useSettingsStore((state) => state.setImageApiKey)
  const onOpenRouter = useSettingsStore((state) => state.imageModel.startsWith(openRouterCoverPrefix))

  return (
    <>
      <CoverModelSelect />
      {onOpenRouter ? null : (
        <label className={fieldLabel}>
          Cover image API key
          <input
            type="password"
            autoComplete="off"
            className={input}
            value={imageApiKey}
            onChange={(event) => setImageApiKey(event.target.value)}
          />
        </label>
      )}
      <p className={hint}>
        {onOpenRouter
          ? 'OpenRouter covers use the OpenRouter API key above, or the server’s OPENROUTER_API_KEY, and are billed by OpenRouter.'
          : 'OpenAI covers use OpenAI’s image API unless the server sets IMAGE_BASE_URL.'}{' '}
        Changes apply to covers not generated yet; a book keeps the cover it already has until the server restarts.
      </p>
    </>
  )
}
