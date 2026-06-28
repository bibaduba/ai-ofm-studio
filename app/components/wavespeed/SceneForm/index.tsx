"use client"
import { ChangeEvent } from "react"
import { Loader2, Sparkles, Upload, Wand2 } from "lucide-react"
import { SavedModel } from "../types"
import { modelReferences } from "../utils"
import styles from "./index.module.scss"
type Props = {
  models: SavedModel[]
  selectedModel?: SavedModel
  selectedModelId: string
  sceneReference: string
  count: number
  prompt: string
  loading: boolean
  promptLoading: boolean
  onModelChange: (v: string) => void
  onSceneUpload: (e: ChangeEvent<HTMLInputElement>) => void
  onCountChange: (v: number) => void
  onPromptChange: (v: string) => void
  onGeneratePrompt: () => void
  onGenerate: () => void
}
export function SceneForm(props: Props) {
  return (
    <>
      <label className={styles.field}>
        <span>Saved model</span>
        <select
          value={props.selectedModelId}
          onChange={(e) => props.onModelChange(e.target.value)}
        >
          {props.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </label>
      {props.selectedModel && (
        <div className={styles.savedRefs}>
          {modelReferences(props.selectedModel).map((image, index) => (
            <img
              key={`${props.selectedModel?.id}-${index}`}
              src={image}
              alt=''
            />
          ))}
        </div>
      )}
      <label className={styles.upload}>
        <input type='file' accept='image/*' onChange={props.onSceneUpload} />
        {props.sceneReference ? (
          <img src={props.sceneReference} alt='' />
        ) : (
          <Upload size={28} />
        )}
        <strong>Scene reference</strong>
        <span>
          Clothing, pose, action, composition, background, lighting, atmosphere
        </span>
      </label>
      <label className={styles.field}>
        <span>Кол-во генераций изображений</span>
        <input
          type='number'
          min={1}
          value={props.count}
          onChange={(e) => props.onCountChange(Number(e.target.value))}
        />
      </label>
      <label className={styles.field}>
        <div className={styles.fieldHeader}>
          <span>Prompt</span>
          <button
            type='button'
            onClick={props.onGeneratePrompt}
            disabled={props.promptLoading || !props.sceneReference}
            title='Generate prompt with Gemini'
            aria-label='Generate prompt with Gemini'
          >
            {props.promptLoading ? (
              <Loader2 className={styles.spin} size={17} />
            ) : (
              <Sparkles size={17} />
            )}
          </button>
        </div>
        <textarea
          value={props.prompt}
          onChange={(e) => props.onPromptChange(e.target.value)}
        />
      </label>
      <button
        className={styles.generate}
        type='button'
        onClick={props.onGenerate}
        disabled={props.loading}
      >
        {props.loading ? (
          <Loader2 className={styles.spin} size={18} />
        ) : (
          <Wand2 size={18} />
        )}
        Generate scene
      </button>
    </>
  )
}
