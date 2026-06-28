"use client"
import { ChangeEvent } from "react"
import { Upload } from "lucide-react"
import styles from "./index.module.scss"
export function ReferenceUpload({
  title,
  description,
  images,
  onUpload,
  onClear,
}: {
  title: string
  description: string
  images: string[]
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}) {
  return (
    <div className={styles.block}>
      <div>
        <strong>{title}</strong>
        <button type='button' onClick={onClear}>
          Clear
        </button>
      </div>
      <label>
        <input type='file' accept='image/*' multiple onChange={onUpload} />
        {!images.length ? (
          <>
            <Upload size={26} />
            <span>{description}</span>
          </>
        ) : (
          <div className={styles.thumbs}>
            {images.map((image, index) => (
              <img key={`${image.slice(0, 20)}-${index}`} src={image} alt='' />
            ))}
          </div>
        )}
      </label>
    </div>
  )
}
