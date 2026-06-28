"use client"
import { ChangeEvent } from "react"
import { Film, ImageIcon, Loader2, Wand2 } from "lucide-react"
import styles from "./index.module.scss"
type Props = {
  image: string
  video: string
  orientation: "image" | "video"
  prompt: string
  negativePrompt: string
  keepOriginalSound: boolean
  loading: boolean
  onImageUpload: (e: ChangeEvent<HTMLInputElement>) => void
  onVideoUpload: (e: ChangeEvent<HTMLInputElement>) => void
  onOrientationChange: (v: "image" | "video") => void
  onPromptChange: (v: string) => void
  onNegativePromptChange: (v: string) => void
  onKeepSoundChange: (v: boolean) => void
  onGenerate: () => void
}
export function MotionForm(props: Props) {
  return (
    <>
      <div className={styles.motionGrid}>
        <label className={styles.upload}>
          <input
            type='file'
            accept='image/jpeg,image/png'
            onChange={props.onImageUpload}
          />
          {props.image ? (
            <img src={props.image} alt='' />
          ) : (
            <ImageIcon size={28} />
          )}
          <strong>Image reference</strong>
          <span>.jpg / .jpeg / .png up to 10MB</span>
        </label>
        <label className={styles.upload}>
          <input
            type='file'
            accept='video/mp4,video/quicktime'
            onChange={props.onVideoUpload}
          />
          {props.video ? (
            <video src={props.video} muted playsInline />
          ) : (
            <Film size={28} />
          )}
          <strong>Video reference</strong>
          <span>.mp4 / .mov up to 10MB</span>
        </label>
      </div>
      <label className={styles.field}>
        <span>Character orientation</span>
        <div className={styles.segmented}>
          {(["image", "video"] as const).map((value) => (
            <button
              type='button'
              key={value}
              className={props.orientation === value ? styles.active : ""}
              onClick={() => props.onOrientationChange(value)}
            >
              Match {value}
            </button>
          ))}
        </div>
      </label>
      <label className={styles.field}>
        <span>Prompt</span>
        <textarea
          value={props.prompt}
          onChange={(e) => props.onPromptChange(e.target.value)}
          placeholder='Describe the motion, camera movement, action, mood...'
        />
      </label>
      <label className={styles.field}>
        <span>Negative prompt</span>
        <textarea
          value={props.negativePrompt}
          onChange={(e) => props.onNegativePromptChange(e.target.value)}
          placeholder='Things to avoid in the generated video...'
        />
      </label>
      <label className={styles.toggle}>
        <input
          type='checkbox'
          checked={props.keepOriginalSound}
          onChange={(e) => props.onKeepSoundChange(e.target.checked)}
        />
        <span>Keep original sound</span>
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
        Generate video
      </button>
    </>
  )
}
