"use client"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react"
import { MediaPreview } from "../MediaPreview"
import { generationReferences, mediaFilename, parseImages } from "../utils"
import { WavespeedGeneration } from "../types"
import styles from "./index.module.scss"
type Props = {
  generation: WavespeedGeneration
  imageIndex: number
  onImageIndexChange: (i: number) => void
  onClose: () => void
  onDownloadImage: (url: string, name: string) => void
  onDownloadAll: (g: WavespeedGeneration) => void
  onSaveModel: (g: WavespeedGeneration) => void
  onRegenerate: (g: WavespeedGeneration) => void
  onDelete: (id: string) => void
}
export function GenerationModal(props: Props) {
  const images = parseImages(props.generation.resultImages)
  const references = generationReferences(props.generation)
  const activeImage = images[props.imageIndex] || images[0]
  function go(direction: -1 | 1) {
    props.onImageIndexChange(
      (props.imageIndex + direction + images.length) % images.length,
    )
  }
  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <section
        className={styles.viewer}
        role='dialog'
        aria-modal='true'
        aria-label='Generation result'
      >
        <div className={styles.media}>
          <button
            className={styles.close}
            type='button'
            onClick={props.onClose}
            aria-label='Close preview'
          >
            <X size={20} />
          </button>
          {images.length > 1 && (
            <button
              className={styles.prev}
              type='button'
              onClick={() => go(-1)}
              aria-label='Previous image'
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <MediaPreview
            src={activeImage}
            alt={props.generation.prompt}
            controls
          />
          {images.length > 1 && (
            <button
              className={styles.next}
              type='button'
              onClick={() => go(1)}
              aria-label='Next image'
            >
              <ChevronRight size={24} />
            </button>
          )}
          <button
            className={styles.download}
            type='button'
            onClick={() =>
              props.onDownloadImage(
                activeImage,
                mediaFilename(
                  activeImage,
                  `wavespeed-${props.generation.id}-${props.imageIndex + 1}`,
                ),
              )
            }
            aria-label='Download current image'
          >
            <Download size={20} />
          </button>
          <div className={styles.thumbs}>
            {images.map((image, index) => (
              <button
                className={index === props.imageIndex ? styles.thumbActive : ""}
                type='button'
                key={`${props.generation.id}-thumb-${index}`}
                onClick={() => props.onImageIndexChange(index)}
              >
                <MediaPreview src={image} alt='' />
              </button>
            ))}
          </div>
        </div>
        <aside className={styles.info}>
          <span className={styles.kicker}>
            {props.generation.mode} generation
          </span>
          <h2>Result details</h2>
          <div className={styles.block}>
            <strong>Prompt</strong>
            <p>{props.generation.prompt}</p>
          </div>
          <div className={styles.block}>
            <strong>Media count</strong>
            <p>{images.length}</p>
          </div>
          <div className={styles.block}>
            <strong>Used references</strong>
            {references.length ? (
              <div className={styles.refs}>
                {references.map((reference, index) => (
                  <MediaPreview
                    src={reference}
                    alt=''
                    key={`${props.generation.id}-ref-${index}`}
                  />
                ))}
              </div>
            ) : (
              <p>No references saved for this generation.</p>
            )}
          </div>
          <div className={styles.actions}>
            <button
              type='button'
              onClick={() => props.onRegenerate(props.generation)}
            >
              <RotateCcw size={17} />
              Regenerate
            </button>
            {props.generation.mode === "model" && (
              <button
                type='button'
                onClick={() => props.onSaveModel(props.generation)}
              >
                <Save size={17} />
                Save model
              </button>
            )}
            <button
              type='button'
              onClick={() => props.onDownloadAll(props.generation)}
            >
              <Download size={17} />
              All
            </button>
            <button
              type='button'
              onClick={() => props.onDelete(props.generation.id)}
            >
              <Trash2 size={17} />
              Delete
            </button>
          </div>
        </aside>
      </section>
    </div>
  )
}
