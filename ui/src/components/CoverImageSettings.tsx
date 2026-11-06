import { imageModels } from '../domain/models'
import { fieldLabel, hint, input } from '../domain/uiClasses'
import { useSettingsStore } from '../store/settingsStore'

export const CoverImageSettings = () => {
  const imageApiKey = useSettingsStore((state) => state.imageApiKey)
  const imageModel = useSettingsStore((state) => state.imageModel)
  const setImageApiKey = useSettingsStore((state) => state.setImageApiKey)
  const setImageModel = useSettingsStore((state) => state.setImageModel)
  const knownImageModel = imageModels.some((model) => model.id === imageModel) ? imageModel : ''

  return (
    <>
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
      <label className={fieldLabel}>
        Cover image model
        <select className={input} value={knownImageModel} onChange={(event) => setImageModel(event.target.value)}>
          <option value="">Server default</option>
          {imageModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
      </label>
      <p className={hint}>
        Covers use OpenAI’s image API unless the server sets IMAGE_BASE_URL. Changes apply to covers not generated yet;
        a book keeps the cover it already has until the server restarts.
      </p>
    </>
  )
}
