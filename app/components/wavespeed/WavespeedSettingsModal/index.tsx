"use client"
import { Eye, EyeOff, KeyRound, X } from "lucide-react"
import { AccountPanel } from "@/app/components/shared/AccountPanel"
import styles from "./index.module.scss"
type Props = {
  geminiApiKey: string
  wavespeedApiKey: string
  endpoint: string
  motionEndpoint: string
  showGeminiKey: boolean
  showWavespeedKey: boolean
  onClose: () => void
  onGeminiKeyChange: (v: string) => void
  onWavespeedKeyChange: (v: string) => void
  onEndpointChange: (v: string) => void
  onMotionEndpointChange: (v: string) => void
  onToggleGeminiKey: () => void
  onToggleWavespeedKey: () => void
}
export function WavespeedSettingsModal(props: Props) {
  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <section
        className={styles.modal}
        role='dialog'
        aria-modal='true'
        aria-label='Settings'
      >
        <header>
          <h2>Settings</h2>
          <button type='button' onClick={props.onClose} aria-label='Close'>
            <X size={20} />
          </button>
        </header>
        <label className={styles.field}>
          <span>Gemini API key</span>
          <div className={styles.keyBox}>
            <KeyRound size={18} />
            <input
              type={props.showGeminiKey ? "text" : "password"}
              value={props.geminiApiKey}
              onChange={(e) => props.onGeminiKeyChange(e.target.value)}
              placeholder='Gemini API key'
            />
            <button
              type='button'
              onClick={props.onToggleGeminiKey}
              aria-label='Toggle Gemini key visibility'
            >
              {props.showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <label className={styles.field}>
          <span>Wavespeed API key</span>
          <div className={styles.keyBox}>
            <KeyRound size={18} />
            <input
              type={props.showWavespeedKey ? "text" : "password"}
              value={props.wavespeedApiKey}
              onChange={(e) => props.onWavespeedKeyChange(e.target.value)}
              placeholder='Wavespeed API key'
            />
            <button
              type='button'
              onClick={props.onToggleWavespeedKey}
              aria-label='Toggle Wavespeed key visibility'
            >
              {props.showWavespeedKey ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
            </button>
          </div>
        </label>
        <label className={styles.field}>
          <span>Wavespeed endpoint</span>
          <input
            value={props.endpoint}
            onChange={(e) => props.onEndpointChange(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Wavespeed motion endpoint</span>
          <input
            value={props.motionEndpoint}
            onChange={(e) => props.onMotionEndpointChange(e.target.value)}
          />
        </label>
        <AccountPanel />
      </section>
    </div>
  )
}
