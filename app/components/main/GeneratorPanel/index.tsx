"use client"

import { ChangeEvent } from "react"
import { ImageIcon, Loader2, Settings2, Upload, Wand2, X } from "lucide-react"
import { MediaType, SourceImage } from "../types"
import { resolutions, videoDurations, videoResolutions } from "../constants"
import styles from "./index.module.scss"

type Option = { value: string; label: string }
type GeneratorPanelProps = {
  mediaType: MediaType
  sourceImages: SourceImage[]
  prompt: string
  model: string
  resolution: string
  aspectRatio: string
  durationSeconds: string
  availableModels: Option[]
  availableAspectRatios: string[]
  availableImageModelIds: string[]
  availableVideoModelIds: string[]
  hasCheckedModels: boolean
  loading: boolean
  error: string
  onMediaTypeChange: (type: MediaType) => void
  onClearReferences: () => void
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveReference: (index: number) => void
  onPromptChange: (value: string) => void
  onModelChange: (value: string) => void
  onResolutionChange: (value: string) => void
  onAspectRatioChange: (value: string) => void
  onDurationChange: (value: string) => void
  onGenerate: () => void
}

export function GeneratorPanel(props: GeneratorPanelProps) {
  return (
    <aside className={styles.panel}>
      <div className={styles.tabs}>
        {(["image", "video"] as MediaType[]).map((type) => (
          <button
            className={props.mediaType === type ? styles.activeTab : ""}
            type='button'
            key={type}
            onClick={() => props.onMediaTypeChange(type)}
          >
            {type === "image" ? "Image" : "Video"}
          </button>
        ))}
        <button
          className={styles.clearButton}
          type='button'
          onClick={props.onClearReferences}
        >
          Clear
        </button>
      </div>

      <div className={styles.uploadHeader}>
        <span className={styles.badgeIcon}>
          <ImageIcon size={18} />
        </span>
        <span>
          {props.mediaType === "image"
            ? "Reference Images"
            : "Start / Reference Frames"}
        </span>
      </div>
      <label className={styles.dropzone}>
        <input multiple accept='image/*' type='file' onChange={props.onFiles} />
        <Upload size={30} />
        <strong>
          {props.mediaType === "image"
            ? "Upload Your Images"
            : "Upload Video Frames"}
        </strong>
        <span>
          {props.sourceImages.length}/{props.mediaType === "image" ? 14 : 3}{" "}
          reference images
        </span>
      </label>

      {props.sourceImages.length > 0 && (
        <div className={styles.referenceGrid}>
          {props.sourceImages.map((image, index) => (
            <div
              className={styles.referenceThumb}
              key={`${image.dataUrl.slice(0, 24)}-${index}`}
            >
              <img alt='' src={image.dataUrl} />
              <button
                type='button'
                aria-label='Remove reference'
                onClick={() => props.onRemoveReference(index)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.settings}>
        <div className={styles.settingsTitle}>
          <Settings2 size={18} />
          <span>Advanced Settings</span>
        </div>
        <label className={styles.field}>
          <span>Prompt</span>
          <textarea
            value={props.prompt}
            onChange={(event) => props.onPromptChange(event.target.value)}
          />
        </label>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Model</span>
            <select
              value={props.model}
              onChange={(event) => props.onModelChange(event.target.value)}
            >
              {props.availableModels.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={
                    props.hasCheckedModels &&
                    (props.mediaType === "image"
                      ? !props.availableImageModelIds.includes(option.value)
                      : !props.availableVideoModelIds.includes(option.value))
                  }
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Resolution</span>
            <select
              value={props.resolution}
              onChange={(event) => props.onResolutionChange(event.target.value)}
            >
              {(props.mediaType === "image"
                ? resolutions
                : videoResolutions
              ).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        {props.mediaType === "image" &&
          props.model === "gemini-3-pro-image-preview" && (
            <p className={styles.modelHint}>
              Nano Banana Pro обычно требует включенный billing и доступную
              квоту проекта.
            </p>
          )}
        {props.mediaType === "video" && (
          <div className={styles.segmented}>
            {videoDurations.map((item) => (
              <button
                key={item}
                type='button'
                className={
                  props.durationSeconds === item ? styles.selected : ""
                }
                onClick={() => props.onDurationChange(item)}
              >
                {item}s
              </button>
            ))}
          </div>
        )}
        <div className={styles.segmented}>
          {props.availableAspectRatios.map((item) => (
            <button
              key={item}
              type='button'
              className={props.aspectRatio === item ? styles.selected : ""}
              onClick={() => props.onAspectRatioChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {props.error && <p className={styles.error}>{props.error}</p>}
      <button
        className={styles.generateButton}
        type='button'
        onClick={props.onGenerate}
        disabled={props.loading}
      >
        {props.loading ? (
          <Loader2 className={styles.spin} size={20} />
        ) : (
          <Wand2 size={20} />
        )}
        Generate {props.mediaType === "image" ? "Image" : "Video"}
      </button>
    </aside>
  )
}
