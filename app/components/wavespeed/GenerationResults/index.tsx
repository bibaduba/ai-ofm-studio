"use client"
import {
  Download,
  ImageIcon,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react"
import { MediaPreview } from "../MediaPreview"
import { generationImages, isGenerationPending } from "../utils"
import { WavespeedGeneration, WavespeedTab } from "../types"
import styles from "./index.module.scss"
type Props = {
  tab: WavespeedTab
  generations: WavespeedGeneration[]
  onOpen: (g: WavespeedGeneration, index?: number) => void
  onSaveModel: (g: WavespeedGeneration) => void
  onDownload: (g: WavespeedGeneration) => void
  onRegenerate: (g: WavespeedGeneration) => void
  onDelete: (id: string) => void
}

export function GenerationResults(props: Props) {
  return (
    <section className={styles.results}>
      {!props.generations.length ? (
        <div className={styles.empty}>
          <ImageIcon size={34} />
          <p>Результаты генерации появятся здесь.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {props.generations.map((generation) => {
            const images = generationImages(generation)
            const pending = isGenerationPending(generation)
            const failed = generation.status === "failed"

            return (
              <article
                className={`${styles.card} ${pending ? styles.pending : ""} ${failed ? styles.failed : ""}`}
                key={generation.id}
                role='button'
                tabIndex={0}
                onClick={() => !pending && !failed && props.onOpen(generation)}
                onKeyDown={(event) =>
                  event.key === "Enter" &&
                  !pending &&
                  !failed &&
                  props.onOpen(generation)
                }
              >
                {pending ? (
                  <div className={styles.pendingState}>
                    <Loader2 className={styles.spin} size={34} />
                    <strong>Generation in progress</strong>
                  </div>
                ) : failed ? (
                  <div className={styles.pendingState}>
                    <X size={34} />
                    <strong>Generation failed</strong>
                    <span>
                      {generation.error || "Wavespeed rejected the request."}
                    </span>
                  </div>
                ) : (
                  <div
                    className={styles.images}
                    style={{
                      gridTemplateColumns: `repeat(${images.length}, 1fr)`,
                    }}
                  >
                    {images.slice(0, 4).map((image, index) => (
                      <button
                        type='button'
                        onClick={(event) => {
                          event.stopPropagation()
                          props.onOpen(generation, index)
                        }}
                        key={`${generation.id}-${index}`}
                      >
                        <MediaPreview src={image} alt={generation.prompt} />
                      </button>
                    ))}
                  </div>
                )}
                <div className={styles.footer}>
                  <div>
                    <span>
                      {failed
                        ? "failed"
                        : pending
                          ? generation.status || "pending"
                          : `${images.length} image(s)`}
                    </span>
                    <span>
                      {new Date(generation.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation()
                        props.onRegenerate(generation)
                      }}
                      title='Restore generation settings'
                      aria-label='Restore generation settings'
                    >
                      <RotateCcw size={17} />
                    </button>
                    {props.tab === "model" && !pending && !failed && (
                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation()
                          props.onSaveModel(generation)
                        }}
                        title='Save model'
                      >
                        <Save size={17} />
                      </button>
                    )}
                    {!pending && !failed && (
                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation()
                          props.onDownload(generation)
                        }}
                        title='Download all'
                      >
                        <Download size={17} />
                      </button>
                    )}
                    <button
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation()
                        props.onDelete(generation.id)
                      }}
                      title='Delete generation'
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
