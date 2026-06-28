"use client"

import { Instagram, Link2, Plus, Unlink } from "lucide-react"
import Link from "next/link"
import { InstagramModel } from "../types"
import styles from "./index.module.scss"

type Props = {
  models: InstagramModel[]
  selectedId: string
  configured: boolean
  onSelect: (id: string) => void
  onConnect: (id: string) => void
  onDisconnect: (id: string) => void
}

function modelPreview(model: InstagramModel) {
  try {
    const images = JSON.parse(model.faceReferences)
    return Array.isArray(images) && typeof images[0] === "string"
      ? images[0]
      : ""
  } catch {
    return ""
  }
}

export function ModelSidebar(props: Props) {
  return (
    <aside className={styles.sidebar}>
      <header>
        <div>
          <span>MODEL ACCOUNTS</span>
          <h2>Instagram</h2>
        </div>
        <Link href='/wavespeed' title='Create model' aria-label='Create model'>
          <Plus size={18} />
        </Link>
      </header>

      <div className={styles.list}>
        {props.models.map((model) => {
          const preview = modelPreview(model)
          const connected = Boolean(model.connectionId)
          return (
            <article
              className={`${styles.model} ${props.selectedId === model.id ? styles.active : ""}`}
              key={model.id}
            >
              <button
                className={styles.select}
                type='button'
                onClick={() => props.onSelect(model.id)}
              >
                <span className={styles.avatar}>
                  {preview ? <img src={preview} alt='' /> : <Instagram />}
                </span>
                <span className={styles.copy}>
                  <strong>{model.name}</strong>
                  <small>
                    {connected
                      ? `@${model.instagramUsername}`
                      : "Instagram not connected"}
                  </small>
                </span>
                <span
                  className={`${styles.status} ${connected ? styles.online : ""}`}
                />
              </button>
              {connected ? (
                <button
                  className={styles.connectionAction}
                  type='button'
                  onClick={() => props.onDisconnect(model.id)}
                  title='Disconnect Instagram'
                  aria-label={`Disconnect Instagram from ${model.name}`}
                >
                  <Unlink size={15} />
                </button>
              ) : (
                <button
                  className={styles.connectionAction}
                  type='button'
                  onClick={() => props.onConnect(model.id)}
                  disabled={!props.configured}
                  title='Connect Instagram'
                  aria-label={`Connect Instagram to ${model.name}`}
                >
                  <Link2 size={15} />
                </button>
              )}
            </article>
          )
        })}
      </div>
    </aside>
  )
}
