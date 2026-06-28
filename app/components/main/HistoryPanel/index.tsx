"use client"

import {
  Download,
  Grid2X2,
  Heart,
  ImageIcon,
  List,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react"
import { Generation, HistoryType, HistoryView, SourceImage } from "../types"
import { formatDate } from "../utils"
import styles from "./index.module.scss"

type HistoryPanelProps = {
  profileName: string
  generations: Generation[]
  historyType: HistoryType
  favoritesOnly: boolean
  search: string
  view: HistoryView
  onHistoryTypeChange: (type: HistoryType) => void
  onFavorites: () => void
  onSearchChange: (value: string) => void
  onViewChange: (view: HistoryView) => void
  onFavorite: (generation: Generation) => void
  onDelete: (id: string) => void
}

export function HistoryPanel(props: HistoryPanelProps) {
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{props.profileName}</span>
          <h1>History</h1>
        </div>
        <div className={styles.controls}>
          <button
            className={
              props.historyType === "all" && !props.favoritesOnly
                ? styles.active
                : ""
            }
            type='button'
            onClick={() => props.onHistoryTypeChange("all")}
          >
            All
          </button>
          <button
            className={
              props.historyType === "image" && !props.favoritesOnly
                ? styles.active
                : ""
            }
            type='button'
            onClick={() => props.onHistoryTypeChange("image")}
          >
            <ImageIcon size={18} />
            Image
          </button>
          <button
            className={
              props.historyType === "video" && !props.favoritesOnly
                ? styles.active
                : ""
            }
            type='button'
            onClick={() => props.onHistoryTypeChange("video")}
          >
            Video
          </button>
          <button
            className={props.favoritesOnly ? styles.active : ""}
            type='button'
            onClick={props.onFavorites}
          >
            <Heart size={18} />
            Favorites
          </button>
          <div className={styles.search}>
            <Search size={18} />
            <input
              value={props.search}
              onChange={(event) => props.onSearchChange(event.target.value)}
              placeholder='Search'
            />
          </div>
          <div className={styles.viewToggle}>
            <button
              className={props.view === "list" ? styles.active : ""}
              type='button'
              aria-label='List view'
              onClick={() => props.onViewChange("list")}
            >
              <List size={18} />
            </button>
            <button
              className={props.view === "grid" ? styles.active : ""}
              type='button'
              aria-label='Grid view'
              onClick={() => props.onViewChange("grid")}
            >
              <Grid2X2 size={18} />
            </button>
          </div>
        </div>
      </header>

      {props.generations.length === 0 ? (
        <div className={styles.empty}>
          <Sparkles size={32} />
          <h2>No generations yet</h2>
          <p>
            Сгенерированные изображения и видео появятся здесь вместе с prompt и
            настройками.
          </p>
        </div>
      ) : (
        <div className={props.view === "grid" ? styles.grid : styles.list}>
          {props.generations.map((item) => {
            let references: SourceImage[] = []
            try {
              references = item.sourceImages
                ? JSON.parse(item.sourceImages)
                : []
            } catch {
              references = []
            }
            return (
              <article className={styles.card} key={item.id}>
                <div className={styles.media}>
                  {item.mediaType === "video" ? (
                    <video controls playsInline src={item.imageData} />
                  ) : (
                    <img alt={item.prompt} src={item.imageData} />
                  )}
                  <button
                    type='button'
                    onClick={() => props.onFavorite(item)}
                    aria-label='Favorite'
                  >
                    <Heart
                      fill={item.favorite ? "currentColor" : "none"}
                      size={24}
                    />
                  </button>
                </div>
                <div className={styles.body}>
                  <div className={styles.meta}>
                    <span>{item.mediaType}</span>
                    <span>{item.model.replace("gemini-", "")}</span>
                  </div>
                  <h2>Prompt</h2>
                  <p>{item.prompt}</p>
                  {references.length > 0 && (
                    <div className={styles.references}>
                      {references.slice(0, 5).map((reference, index) => (
                        <img
                          alt=''
                          src={reference.dataUrl}
                          key={`${item.id}-${index}`}
                        />
                      ))}
                    </div>
                  )}
                  <div className={styles.pills}>
                    <span>{item.aspectRatio}</span>
                    <span>{item.resolution}</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                  <div className={styles.actions}>
                    <a
                      href={item.imageData}
                      download={`generation-${item.id}.${item.mediaType === "video" ? "mp4" : "png"}`}
                      aria-label='Download'
                    >
                      <Download size={18} />
                    </a>
                    <button
                      type='button'
                      onClick={() => props.onDelete(item.id)}
                      aria-label='Delete'
                    >
                      <Trash2 size={18} />
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
