"use client"
import { AlertTriangle } from "lucide-react"
import { useEffect, useState } from "react"
import { isVideoMedia } from "../utils"
import styles from "./index.module.scss"

export function MediaPreview({
  src,
  alt,
  controls = false,
}: {
  src: string
  alt: string
  controls?: boolean
}) {
  const [failed, setFailed] = useState(src.startsWith("expired:"))
  useEffect(() => setFailed(src.startsWith("expired:")), [src])
  if (failed)
    return (
      <span className={styles.expired}>
        <AlertTriangle size={22} />
        <strong>Output expired</strong>
        <small>WaveSpeed удалил временный файл</small>
      </span>
    )
  if (isVideoMedia(src))
    return (
      <video
        src={src}
        onError={() => setFailed(true)}
        controls={controls}
        muted={!controls}
        playsInline
        loop={!controls}
      />
    )
  return <img src={src} alt={alt} onError={() => setFailed(true)} />
}
