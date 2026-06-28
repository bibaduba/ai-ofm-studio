"use client"
import { ChangeEvent } from "react"
import { Loader2, Save, Wand2 } from "lucide-react"
import { ReferenceUpload } from "../ReferenceUpload"
import styles from "./index.module.scss"
type Props = {
  name: string
  faceReferences: string[]
  bodyReferences: string[]
  count: number
  prompt: string
  loading: boolean
  onNameChange: (v: string) => void
  onFaceUpload: (e: ChangeEvent<HTMLInputElement>) => void
  onBodyUpload: (e: ChangeEvent<HTMLInputElement>) => void
  onClearFace: () => void
  onClearBody: () => void
  onCountChange: (v: number) => void
  onPromptChange: (v: string) => void
  onSave: () => void
  onGenerate: () => void
}
export function ModelForm(props: Props) {
  return (
    <>
      <label className={styles.field}>
        <span>Model name</span>
        <input
          value={props.name}
          onChange={(e) => props.onNameChange(e.target.value)}
        />
      </label>
      <ReferenceUpload
        title='Face reference'
        description='Upload 1-2 face structure references'
        images={props.faceReferences}
        onUpload={props.onFaceUpload}
        onClear={props.onClearFace}
      />
      <ReferenceUpload
        title='Body reference'
        description='Upload 1-2 body type and physique references'
        images={props.bodyReferences}
        onUpload={props.onBodyUpload}
        onClear={props.onClearBody}
      />
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
        <span>Prompt</span>
        <textarea
          value={props.prompt}
          onChange={(e) => props.onPromptChange(e.target.value)}
        />
      </label>
      <div className={styles.actions}>
        <button type='button' onClick={props.onSave}>
          <Save size={18} />
          Save model
        </button>
        <button
          type='button'
          onClick={props.onGenerate}
          disabled={props.loading}
        >
          {props.loading ? (
            <Loader2 className={styles.spin} size={18} />
          ) : (
            <Wand2 size={18} />
          )}
          Generate
        </button>
      </div>
    </>
  )
}
